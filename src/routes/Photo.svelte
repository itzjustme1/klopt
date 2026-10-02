<script lang="ts">
  import { tick } from "svelte";
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import Icon from "../components/Icon.svelte";
  import CameraCapture from "../components/CameraCapture.svelte";
  import PageHead from "../components/PageHead.svelte";
  import { app } from "../lib/app.svelte";
  import { setPendingImport } from "../lib/handoff";
  import { recognizeList, recognizeTerms, tesseractLangs, type OcrProgress } from "../lib/ocr";
  import { href } from "../lib/router";
  import { SUBJECTS } from "../lib/subjects";
  import { CONTENT_LANGS, type ContentLang } from "../lib/types";

  let { deckId }: { deckId?: string } = $props();

  // svelte-ignore state_referenced_locally
  const deck = deckId ? app.deck(deckId) : undefined;
  /** What is on the photo: a two-column word list, or running text with bold or italic terms. */
  let kind = $state<"list" | "terms">(deck?.kind === "terms" ? "terms" : "list");
  let langFront = $state<ContentLang>(deck?.langFront ?? "en");
  let langBack = $state<ContentLang>(deck?.langBack ?? getLang());
  let textLang = $state<ContentLang>(deck?.kind === "terms" ? deck.langFront : getLang());
  let progress = $state<OcrProgress | null>(null);
  let error = $state("");
  let input: HTMLInputElement | undefined = $state();
  /** A camera through the browser: for laptops, whose file picker has no camera. */
  // Laptops only: a touch device (phone, tablet) already offers its camera in the photo picker.
  // A phone or tablet: a coarse pointer and several touch points. Everything else counts as a laptop.
  const laptop = typeof navigator !== "undefined" && !(matchMedia("(pointer: coarse)").matches && navigator.maxTouchPoints > 1);
  const canCamera = laptop && !!navigator.mediaDevices?.getUserMedia;
  let cameraOpen = $state(false);

  // Found terms, to check before they become a list. More pages can be added.
  let found = $state<{ id: number; term: string; explanation: string; keep: boolean }[]>([]);
  let editing = $state<number | null>(null);
  let nextId = 0;
  let pages = $state(0);
  let name = $state("");
  let subject = $state("");
  let saving = $state(false);
  // Only complete terms count: a term typed in by hand needs both sides.
  const kept = $derived(found.filter((f) => f.keep && f.term.trim() && f.explanation.trim()));

  /** Rough download size in MB: engine plus the language data. */
  const LANG_MB: Record<string, number> = { nld: 3, eng: 3, fra: 0.7, deu: 1.3, spa: 2.1, ita: 1.7, lat: 1.7 };
  const mb = $derived(Math.round(4 + tesseractLangs(kind === "terms" ? [textLang] : [langFront, langBack]).reduce((sum, l) => sum + (LANG_MB[l] ?? 2), 0)));

  async function choose() {
    await handle(input?.files?.[0]);
  }

  async function handle(file: File | undefined) {
    error = "";
    if (!file || progress) return;
    if (file.type && !file.type.startsWith("image/")) {
      error = t("photo.notImage");
      return;
    }
    try {
      progress = { status: "loading", progress: 0 };
      if (kind === "terms") await readTerms(file);
      else await readList(file);
    } catch (e) {
      console.error(e);
      error = t("photo.failed");
    } finally {
      progress = null;
      if (input) input.value = "";
    }
  }

  async function readList(file: File) {
    const rows = await recognizeList(file, [langFront, langBack], (p) => (progress = p));
    if (!rows.length) {
      error = t("photo.none");
      return;
    }
    // Running text instead of two columns: say so, rather than showing a table of nonsense.
    if (rows.length >= 8 && rows.filter((r) => r.includes("\t")).length / rows.length < 0.4) {
      error = t("photo.notAList");
      return;
    }
    setPendingImport({ text: rows.join("\n"), langFront, langBack, source: "photo" });
    location.hash = href.import(deckId);
  }

  async function readTerms(file: File) {
    const res = await recognizeTerms(file, textLang, (p) => (progress = p));
    if (res.unclear) {
      error = t("photo.unclear");
      return;
    }
    if (!res.words) {
      error = t("photo.none");
      return;
    }
    const known = new Set(found.map((f) => f.term.toLocaleLowerCase()));
    const fresh = res.cards.filter((c) => !known.has(c.term.toLocaleLowerCase()));
    if (!fresh.length) {
      error = pages ? t("photo.noNewTerms") : t("photo.noTerms");
      return;
    }
    found = [...found, ...fresh.map((c) => ({ id: nextId++, term: c.term.slice(0, LIMITS.sideChars), explanation: c.explanation.slice(0, LIMITS.sideChars), keep: true }))];
    if (!pages && !name) name = res.title.slice(0, LIMITS.deckNameChars) || t("photo.defaultName");
    pages++;
  }

  async function save() {
    if (!kept.length) return;
    saving = true;
    try {
      const cards = kept.map((f) => ({ front: f.term.trim(), back: f.explanation.trim() })).filter((c) => c.front && c.back);
      let id = deck?.id;
      if (!id) {
        const made = await app.createDeck({ name: name.trim().slice(0, LIMITS.deckNameChars) || t("photo.defaultName"), subject: subject.trim().slice(0, LIMITS.labelChars), langFront: textLang, langBack: textLang, kind: "terms" });
        id = made.id;
      }
      await app.addCards(id, cards);
      app.showFlash(tp("photo.saved", cards.length));
      location.hash = href.deck(id);
    } catch {
      error = t("common.saveFailed");
      saving = false;
    }
  }

  // On a laptop: drop a photo on the page, or paste one (a screenshot of a digital textbook, say).
  let dragging = $state(false);
  function ondrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    void handle(e.dataTransfer?.files?.[0]);
  }
  function ondragover(e: DragEvent) {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    dragging = true;
  }
  function onpaste(e: ClipboardEvent) {
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    void handle(file);
  }

  /** A term the photo missed, typed in by hand. */
  async function addTerm() {
    const id = nextId++;
    found = [...found, { id, term: "", explanation: "", keep: true }];
    editing = id;
    await tick();
    document.getElementById(`ph-term-${id}`)?.focus();
  }

  async function edit(id: number) {
    editing = id;
    await tick();
    document.getElementById(`ph-exp-${id}`)?.focus();
  }

  function startOver() {
    found = [];
    pages = 0;
    name = "";
    error = "";
  }
</script>

<PageHead title={t("photo.title")} subtitle={found.length ? undefined : t("photo.intro")} back={{ href: deck ? href.deck(deck.id) : href.newList(), label: t("common.back") }} />
<svelte:window {onpaste} />

{#if cameraOpen}
  <CameraCapture onclose={() => (cameraOpen = false)} onphoto={(f) => { cameraOpen = false; void handle(f); }} />
{/if}
<section class="photo" class:dragging {ondrop} {ondragover} ondragleave={() => (dragging = false)} aria-label={t("photo.title")}>
  {#if found.length}
    <div class="card card-pad review">
      <div class="review-head">
        <h2>{tp("photo.found", found.length)}</h2>
        <p class="small muted">{t("photo.checkTerms")}</p>
      </div>
      <ul class="found">
        {#each found as f, i (f.id)}
          <li class="found-item">
            {#if editing === f.id}
              <div class="edit">
                <div class="field">
                  <label for="ph-term-{f.id}">{t("photo.term")}</label>
                  <input id="ph-term-{f.id}" type="text" bind:value={found[i]!.term} maxlength={LIMITS.sideChars} autocomplete="off" />
                </div>
                <div class="field">
                  <label for="ph-exp-{f.id}">{t("photo.explanation")}</label>
                  <textarea id="ph-exp-{f.id}" rows="3" bind:value={found[i]!.explanation} maxlength={LIMITS.sideChars}></textarea>
                </div>
                <button type="button" class="btn btn-primary done" onclick={() => (editing = null)}>{t("photo.editDone")}</button>
              </div>
            {:else}
              <label class="term" class:off={!f.keep}>
                <input type="checkbox" bind:checked={found[i]!.keep} />
                <span class="term-text">
                  <span class="t-front">{f.term}</span>
                  <span class="t-back small">{f.explanation}</span>
                </span>
              </label>
              <button type="button" class="icon-btn edit-btn" aria-label={t("photo.editTerm", { term: f.term })} title={t("common.edit")} onclick={() => edit(f.id)}><Icon name="edit" size={18} /></button>
            {/if}
          </li>
        {/each}
      </ul>
      <button type="button" class="btn btn-quiet add-term" onclick={addTerm}><Icon name="plus" size={18} />{t("photo.addTerm")}</button>
      {#if !deck}
        <div class="meta">
          <div class="field">
            <label for="ph-name">{t("editor.name")}</label>
            <input id="ph-name" type="text" bind:value={name} maxlength={LIMITS.deckNameChars} autocomplete="off" />
          </div>
          <div class="field">
            <label for="ph-subject">{t("editor.subject")}</label>
            <input id="ph-subject" type="text" bind:value={subject} list="ph-subjects" maxlength={LIMITS.labelChars} autocomplete="off" />
            <datalist id="ph-subjects">
              {#each SUBJECTS[getLang()] as s (s)}<option value={s}></option>{/each}
            </datalist>
          </div>
        </div>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      {#if progress}
        <div class="progress" role="status">
          <p class="small">{progress.status === "reading" ? t("photo.reading", { p: Math.round(progress.progress * 100) }) : t("photo.loading", { p: Math.round(progress.progress * 100) })}</p>
          <div class="bar" aria-hidden="true"><span style:width="{Math.round(progress.progress * 100)}%"></span></div>
        </div>
      {:else}
        <div class="row actions">
          <button type="button" class="btn btn-primary btn-lg" disabled={saving || !kept.length} onclick={save}>
            {deck ? tp("photo.addTo", kept.length, { name: deck.name }) : tp("photo.makeList", kept.length)}
          </button>
          <label class="btn pick">
            <Icon name="camera" size={20} />{t("photo.morePage")}
            <input class="visually-hidden" type="file" accept="image/*" bind:this={input} onchange={choose} />
          </label>
          {#if canCamera}<button type="button" class="btn" onclick={() => (cameraOpen = true)}><Icon name="camera" size={20} />{t("camera.morePage")}</button>{/if}
          <button type="button" class="btn btn-quiet" onclick={startOver}>{t("photo.startOver")}</button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="card card-pad box">
      <fieldset class="fieldset-wrap">
        <legend>{t("photo.what")}</legend>
        <div class="segmented kinds">
          <label><input type="radio" name="ph-kind" value="list" bind:group={kind} disabled={!!progress} />{t("photo.kindList")}</label>
          <label><input type="radio" name="ph-kind" value="terms" bind:group={kind} disabled={!!progress} />{t("photo.kindTerms")}</label>
        </div>
        <p class="small muted kind-help">{kind === "terms" ? t("photo.termsHelp") : t("photo.listHelp")}</p>
      </fieldset>

      {#if kind === "terms"}
        <div class="field">
          <label for="ph-tl">{t("photo.textLang")}</label>
          <select id="ph-tl" bind:value={textLang} disabled={!!progress}>
            {#each CONTENT_LANGS as l (l)}<option value={l}>{t(`lang.${l}`)}</option>{/each}
          </select>
        </div>
      {:else}
        <fieldset class="fieldset-wrap">
          <legend>{t("photo.langs")}</legend>
          <div class="langs">
            <div class="field">
              <label for="ph-lf">{t("editor.langFront")}</label>
              <select id="ph-lf" bind:value={langFront} disabled={!!progress}>
                {#each CONTENT_LANGS as l (l)}<option value={l}>{t(`lang.${l}`)}</option>{/each}
              </select>
            </div>
            <div class="field">
              <label for="ph-lb">{t("editor.langBack")}</label>
              <select id="ph-lb" bind:value={langBack} disabled={!!progress}>
                {#each CONTENT_LANGS as l (l)}<option value={l}>{t(`lang.${l}`)}</option>{/each}
              </select>
            </div>
          </div>
        </fieldset>
      {/if}

      {#if progress}
        <div class="progress" role="status">
          <p class="small">
            {progress.status === "reading" ? t("photo.reading", { p: Math.round(progress.progress * 100) }) : t("photo.loading", { p: Math.round(progress.progress * 100) })}
          </p>
          <div class="bar" aria-hidden="true"><span style:width="{Math.round(progress.progress * 100)}%"></span></div>
        </div>
      {:else}
        <div class="row picks">
          <label class="btn btn-primary btn-lg pick">
            <Icon name="camera" size={22} />{t("photo.choose")}
            <input class="visually-hidden" type="file" accept="image/*" bind:this={input} onchange={choose} />
          </label>
          {#if canCamera}<button type="button" class="btn btn-lg" onclick={() => (cameraOpen = true)}><Icon name="camera" size={22} />{t("camera.open")}</button>{/if}
        </div>
      {/if}

      {#if error}<p class="error" role="alert">{error}</p>{/if}
      {#if laptop}<p class="small muted desk-hint"><Icon name="image" size={16} />{t("photo.dropHint")}</p>{/if}
      <p class="small muted">{t("photo.firstTime", { mb })} {t("photo.handwriting")}</p>
    </div>
  {/if}
</section>

<style>
  .photo {
    display: grid;
    gap: 1rem;
    max-width: 640px;
    border-radius: var(--r-lg);
    transition: box-shadow var(--t-base) var(--ease);
  }
  .photo.dragging {
    box-shadow: 0 0 0 3px var(--accent);
  }
  .picks {
    flex-wrap: wrap;
  }

  .desk-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .box,
  .review {
    display: grid;
    gap: 1.25rem;
  }
  .kinds label {
    flex: 1;
  }
  .kind-help {
    margin-top: 0.5rem;
  }
  .langs,
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .pick {
    justify-self: start;
  }
  .pick:focus-within {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .progress {
    display: grid;
    gap: 0.5rem;
  }
  .review-head {
    display: grid;
    gap: 0.25rem;
  }
  .found {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
    border-radius: var(--r-md);
    overflow: hidden;
    background: var(--surface-2);
  }
  .found li + li {
    border-top: 1px solid var(--line);
  }
  .found-item {
    display: flex;
    align-items: flex-start;
  }
  .found-item .term {
    flex: 1;
    min-width: 0;
  }
  .edit-btn {
    margin: 0.375rem 0.375rem 0 0;
    color: var(--ink-2);
  }
  .edit {
    display: grid;
    gap: 0.75rem;
    width: 100%;
    padding: 1rem;
  }
  .done {
    justify-self: start;
  }
  .add-term {
    justify-self: start;
  }
  .term {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
    cursor: pointer;
  }
  .term input {
    width: 22px;
    height: 22px;
    margin-top: 0.125rem;
    flex: none;
    accent-color: var(--green);
  }
  .term-text {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .t-front {
    font-weight: 800;
  }
  .t-back {
    color: var(--ink-2);
  }
  .term.off .term-text {
    opacity: 0.5;
  }
  .actions {
    flex-wrap: wrap;
  }
  @media (max-width: 480px) {
    .meta {
      grid-template-columns: 1fr;
    }
  }
</style>
