<script lang="ts">
  import { getLang, t } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import CameraCapture from "../components/CameraCapture.svelte";
  import PageHead from "../components/PageHead.svelte";
  import { app } from "../lib/app.svelte";
  import { setPendingImport } from "../lib/handoff";
  import { recognizeList, tesseractLangs, type OcrProgress } from "../lib/ocr";
  import { href } from "../lib/router";
  import { CONTENT_LANGS, type ContentLang } from "../lib/types";

  /** A photo of a two-column word list (word and translation) becomes rows to check on the paste screen. */
  let { deckId }: { deckId?: string } = $props();

  // svelte-ignore state_referenced_locally
  const deck = deckId ? app.deck(deckId) : undefined;
  let langFront = $state<ContentLang>(deck?.langFront ?? "en");
  let langBack = $state<ContentLang>(deck?.langBack ?? getLang());
  let progress = $state<OcrProgress | null>(null);
  let error = $state("");
  let input: HTMLInputElement | undefined = $state();
  // A phone or tablet: a coarse pointer and several touch points. Everything else counts as a laptop,
  // whose file picker has no camera, so it gets a camera button of its own.
  const laptop = typeof navigator !== "undefined" && !(matchMedia("(pointer: coarse)").matches && navigator.maxTouchPoints > 1);
  const canCamera = laptop && !!navigator.mediaDevices?.getUserMedia;
  let cameraOpen = $state(false);

  /** Rough download size in MB: engine plus the language data. */
  const LANG_MB: Record<string, number> = { nld: 3, eng: 3, fra: 0.7, deu: 1.3, spa: 2.1, ita: 1.7, lat: 1.7 };
  const mb = $derived(Math.round(4 + tesseractLangs([langFront, langBack]).reduce((sum, l) => sum + (LANG_MB[l] ?? 2), 0)));

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
    } catch (e) {
      console.error(e);
      error = t("photo.failed");
    } finally {
      progress = null;
      if (input) input.value = "";
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
</script>

<svelte:window {onpaste} />

{#if cameraOpen}
  <CameraCapture onclose={() => (cameraOpen = false)} onphoto={(f) => { cameraOpen = false; void handle(f); }} />
{/if}

<PageHead title={t("photo.title")} subtitle={t("photo.intro")} back={{ href: deck ? href.deck(deck.id) : href.newList(), label: t("common.back") }} />
<section class="photo" class:dragging {ondrop} {ondragover} ondragleave={() => (dragging = false)} aria-label={t("photo.title")}>
  <div class="card card-pad box">
    <p class="small muted">{t("photo.listHelp")}</p>
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
  .box {
    display: grid;
    gap: 1.25rem;
  }
  .langs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .picks {
    flex-wrap: wrap;
  }
  .pick {
    justify-self: start;
  }
  .pick:focus-within {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .desk-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .progress {
    display: grid;
    gap: 0.5rem;
  }
</style>
