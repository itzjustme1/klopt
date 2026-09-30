<script lang="ts">
  import { t } from "../i18n/index.svelte";

  let {
    message,
    confirmLabel,
    onconfirm,
    oncancel,
  }: { message: string; confirmLabel: string; onconfirm: () => void | Promise<void>; oncancel: () => void } = $props();

  let busy = $state(false);
  let box: HTMLElement | undefined = $state();

  $effect(() => {
    box?.querySelector<HTMLButtonElement>("button")?.focus();
  });

  async function confirm() {
    busy = true;
    try {
      await onconfirm();
    } finally {
      busy = false;
    }
  }
</script>

<div class="confirm" role="alertdialog" aria-label={message} bind:this={box}>
  <p>{message}</p>
  <div class="row">
    <button type="button" class="btn" onclick={oncancel}>{t("common.cancel")}</button>
    <button type="button" class="btn btn-danger solid" disabled={busy} onclick={confirm}>{confirmLabel}</button>
  </div>
</div>

<style>
  .confirm {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: var(--surface);
  }
</style>
