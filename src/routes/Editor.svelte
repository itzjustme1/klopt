<script lang="ts">
  import { tick, untrack } from "svelte";
  import { getLang, t } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import AccentBar from "../components/AccentBar.svelte";
  import Flag from "../components/Flag.svelte";
  import Icon from "../components/Icon.svelte";
  import { insertAtCaret } from "../lib/accents";
  import { app } from "../lib/app.svelte";
  import { SUBJECTS } from "../lib/subjects";
  import { href } from "../lib/router";
  import { CONTENT_LANGS, type ContentLang } from "../lib/types";

  let { id }: { id?: string } = $props();

  type Row = { key: number; id?: string; front: string; back: string };

  const existing = untrack(() => (id ? app.deck(id) : undefined));
  let nextKey = 0;
  const blank = (): Row => ({ key: nextKey++, front: "", back: "" });

  let name = $state(existing?.name ?? "");
  let subject = $state(existing?.subject ?? "");
  let langFront = $state<ContentLang>(existing?.langFront ?? "en");
  let langBack = $state<ContentLang>(existing?.langBack ?? getLang());
  let rows = $state<Row[]>(
    untrack(() =>
      existing ? [...app.sortedCards(existing.id).map((c) => ({ key: nextKey++, id: c.id, front: c.front, back: c.back })), blank()] : [blank(), blank(), blank(), blank(), blank()],
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
    if (!last || last.front.trim() || last.back.trim()) rows.push(blank());
  });

  function input(row: number, side: "front" | "back"): HTMLInputElement | null {
    return table?.querySelector<HTMLInputElement>(`[data-row="${row}"][data-side="${side}"]`) ?? null;
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
    else if (n.length > LIMITS.deckNameChars) problems.push(t("editor.nameTooLong", { n: LIMITS.deckNameChars }));
    const clean: { id?: string; front: string; back: string }[] = [];
    rows.forEach((r, i) => {
      const f = r.front.trim();
      const b = r.back.trim();
      if (!f && !b) return;
      if (!f || !b) problems.push(t("editor.rowIncomplete", { n: i + 1 }));
      else if (f.length > LIMITS.sideChars || b.length > LIMITS.sideChars) problems.push(t("editor.rowTooLong", { n: i + 1, max: LIMITS.sideChars }));
      else clean.push(r.id ? { id: r.id, front: f, back: b } : { front: f, back: b });
    });
    if (!clean.length && !problems.length) problems.push(t("editor.noRows"));
    errors = problems;
    if (problems.length) return;
    busy = true;
    try {
      const deckInput = { name: n, langFront, langBack, subject: subject.trim().slice(0, LIMITS.labelChars) };
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

<form class="editor" onsubmit={save} novalidate>
  <a class="back small" href={existing ? href.deck(existing.id) : href.newList()}><Icon name="back" size={18} />{t("common.back")}</a>
  <h1>{existing ? t("editor.editTitle") : t("editor.newTitle")}</h1>

  <div class="card card-pad meta">
    <div class="field name">
      <label for="list-name">{t("editor.name")}</label>
      <input id="list-name" type="text" bind:value={name} bind:this={nameInput} maxlength={LIMITS.deckNameChars} placeholder={t("editor.namePlaceholder")} autocomplete="off" />
    </div>
    <div class="field">
      <label for="list-subject">{t("editor.subject")}</label>
      <input id="list-subject" type="text" bind:value={subject} list="subject-list" maxlength={LIMITS.labelChars} autocomplete="off" />
      <datalist id="subject-list">
        {#each SUBJECTS[getLang()] as s (s)}<option value={s}></option>{/each}
      </datalist>
    </div>
    <div class="langs">
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
    <div class="thead" aria-hidden="true">
      <span></span><span class="caption">{t(`lang.${langFront}`)}</span><span class="caption">{t(`lang.${langBack}`)}</span><span></span>
    </div>
    <ol class="rows">
      {#each rows as row, i (row.key)}
        <li class="erow">
          <span class="rownum caption num" aria-hidden="true">{i + 1}</span>
          <input
            type="text"
            aria-label="{t('editor.row', { n: i + 1 })}, {t('editor.front')}"
            placeholder={i === 0 ? t("editor.front") : ""}
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
          <button type="button" class="icon-btn" aria-label={t("editor.removeRow", { n: i + 1 })} onclick={() => removeRow(i)}><Icon name="x" size={20} /></button>
        </li>
      {/each}
    </ol>
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
    grid-template-columns: 1.75rem 1fr 1fr var(--tap);
    gap: 0.5rem;
    align-items: center;
  }
  .thead {
    padding: 0.5rem 0 0.25rem;
    color: var(--ink-2);
  }
  .rows {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rownum {
    color: var(--ink-2);
    text-align: right;
  }
  .erow input {
    min-width: 0;
  }
  .add {
    margin-top: 0.5rem;
  }
  @media (max-width: 520px) {
    .thead {
      display: none;
    }
    .erow {
      grid-template-columns: 1fr var(--tap);
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--line);
    }
    .rownum {
      display: none;
    }
    .erow input:nth-of-type(2) {
      grid-column: 1;
    }
    .erow .icon-btn {
      grid-row: 1 / span 2;
      grid-column: 2;
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
  @media (max-width: 719px) {
    .savebar {
      bottom: calc(4.25rem + env(safe-area-inset-bottom));
    }
  }
</style>
