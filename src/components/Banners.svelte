<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import { app } from "../lib/app.svelte";
  import { isIosSafari, isStandalone } from "../lib/persist";
  import { promptInstall, pwa } from "../lib/pwa.svelte";

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

{#if showInstall || showReminder}
  <div class="banners">
    {#if showInstall}
      <div class="banner card card-pad" role="region" aria-label={t("install.button")}>
        <p>{ios ? t("install.ios") : t("install.text")}</p>
        <div class="row">
          {#if !ios}<button type="button" class="btn btn-primary" onclick={promptInstall}>{t("install.button")}</button>{/if}
          <button type="button" class="btn btn-quiet" onclick={() => app.saveSettings({ installHintDismissed: true })}>{t("install.dismiss")}</button>
        </div>
      </div>
    {/if}
    {#if showReminder}
      <div class="banner card card-pad" role="region" aria-label={t("settings.backup")}>
        <p>{tp("reminder.text", unsaved)}</p>
        <div class="row">
          <button type="button" class="btn btn-primary" onclick={exportNow}>{t("settings.export")}</button>
          <button type="button" class="btn btn-quiet" onclick={() => app.saveSettings({ reminderSnoozedAt: unsaved })}>{t("common.later")}</button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .banner {
    display: grid;
    gap: 0.75rem;
  }
  .banner p {
    max-width: 36rem;
  }
</style>
