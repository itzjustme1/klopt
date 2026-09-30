<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import { app } from "../lib/app.svelte";
  import { parseBackup } from "../lib/backup";
  import { formatDay, localDay } from "../lib/dates";
  import type { Snapshot } from "../lib/db";
  import { readTextFile } from "../lib/files";
  import { backupErrorText } from "../lib/messages";
  import { isPersisted } from "../lib/persist";
  import { href } from "../lib/router";
  import { loadVoices } from "../lib/speech";
  import type { Lang, Theme } from "../lib/types";

  const GOALS = [10, 20, 30, 50, 100];

  let uiLang = $state<Lang>(app.settings.uiLang);
  let theme = $state<Theme>(app.settings.theme);
  let goal = $state(String(app.settings.dailyGoal));
  let autoSpeak = $state(app.settings.autoSpeak);

  let restoreError = $state("");
  // Raw, not deep state: IndexedDB cannot store Svelte proxies.
  let pending = $state.raw<Snapshot | null>(null);
  let confirmReplace = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  let resetText = $state("");
  const resetWord = $derived(t("settings.resetWord"));

  let persisted = $state<boolean | null>(null);
  let hasVoices = $state(true);
  $effect(() => {
    void isPersisted().then((p) => (persisted = p));
    void loadVoices().then(() => (hasVoices = typeof speechSynthesis !== "undefined" && speechSynthesis.getVoices().some((v) => v.localService)));
  });

  const lastExport = $derived(app.settings.lastExportAt ? formatDay(localDay(new Date(app.settings.lastExportAt)), getLang(), { day: "numeric", month: "long", year: "numeric" }) : null);

  async function exportBackup() {
    try {
      await app.exportBackup();
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
      app.showFlash(t("settings.merged", { decks: tp("common.decksCount", counts.decks), cards: tp("common.wordsCount", counts.cards) }));
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
      goal = String(app.settings.dailyGoal);
      autoSpeak = app.settings.autoSpeak;
      app.showFlash(t("settings.resetDone"));
      location.hash = href.today();
    } catch {
      app.showFlash(t("common.saveFailed"));
    }
  }
</script>

<section class="settings">
  <h1>{t("settings.title")}</h1>

  <div class="card group">
    <fieldset class="fieldset-wrap">
      <legend>{t("settings.lang")}</legend>
      <div class="segmented">
        <label><input type="radio" name="ui-lang" value="nl" bind:group={uiLang} onchange={() => app.setUiLang(uiLang)} /><span lang="nl">Nederlands</span></label>
        <label><input type="radio" name="ui-lang" value="en" bind:group={uiLang} onchange={() => app.setUiLang(uiLang)} /><span lang="en">English</span></label>
      </div>
    </fieldset>

    <fieldset class="fieldset-wrap">
      <legend>{t("settings.theme")}</legend>
      <div class="segmented">
        {#each ["system", "light", "dark"] as const as th (th)}
          <label><input type="radio" name="theme" value={th} bind:group={theme} onchange={() => app.setTheme(theme)} />{t(`theme.${th}`)}</label>
        {/each}
      </div>
    </fieldset>

    <fieldset class="fieldset-wrap">
      <legend>{t("settings.goal")}</legend>
      <div class="segmented">
        {#each GOALS as g (g)}
          <label><input type="radio" name="goal" value={String(g)} bind:group={goal} onchange={() => app.saveSettings({ dailyGoal: Number(goal) })} />{tp("settings.goalOption", g)}</label>
        {/each}
      </div>
    </fieldset>
  </div>

  <div class="card group" aria-labelledby="speech-title">
    <h2 id="speech-title">{t("settings.speech")}</h2>
    <label class="switch">
      <input type="checkbox" role="switch" bind:checked={autoSpeak} onchange={() => app.saveSettings({ autoSpeak })} disabled={!hasVoices} />
      <span class="track" aria-hidden="true"><span class="thumb"></span></span>
      <span>{t("settings.autoSpeak")}</span>
    </label>
    <p class="small muted">{hasVoices ? t("settings.speechNote") : t("settings.noVoices")}</p>
  </div>

  <div class="card group" aria-labelledby="backup-title">
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
      <div class="pending">
        <p>
          {t("settings.fileContains", {
            decks: tp("common.decksCount", pending.decks.length),
            cards: tp("common.wordsCount", pending.cards.length),
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
  </div>

  {#if persisted !== null}
    <div class="card group" aria-labelledby="storage-title">
      <h2 id="storage-title">{t("settings.storage")}</h2>
      <p class="muted">{persisted ? t("settings.persisted") : t("settings.notPersisted")}</p>
    </div>
  {/if}

  <div class="card group danger-zone" aria-labelledby="reset-title">
    <h2 id="reset-title">{t("settings.reset")}</h2>
    <p class="muted">{t("settings.resetIntro")}</p>
    <form class="reset" onsubmit={reset}>
      <div class="field">
        <label for="reset-word">{t("settings.resetType", { word: resetWord })}</label>
        <input id="reset-word" type="text" bind:value={resetText} autocomplete="off" autocapitalize="characters" spellcheck="false" />
      </div>
      <button type="submit" class="btn btn-bad" disabled={resetText.trim() !== resetWord}>{t("settings.resetYes")}</button>
    </form>
  </div>

  <div class="card group" aria-labelledby="about-title">
    <h2 id="about-title">{t("settings.about")}</h2>
    <p class="muted">{t("settings.aboutText")}</p>
  </div>
</section>

<style>
  .settings {
    display: grid;
    gap: 1rem;
    max-width: 760px;
  }
  .group {
    display: grid;
    gap: 1rem;
    padding: 1.25rem;
    justify-items: start;
  }
  .group > p {
    max-width: 40rem;
  }
  .restore {
    width: 100%;
  }
  .pending {
    display: grid;
    gap: 1rem;
    width: 100%;
  }
  .options {
    display: grid;
    gap: 1rem;
  }
  .options > div {
    display: grid;
    gap: 0.5rem;
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
    width: 100%;
    max-width: 22rem;
  }
  .reset .field {
    width: 100%;
  }
  .danger-zone h2 {
    color: var(--bad);
  }

  .switch {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    min-height: var(--tap);
    font-weight: 700;
    cursor: pointer;
  }
  .switch input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .track {
    position: relative;
    width: 52px;
    height: 32px;
    border-radius: var(--r-pill);
    background: var(--line-strong);
    transition: background-color var(--t-base) var(--ease);
    flex: none;
  }
  .thumb {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: none;
    transition: transform var(--t-base) var(--ease);
  }
  .switch input:checked + .track {
    background: var(--accent);
  }
  .switch input:checked + .track .thumb {
    transform: translateX(20px);
  }
  .switch input:focus-visible + .track {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .switch input:disabled + .track {
    opacity: 0.5;
  }
</style>
