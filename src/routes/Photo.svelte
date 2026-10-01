<script lang="ts">
  import { getLang, t } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import { app } from "../lib/app.svelte";
  import { setPendingImport } from "../lib/handoff";
  import { recognizeList, tesseractLangs, type OcrProgress } from "../lib/ocr";
  import { href } from "../lib/router";
  import { CONTENT_LANGS, type ContentLang } from "../lib/types";

  let { deckId }: { deckId?: string } = $props();

  // svelte-ignore state_referenced_locally
  const deck = deckId ? app.deck(deckId) : undefined;
  let langFront = $state<ContentLang>(deck?.langFront ?? "en");
  let langBack = $state<ContentLang>(deck?.langBack ?? getLang());
  let progress = $state<OcrProgress | null>(null);
  let error = $state("");
  let input: HTMLInputElement | undefined = $state();

  /** Rough download size in MB: engine plus the language data. */
  const LANG_MB: Record<string, number> = { nld: 3, eng: 3, fra: 0.7, deu: 1.3, spa: 2.1, ita: 1.7, lat: 1.7 };
  const mb = $derived(Math.round(4 + tesseractLangs([langFront, langBack]).reduce((sum, l) => sum + (LANG_MB[l] ?? 2), 0)));

  async function choose() {
    const file = input?.files?.[0];
    error = "";
    if (!file) return;
    try {
      progress = { status: "loading", progress: 0 };
      const rows = await recognizeList(file, [langFront, langBack], (p) => (progress = p));
      progress = null;
      if (!rows.length) {
        error = t("photo.none");
        return;
      }
      setPendingImport({ text: rows.join("\n"), langFront, langBack, source: "photo" });
      location.hash = href.import(deckId);
    } catch (e) {
      console.error(e);
      progress = null;
      error = t("photo.failed");
    } finally {
      if (input) input.value = "";
    }
  }
</script>

<PageHead title={t("photo.title")} subtitle={t("photo.intro")} back={{ href: deck ? href.deck(deck.id) : href.newList(), label: t("common.back") }} />
<section class="photo">
  <div class="card card-pad box">
    <div class="art"></div>
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
      <label class="btn btn-primary btn-lg pick">
        <Icon name="camera" size={22} />{t("photo.choose")}
        <input class="visually-hidden" type="file" accept="image/*" bind:this={input} onchange={choose} />
      </label>
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <p class="small muted">{t("photo.firstTime", { mb })} {t("photo.handwriting")}</p>
  </div>
</section>

<style>
  .photo {
    display: grid;
    gap: 1rem;
    max-width: 640px;
  }
  .art {
    display: grid;
    justify-items: center;
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
</style>
