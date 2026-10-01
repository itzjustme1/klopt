<script lang="ts">
  import { tick, untrack } from "svelte";
  import { getLang, t } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import AccentBar from "../components/AccentBar.svelte";
  import Flag from "../components/Flag.svelte";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import { insertAtCaret } from "../lib/accents";
  import { cardImage } from "../lib/image";
  import { app } from "../lib/app.svelte";
  import { SUBJECTS } from "../lib/subjects";
  import { isValidDay } from "../lib/dates";
  import { href } from "../lib/router";
  import { CONTENT_LANGS, type ContentLang, type DeckKind } from "../lib/types";

  let { id, terms = false }: { id?: string; terms?: boolean } = $props();

  type Row = { key: number; id?: string; front: string; back: string; image?: string };

  const existing = untrack(() => (id ? app.deck(id) : undefined));
  let nextKey = 0;
  const blank = (): Row => ({ key: nextKey++, front: "", back: "" });

  let name = $state(existing?.name ?? "");
  let subject = $state(existing?.subject ?? "");
  let examDate = $state(existing?.examDate ?? "");
  /** Terms (history, biology): a term and its explanation, no languages. */
  let kind = $state<DeckKind>(untrack(() => existing?.kind ?? (terms ? "terms" : "words")));
  const isTerms = $derived(kind === "terms");
  let langFront = $state<ContentLang>(untrack(() => existing?.langFront ?? (terms ? "xx" : "en")));
  let langBack = $state<ContentLang>(untrack(() => existing?.langBack ?? (terms ? "xx" : getLang())));
  // Switching a new list to terms drops the languages; back to words restores the usual pair.
  $effect(() => {
    if (existing) return;
    if (kind === "terms") [langFront, langBack] = ["xx", "xx"];
    else if (untrack(() => langFront === "xx" && langBack === "xx")) [langFront, langBack] = ["en", getLang()];
  });
  let rows = $state<Row[]>(
    untrack(() =>
      existing ? [...app.sortedCards(existing.id).map((c) => ({ key: nextKey++, id: c.id, front: c.front, back: c.back, ...(c.image ? { image: c.image } : {}) })), blank()] : [blank(), blank(), blank(), blank(), blank()],
    ),
  );
  let errors = $state<string[]>([]);
  let busy = $state(false);
  let focused = $state<{ row: number; side: "front" | "back" } | null>(null);
  let table: HTMLElement | undefined = $state();
  let nameInput: HTMLInputElement | undefined = $state();


  $effect(() => {
    if (!existing) nameInput?.focus();
  });

  // Always keep one empty row at the end to type into.
  $effect(() => {
    const last = rows[rows.length - 1];
    if (!last || last.front.trim() || last.back.trim() || last.image) rows.push(blank());
  });

  function input(row: number, side: "front" | "back"): HTMLInputElement | HTMLTextAreaElement | null {
    return table?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-row="${row}"][data-side="${side}"]`) ?? null;
  }

  async function focusCell(row: number, side: "front" | "back") {
    await tick();
    input(row, side)?.focus();
  }

  function onkeydown(e: KeyboardEvent, row: number, side: "front" | "back") {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    if (side === "front") void focusCell(row, "back");
    else {
      if (row === rows.length - 1) rows.push(blank());
      void focusCell(row + 1, "front");
    }
  }

  /** Pasting several lines splits them over rows; a tab or semicolon splits a line into both sides. */
  function onpaste(e: ClipboardEvent, row: number, side: "front" | "back") {
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (!/[\n\t]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim());
    const parsed = lines.map((l) => {
      const at = l.includes("\t") ? l.indexOf("\t") : l.indexOf(";");
      return at === -1 ? { front: l.trim(), back: "" } : { front: l.slice(0, at).trim(), back: l.slice(at + 1).trim() };
    });
    let r = row;
    for (const p of parsed) {
      while (rows.length <= r) rows.push(blank());
      const target = rows[r]!;
      if (side === "back" && !p.back) target.back = p.front;
      else {
        target.front = p.front;
        target.back = p.back || target.back;
      }
      r++;
    }
    void focusCell(Math.min(r, rows.length - 1), "front");
  }

  // One hidden file input serves every row's picture button.
  let fileInput: HTMLInputElement | undefined = $state();
  let pickFor = -1;
  function pickImage(i: number) {
    pickFor = i;
    fileInput?.click();
  }
  async function onImage() {
    const file = fileInput?.files?.[0];
    if (fileInput) fileInput.value = "";
    const row = rows[pickFor];
    if (!file || !row) return;
    try {
      row.image = await cardImage(file);
    } catch {
      app.showFlash(t("editor.imageFailed"));
    }
  }

  function removeRow(i: number) {
    rows.splice(i, 1);
    if (!rows.length) rows.push(blank());
  }

  function swap() {
    [langFront, langBack] = [langBack, langFront];
    for (const r of rows) [r.front, r.back] = [r.back, r.front];
  }

  function insertChar(ch: string) {
    if (!focused) return;
    const el = input(focused.row, focused.side);
    if (!el) return;
    const value = insertAtCaret(el, ch);
    rows[focused.row]![focused.side] = value;
    el.focus();
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    const problems: string[] = [];
    const n = name.trim();
    if (!n) problems.push(t("editor.nameRequired"));
    if (examDate && (!isValidDay(examDate) || examDate < app.today) && examDate !== existing?.examDate) problems.push(t("editor.examPast"));
    else if (n.length > LIMITS.deckNameChars) problems.push(t("editor.nameTooLong", { n: LIMITS.deckNameChars }));
    const clean: { id?: string; front: string; back: string; image?: string }[] = [];
    rows.forEach((r, i) => {
      const f = r.front.trim();
      const b = r.back.trim();
      if (!f && !b && !r.image) return;
      // With a picture the front may stay empty: the picture is the question.
      if ((!f && !r.image) || !b) problems.push(t("editor.rowIncomplete", { n: i + 1 }));
      else if (f.length > LIMITS.sideChars || b.length > LIMITS.sideChars) problems.push(t("editor.rowTooLong", { n: i + 1, max: LIMITS.sideChars }));
      else clean.push({ ...(r.id ? { id: r.id } : {}), front: f, back: b, ...(r.image ? { image: r.image } : {}) });
    });
    if (!clean.length && !problems.length) problems.push(t("editor.noRows"));
    errors = problems;
    if (problems.length) return;
    busy = true;
    try {
      const deckInput = { name: n, langFront, langBack, kind, subject: subject.trim().slice(0, LIMITS.labelChars), examDate: isValidDay(examDate) ? examDate : "" };
      let deckId = existing?.id;
      if (deckId) await app.updateDeck(deckId, deckInput);
      else deckId = (await app.createDeck(deckInput)).id;
      await app.saveDeckCards(deckId, clean);
      app.showFlash(t("editor.saved"));
      location.hash = href.deck(deckId);
    } catch {
      errors = [t("common.saveFailed")];
    } finally {
      busy = false;
    }
  }

  const focusedLang = $derived(focused ? (focused.side === "front" ? langFront : langBack) : null);
</script>

<PageHead title={existing ? t("editor.editTitle") : isTerms ? t("editor.newTermsTitle") : t("editor.newTitle")} subtitle={existing?.name} back={{ href: existing ? href.deck(existing.id) : href.newList(), label: t("common.back") }} />
<form class="editor" onsubmit={save} novalidate>

  <div class="card card-pad meta">
    {#if !existing}
      <fieldset class="fieldset-wrap kind">
        <legend>{t("editor.kind")}</legend>
        <div class="segmented">
          <label><input type="radio" name="kind" value="words" bind:group={kind} />{t("editor.kindWords")}</label>
          <label><input type="radio" name="kind" value="terms" bind:group={kind} />{t("editor.kindTerms")}</label>
        </div>
      </fieldset>
    {/if}
    <div class="field name">
      <label for="list-name">{t("editor.name")}</label>
      <input id="list-name" type="text" bind:value={name} bind:this={nameInput} maxlength={LIMITS.deckNameChars} placeholder={isTerms ? t("editor.termsPlaceholder") : t("editor.namePlaceholder")} autocomplete="off" />
    </div>
    <div class="field">
      <label for="list-subject">{t("editor.subject")}</label>
      <input id="list-subject" type="text" bind:value={subject} list="subject-list" maxlength={LIMITS.labelChars} autocomplete="off" />
      <datalist id="subject-list">
        {#each SUBJECTS[getLang()] as s (s)}<option value={s}></option>{/each}
      </datalist>
    </div>
    <div class="field">
      <label for="list-exam">{t("editor.examDate")}</label>
      <input id="list-exam" type="date" bind:value={examDate} min={app.today} aria-describedby="exam-help" />
      <span id="exam-help" class="small muted">{t("editor.examHelp")}</span>
    </div>
    <div class="langs" hidden={isTerms}>
      <div class="field">
        <label for="lang-front">{t("editor.langFront")}</label>
        <div class="lang-select">
          <Flag lang={langFront} size={22} />
          <select id="lang-front" bind:value={langFront}>
            {#each CONTENT_LANGS as l (l)}<option value={l}>{t(`lang.${l}`)}</option>{/each}
          </select>
        </div>
      </div>
      <div class="field">
        <label for="lang-back">{t("editor.langBack")}</label>
        <div class="lang-select">
          <Flag lang={langBack} size={22} />
          <select id="lang-back" bind:value={langBack}>
            {#each CONTENT_LANGS as l (l)}<option value={l}>{t(`lang.${l}`)}</option>{/each}
          </select>
        </div>
      </div>
      <button type="button" class="btn btn-quiet swap" onclick={swap}><Icon name="swap" size={20} />{t("editor.swap")}</button>
    </div>
  </div>

  <div class="table card" bind:this={table}>
    <div class="thead" aria-hidden="true" hidden={isTerms}>
      <span></span><span class="caption">{t(`lang.${langFront}`)}</span><span class="caption">{t(`lang.${langBack}`)}</span><span></span>
    </div>
    <ol class="erows">
      {#each rows as row, i (row.key)}
        <li class="erow" class:term={isTerms}>
          <span class="rownum caption num" aria-hidden="true">{i + 1}</span>
          <div class="cells">
            <input
              type="text"
              aria-label="{t('editor.row', { n: i + 1 })}, {isTerms ? t('editor.term') : t('editor.front')}"
              placeholder={i === 0 || isTerms ? (isTerms ? t("editor.term") : t("editor.front")) : ""}
              lang={langFront === "xx" ? undefined : langFront}
              data-row={i}
              data-side="front"
              bind:value={row.front}
              maxlength={LIMITS.sideChars}
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              onfocus={() => (focused = { row: i, side: "front" })}
              onkeydown={(e) => onkeydown(e, i, "front")}
              onpaste={(e) => onpaste(e, i, "front")}
            />
            {#if isTerms}
              <textarea
                rows="2"
                aria-label="{t('editor.row', { n: i + 1 })}, {t('editor.explanation')}"
                placeholder={t("editor.explanation")}
                data-row={i}
                data-side="back"
                bind:value={row.back}
                maxlength={LIMITS.sideChars}
                onfocus={() => (focused = { row: i, side: "back" })}
                onkeydown={(e) => onkeydown(e, i, "back")}
                onpaste={(e) => onpaste(e, i, "back")}
              ></textarea>
            {:else}
              <input
                type="text"
                aria-label="{t('editor.row', { n: i + 1 })}, {t('editor.back')}"
                placeholder={i === 0 ? t("editor.back") : ""}
                lang={langBack === "xx" ? undefined : langBack}
                data-row={i}
                data-side="back"
                bind:value={row.back}
                maxlength={LIMITS.sideChars}
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                onfocus={() => (focused = { row: i, side: "back" })}
                onkeydown={(e) => onkeydown(e, i, "back")}
                onpaste={(e) => onpaste(e, i, "back")}
              />
            {/if}
            {#if row.image}
              <div class="pic">
                <img src={row.image} alt="" />
                <button type="button" class="btn btn-quiet" onclick={() => (row.image = undefined)}>{t("editor.removeImage")}</button>
              </div>
            {/if}
          </div>
          <div class="tools">
            <button type="button" class="icon-btn" aria-label={row.image ? t("editor.replaceImage", { n: i + 1 }) : t("editor.addImage", { n: i + 1 })} title={t("editor.image")} onclick={() => pickImage(i)}><Icon name="image" size={20} /></button>
            <button type="button" class="icon-btn" aria-label={t("editor.removeRow", { n: i + 1 })} onclick={() => removeRow(i)}><Icon name="x" size={20} /></button>
          </div>
        </li>
      {/each}
    </ol>
    <input class="visually-hidden" type="file" accept="image/*" tabindex="-1" aria-hidden="true" bind:this={fileInput} onchange={onImage} />
    <button type="button" class="btn btn-quiet add" onclick={() => { rows.push(blank()); void focusCell(rows.length - 1, "front"); }}>
      <Icon name="plus" size={20} />{t("editor.addRow")}
    </button>
  </div>

  <p class="small muted">{t("editor.tip")} {t("editor.altTip")}</p>

  {#if errors.length}
    <ul class="errors" role="alert">
      {#each errors as err, i (i)}<li class="error">{err}</li>{/each}
    </ul>
  {/if}

  <div class="savebar">
    {#if focusedLang}
      <AccentBar lang={focusedLang} oninsert={insertChar} />
    {/if}
    <div class="row">
      <button type="submit" class="btn btn-primary btn-lg" disabled={busy}>{t("editor.save")}</button>
      <a class="btn" href={existing ? href.deck(existing.id) : href.lists()}>{t("common.cancel")}</a>
    </div>
  </div>
</form>

<style>
  .editor {
    display: grid;
    gap: 1rem;
    max-width: 860px;
  }
  .meta {
    display: grid;
    gap: 1rem;
  }
  @media (min-width: 720px) {
    .meta {
      grid-template-columns: 1.4fr 1fr;
    }
    .langs {
      grid-column: 1 / -1;
    }
  }
  .langs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: end;
    gap: 0.5rem 0.75rem;
  }
  .swap {
    grid-column: 1 / -1;
    justify-self: start;
  }
  .lang-select {
    position: relative;
  }
  .lang-select :global(.flag) {
    position: absolute;
    left: 0.875rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }
  .lang-select select {
    padding-left: 2.75rem;
    padding-right: 0.5rem;
  }

  .table {
    padding: 0.5rem 0.75rem 0.75rem;
  }
  .thead,
  .erow {
    display: grid;
    grid-template-columns: 1.75rem 1fr auto;
    gap: 0.5rem;
    align-items: start;
  }
  .thead {
    grid-template-columns: 1.75rem 1fr 1fr calc(var(--tap) * 2 + 0.25rem);
    padding: 0.5rem 0 0.25rem;
    color: var(--ink-2);
  }
  .erows {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rownum {
    color: var(--ink-2);
    text-align: right;
    padding-top: 0.875rem;
  }
  /* Word and translation side by side; a term above its explanation. */
  .cells {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    min-width: 0;
  }
  .term .cells {
    grid-template-columns: 1fr;
  }
  .cells :is(input, textarea) {
    min-width: 0;
  }
  .pic {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .pic img {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: var(--r-sm);
  }
  .tools {
    display: flex;
    gap: 0.25rem;
  }
  .kind {
    grid-column: 1 / -1;
  }
  .add {
    margin-top: 0.5rem;
  }
  @media (max-width: 520px) {
    .thead,
    .rownum {
      display: none;
    }
    .erow {
      grid-template-columns: 1fr auto;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--line);
    }
    .cells {
      grid-template-columns: 1fr;
    }
    .tools {
      flex-direction: column;
    }
  }

  .errors {
    margin: 0;
    padding-left: 1.25rem;
    display: grid;
    gap: 0.25rem;
  }
  .savebar {
    position: sticky;
    bottom: 0;
    z-index: 5;
    display: grid;
    gap: 0.75rem;
    padding: 0.75rem 0 calc(0.75rem + env(safe-area-inset-bottom));
    background: var(--bg);
  }
</style>
