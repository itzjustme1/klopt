<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import Icon from "../components/Icon.svelte";
  import { account, accountsEnabled } from "../lib/account.svelte";
  import PageHead from "../components/PageHead.svelte";
  import Switch from "../components/Switch.svelte";
  import { app } from "../lib/app.svelte";
  import { parseBackup } from "../lib/backup";
  import { formatDay, localDay } from "../lib/dates";
  import type { Snapshot } from "../lib/db";
  import { downloadText, readTextFile } from "../lib/files";
  import { calendarFile } from "../lib/planner";
  import { backupErrorText } from "../lib/messages";
  import { isPersisted } from "../lib/persist";
  import { href } from "../lib/router";
  import { loadVoices } from "../lib/speech";
  import type { Lang, Theme } from "../lib/types";

  const GOALS = [10, 20, 30, 50, 100];

  let uiLang = $state<Lang>(app.settings.uiLang);
  let theme = $state<Theme>(app.settings.theme);
  let goal = $state(String(app.settings.dailyGoal));
  // A daily reminder through the calendar: the only reliable way for a web app without a server.
  let reminderTime = $state("19:00");
  function addReminder() {
    const ics = calendarFile(t("reminder.calendar"), [{ uid: "daily-reminder@klopt", day: localDay(), title: t("reminder.title"), description: t("reminder.body", { goal: app.settings.dailyGoal }), time: reminderTime, minutes: 15, daily: true, remind: true }], new Date());
    downloadText("klopt-herinnering.ics", ics, "text/calendar");
    app.showFlash(t("reminder.made"));
  }
  let autoSpeak = $state(app.settings.autoSpeak);
  let lenientAccents = $state(app.settings.lenientAccents);
  let lenientTypos = $state(app.settings.lenientTypos);
  let sounds = $state(app.settings.sounds);

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
      lenientAccents = app.settings.lenientAccents;
      lenientTypos = app.settings.lenientTypos;
      sounds = app.settings.sounds;
      app.showFlash(t("settings.resetDone"));
      location.hash = href.today();
    } catch {
      app.showFlash(t("common.saveFailed"));
    }
  }
</script>

<PageHead title={t("settings.title")} />
<section class="settings">
  {#if accountsEnabled}
    <a class="card account-row" href={href.account()}>
      <span class="avatar" aria-hidden="true">{account.profile ? account.profile.display_name.slice(0, 1).toUpperCase() : "?"}</span>
      <span class="row-main">
        <span class="row-title">{account.user ? (account.profile?.display_name ?? account.user.email) : t("account.signInOrUp")}</span>
        <span class="row-sub">{account.user ? t("account.syncOn") : t("account.why")}</span>
      </span>
      <Icon name="chevron" size={20} />
    </a>
  {/if}
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
        {#each ["light", "dark", "system"] as const as th (th)}
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

    <div class="reminder">
      <div class="field">
        <label for="reminder-time">{t("reminder.label")}</label>
        <input id="reminder-time" type="time" bind:value={reminderTime} />
      </div>
      <button type="button" class="btn" disabled={!reminderTime} onclick={addReminder}><Icon name="calendar" size={18} />{t("reminder.add")}</button>
      <p class="small muted">{t("reminder.help")}</p>
    </div>
  </div>

  <div class="card group" aria-labelledby="checking-title">
    <h2 id="checking-title">{t("settings.checking")}</h2>
    <Switch bind:checked={lenientAccents} label={t("settings.lenientAccents")} help={t("settings.lenientAccentsHelp")} onchange={(v) => app.saveSettings({ lenientAccents: v })} />
    <Switch bind:checked={lenientTypos} label={t("settings.lenientTypos")} help={t("settings.lenientTyposHelp")} onchange={(v) => app.saveSettings({ lenientTypos: v })} />
  </div>

  <div class="card group" aria-labelledby="speech-title">
    <h2 id="speech-title">{t("settings.speech")}</h2>
    <Switch bind:checked={sounds} label={t("settings.sounds")} help={t("settings.soundsHelp")} onchange={(v) => app.saveSettings({ sounds: v })} />
    <Switch bind:checked={autoSpeak} label={t("settings.autoSpeak")} help={hasVoices ? t("settings.speechNote") : t("settings.noVoices")} disabled={!hasVoices} onchange={(v) => app.saveSettings({ autoSpeak: v })} />
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
    <a class="btn" href={href.help()}>{t("help.link")}</a>
    <p class="muted">{t("settings.aboutText")}</p>
    <p class="small muted">{t("settings.version", { v: __APP_VERSION__ })}</p>
  </div>
</section>

<style>
  .reminder {
    justify-self: stretch;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.5rem 0.75rem;
  }
  .reminder .field {
    flex: 1 1 10rem;
    max-width: 14rem;
  }
  .reminder p {
    flex-basis: 100%;
  }
  .account-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
    color: var(--ink);
    text-decoration: none;
  }
  .avatar {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex: none;
    border-radius: 50%;
    background: var(--brand);
    color: var(--on-brand);
    font-weight: 900;
  }
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

</style>
