<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import { app } from "../lib/app.svelte";
  import { isIosSafari, isStandalone } from "../lib/persist";
  import { applyUpdate, promptInstall, pwa } from "../lib/pwa.svelte";

  const onHome = $derived(app.route.name === "today");
  const inReview = $derived(app.route.name === "practice");

  const standalone = isStandalone();
  const ios = isIosSafari();

  const showInstall = $derived(
    onHome && !standalone && !app.settings.installHintDismissed && app.decks.length > 0 && (ios || pwa.canInstall),
  );
  const unsaved = $derived(app.settings.changesSinceExport);
  const showReminder = $derived(onHome && !showInstall && unsaved - app.settings.reminderSnoozedAt >= LIMITS.backupReminderChanges);

  async function exportNow() {
    try {
      await app.exportBackup();
    } catch {
      app.showFlash(t("common.saveFailed"));
    }
  }
</script>

{#if pwa.needRefresh && !inReview}
  <div class="banner" role="status">
    <p>{t("pwa.update")}</p>
    <button type="button" class="btn btn-primary" onclick={applyUpdate}>{t("pwa.reload")}</button>
  </div>
{/if}

{#if showInstall}
  <div class="banner" role="region" aria-label={t("install.button")}>
    <p>{ios ? t("install.ios") : t("install.text")}</p>
    <div class="row">
      {#if !ios}<button type="button" class="btn btn-primary" onclick={promptInstall}>{t("install.button")}</button>{/if}
      <button type="button" class="btn btn-quiet" onclick={() => app.saveSettings({ installHintDismissed: true })}>{t("install.dismiss")}</button>
    </div>
  </div>
{/if}

{#if showReminder}
  <div class="banner" role="region" aria-label={t("settings.backup")}>
    <p>{tp("reminder.text", unsaved)}</p>
    <div class="row">
      <button type="button" class="btn btn-primary" onclick={exportNow}>{t("settings.export")}</button>
      <button type="button" class="btn btn-quiet" onclick={() => app.saveSettings({ reminderSnoozedAt: unsaved })}>{t("common.later")}</button>
    </div>
  </div>
{/if}

<style>
  .banner {
    display: grid;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    padding: 1rem 1.25rem;
    background: var(--accent-soft);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
  }
  .banner p {
    max-width: 36rem;
  }
  .banner .row {
    gap: 0.25rem 0.5rem;
  }
</style>
