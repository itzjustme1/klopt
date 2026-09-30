<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import { app } from "../lib/app.svelte";
  import { isIosSafari, isStandalone } from "../lib/persist";
  import { promptInstall, pwa } from "../lib/pwa.svelte";
  import Icon from "./Icon.svelte";

  /** Home-screen nudges: install the app, and make a backup after many changes. */
  const standalone = isStandalone();
  const ios = isIosSafari();
  const showInstall = $derived(!standalone && !app.settings.installHintDismissed && app.decks.length > 0 && (ios || pwa.canInstall));
  const unsaved = $derived(app.settings.changesSinceExport);
  const showReminder = $derived(!showInstall && unsaved - app.settings.reminderSnoozedAt >= LIMITS.backupReminderChanges);

  async function exportNow() {
    try {
      await app.exportBackup();
    } catch {
      app.showFlash(t("common.saveFailed"));
    }
  }
</script>

{#if showInstall}
  <div class="banner card" role="region" aria-label={t("install.button")}>
    <span class="ic-round ic-1 b-ic"><Icon name="plus" size={22} /></span>
    <div class="b-body">
      <p>{ios ? t("install.ios") : t("install.text")}</p>
      <div class="row">
        {#if !ios}<button type="button" class="btn btn-primary" onclick={promptInstall}>{t("install.button")}</button>{/if}
        <button type="button" class="btn btn-quiet" onclick={() => app.saveSettings({ installHintDismissed: true })}>{t("install.dismiss")}</button>
      </div>
    </div>
  </div>
{/if}

{#if showReminder}
  <div class="banner callout" role="region" aria-label={t("settings.backup")}>
    <span class="ic-round b-ic b-yellow"><Icon name="file" size={22} /></span>
    <div class="b-body">
      <p>{tp("reminder.text", unsaved)}</p>
      <div class="row">
        <button type="button" class="btn btn-primary" onclick={exportNow}>{t("settings.export")}</button>
        <button type="button" class="btn btn-quiet" onclick={() => app.saveSettings({ reminderSnoozedAt: unsaved })}>{t("common.later")}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.25rem;
  }
  .b-ic {
    width: 44px;
    height: 44px;
  }
  .b-yellow {
    background: var(--yellow);
    color: var(--on-light);
  }
  .b-body {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  }
  .b-body p {
    max-width: 36rem;
    font-weight: 400;
  }
  .b-body .row {
    gap: 0.25rem 0.5rem;
  }
</style>
