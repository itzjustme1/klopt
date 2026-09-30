<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { APP_NAME, LIMITS } from "../config";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import { app } from "../lib/app.svelte";
  import { backupFileName, makeBackup, parseBackup } from "../lib/backup";
  import { formatDay, localDay } from "../lib/dates";
  import type { Snapshot } from "../lib/db";
  import { downloadText, readTextFile } from "../lib/files";
  import { backupErrorText } from "../lib/messages";
  import { isPersisted } from "../lib/persist";
  import { href } from "../lib/router";
  import type { Lang, Theme } from "../lib/types";

  let uiLang = $state<Lang>(app.settings.uiLang);
  let theme = $state<Theme>(app.settings.theme);

  let restoreError = $state("");
  // Raw, not deep state: IndexedDB cannot store Svelte proxies.
  let pending = $state.raw<Snapshot | null>(null);
  let confirmReplace = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  let resetText = $state("");
  const resetWord = $derived(t("settings.resetWord"));

  let persisted = $state<boolean | null>(null);
  $effect(() => {
    void isPersisted().then((p) => (persisted = p));
  });

  const lastExport = $derived(app.settings.lastExportAt ? formatDay(localDay(new Date(app.settings.lastExportAt)), getLang(), { day: "numeric", month: "long", year: "numeric" }) : null);

  async function exportBackup() {
    try {
      const data = await app.snapshot();
      downloadText(backupFileName(APP_NAME), JSON.stringify(makeBackup(data)));
      await app.markExported();
    } catch {
      app.showFlash(t("common.saveFailed"));
    }
  }

  async function chooseFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    restoreError = "";
    pending = null;
    confirmReplace = false;
    if (!file) return;
    const read = await readTextFile(file, LIMITS.backupBytes);
    if (!read.ok) {
      restoreError = backupErrorText({ code: read.reason });
      return;
    }
    const parsed = parseBackup(read.text);
    if (!parsed.ok) restoreError = backupErrorText(parsed.error);
    else pending = parsed.data;
  }

  function clearPending() {
    pending = null;
    confirmReplace = false;
    if (fileInput) fileInput.value = "";
  }

  async function merge() {
    if (!pending) return;
    try {
      const counts = await app.merge(pending);
      clearPending();
      app.showFlash(t("settings.merged", { decks: tp("common.decksCount", counts.decks), cards: tp("common.cardsCount", counts.cards) }));
    } catch {
      restoreError = t("common.saveFailed");
    }
  }

  async function replace() {
    if (!pending) return;
    try {
      await app.replaceAll(pending);
      clearPending();
      app.showFlash(t("settings.restored"));
    } catch {
      restoreError = t("common.saveFailed");
    }
  }

  async function reset(e: SubmitEvent) {
    e.preventDefault();
    if (resetText.trim() !== resetWord) return;
    try {
      await app.wipe();
      resetText = "";
      uiLang = app.settings.uiLang;
      theme = app.settings.theme;
      app.showFlash(t("settings.resetDone"));
      location.hash = href.today();
    } catch {
      app.showFlash(t("common.saveFailed"));
    }
  }
</script>

<section class="settings">
  <h1>{t("settings.title")}</h1>

  <section class="group">
    <fieldset class="choice">
      <legend>{t("settings.lang")}</legend>
      <label><input type="radio" name="ui-lang" value="nl" bind:group={uiLang} onchange={() => app.setUiLang(uiLang)} /><span lang="nl">Nederlands</span></label>
      <label><input type="radio" name="ui-lang" value="en" bind:group={uiLang} onchange={() => app.setUiLang(uiLang)} /><span lang="en">English</span></label>
    </fieldset>
  </section>

  <section class="group">
    <fieldset class="choice">
      <legend>{t("settings.theme")}</legend>
      {#each ["system", "light", "dark"] as const as th (th)}
        <label><input type="radio" name="theme" value={th} bind:group={theme} onchange={() => app.setTheme(theme)} />{t(`theme.${th}`)}</label>
      {/each}
    </fieldset>
  </section>

  <section class="group" aria-labelledby="backup-title">
    <h2 id="backup-title">{t("settings.backup")}</h2>
    <p class="muted">{t("settings.backupIntro")}</p>
    <p class="small">{lastExport ? t("settings.lastExport", { date: lastExport }) : t("settings.neverExported")}</p>
    <div class="row">
      <button type="button" class="btn btn-primary" onclick={exportBackup}>{t("settings.export")}</button>
    </div>

    <div class="field restore">
      <label for="restore-file">{t("settings.restore")}</label>
      <input id="restore-file" type="file" accept="application/json,.json" bind:this={fileInput} onchange={chooseFile} aria-describedby="restore-help" />
      <span id="restore-help" class="small muted">{t("settings.chooseFile")}</span>
    </div>
    {#if restoreError}<p class="error" role="alert">{restoreError}</p>{/if}

    {#if pending}
      <div class="panel pending">
        <p>
          {t("settings.fileContains", {
            decks: tp("common.decksCount", pending.decks.length),
            cards: tp("common.cardsCount", pending.cards.length),
            reviews: tp("common.reviewsCount", pending.reviews.length),
          })}
        </p>
        {#if confirmReplace}
          <ConfirmInline message={t("settings.replaceConfirm")} confirmLabel={t("settings.replaceYes")} onconfirm={replace} oncancel={() => (confirmReplace = false)} />
        {:else}
          <div class="options">
            <div>
              <button type="button" class="btn" onclick={merge}>{t("settings.merge")}</button>
              <p class="small muted">{t("settings.mergeHelp")}</p>
            </div>
            <div>
              <button type="button" class="btn btn-danger" onclick={() => (confirmReplace = true)}>{t("settings.replace")}</button>
              <p class="small muted">{t("settings.replaceHelp")}</p>
            </div>
          </div>
          <button type="button" class="btn btn-quiet" onclick={clearPending}>{t("common.cancel")}</button>
        {/if}
      </div>
    {/if}
  </section>

  {#if persisted !== null}
    <section class="group" aria-labelledby="storage-title">
      <h2 id="storage-title">{t("settings.storage")}</h2>
      <p class="muted">{persisted ? t("settings.persisted") : t("settings.notPersisted")}</p>
    </section>
  {/if}

  <section class="group danger-zone" aria-labelledby="reset-title">
    <h2 id="reset-title">{t("settings.reset")}</h2>
    <p class="muted">{t("settings.resetIntro")}</p>
    <form class="reset" onsubmit={reset}>
      <div class="field">
        <label for="reset-word">{t("settings.resetType", { word: resetWord })}</label>
        <input id="reset-word" type="text" bind:value={resetText} autocomplete="off" autocapitalize="characters" spellcheck="false" />
      </div>
      <button type="submit" class="btn btn-danger" disabled={resetText.trim() !== resetWord}>{t("settings.resetYes")}</button>
    </form>
  </section>

  <section class="group" aria-labelledby="about-title">
    <h2 id="about-title">{t("settings.about")}</h2>
    <p class="muted">{t("settings.aboutText")}</p>
  </section>
</section>

<style>
  .settings {
    display: grid;
    gap: 0;
  }
  .settings > h1 {
    margin-bottom: 1rem;
  }
  .group {
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem 0;
    border-top: 1px solid var(--line);
  }
  .group > p {
    max-width: 38rem;
  }
  .restore {
    margin-top: 0.75rem;
  }
  .pending {
    display: grid;
    gap: 1rem;
  }
  .options {
    display: grid;
    gap: 1rem;
  }
  .options > div {
    display: grid;
    gap: 0.375rem;
    justify-items: start;
  }
  @media (min-width: 560px) {
    .options {
      grid-template-columns: 1fr 1fr;
    }
  }
  .reset {
    display: grid;
    gap: 0.75rem;
    justify-items: start;
    max-width: 22rem;
  }
  .reset .field {
    width: 100%;
  }
  .danger-zone h2 {
    color: var(--accent);
  }
</style>
