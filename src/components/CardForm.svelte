<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import type { Lang } from "../lib/types";

  type Values = { front: string; back: string; topic?: string };
  let {
    lang,
    initial,
    submitLabel,
    autofocus = false,
    onsubmit,
    oncancel,
  }: {
    lang: Lang;
    initial?: Values;
    submitLabel: string;
    autofocus?: boolean;
    onsubmit: (v: Values) => Promise<void>;
    oncancel?: () => void;
  } = $props();

  const uid = crypto.randomUUID().slice(0, 8);
  // svelte-ignore state_referenced_locally
  let front = $state(initial?.front ?? "");
  // svelte-ignore state_referenced_locally
  let back = $state(initial?.back ?? "");
  // svelte-ignore state_referenced_locally
  let topic = $state(initial?.topic ?? "");
  let error = $state("");
  let busy = $state(false);
  let frontEl: HTMLTextAreaElement | undefined = $state();

  $effect(() => {
    if (autofocus) frontEl?.focus();
  });

  async function submit(e?: Event) {
    e?.preventDefault();
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) return void (error = t("deck.bothSides"));
    if (f.length > LIMITS.sideChars || b.length > LIMITS.sideChars) return void (error = t("deck.tooLong", { n: LIMITS.sideChars }));
    error = "";
    busy = true;
    try {
      const v: Values = { front: f, back: b };
      const tp = topic.trim().slice(0, LIMITS.labelChars);
      if (tp) v.topic = tp;
      await onsubmit(v);
    } catch {
      error = t("common.saveFailed");
    } finally {
      busy = false;
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e);
    if (e.key === "Escape" && oncancel) oncancel();
  }
</script>

<form class="stack" style:--gap="0.875rem" onsubmit={submit} novalidate>
  <div class="field">
    <label for="front-{uid}">{t("deck.front")}</label>
    <textarea id="front-{uid}" rows="2" bind:value={front} bind:this={frontEl} {lang} {onkeydown} maxlength={LIMITS.sideChars}></textarea>
  </div>
  <div class="field">
    <label for="back-{uid}">{t("deck.back.label")}</label>
    <textarea id="back-{uid}" rows="3" bind:value={back} {lang} {onkeydown} maxlength={LIMITS.sideChars}></textarea>
  </div>
  <div class="field">
    <label for="topic-{uid}">{t("deck.topic")}</label>
    <input id="topic-{uid}" type="text" bind:value={topic} {lang} maxlength={LIMITS.labelChars} autocomplete="off" />
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="row">
    <button type="submit" class="btn btn-primary" disabled={busy}>{submitLabel}</button>
    {#if oncancel}<button type="button" class="btn" onclick={oncancel}>{t("common.cancel")}</button>{/if}
  </div>
</form>

<style>
  textarea {
    font-family: var(--font-card);
    font-size: 1.0625rem;
  }
</style>
