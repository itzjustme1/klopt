<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import type { Lang } from "../lib/types";

  type Values = { name: string; lang: Lang; subject: string };
  let {
    initial,
    submitLabel,
    onsubmit,
    oncancel,
  }: { initial: Values; submitLabel: string; onsubmit: (v: Values) => Promise<void>; oncancel: () => void } = $props();

  const uid = crypto.randomUUID().slice(0, 8);
  // svelte-ignore state_referenced_locally
  let name = $state(initial.name);
  // svelte-ignore state_referenced_locally
  let lang = $state<Lang>(initial.lang);
  // svelte-ignore state_referenced_locally
  let subject = $state(initial.subject);
  let error = $state("");
  let busy = $state(false);
  let nameInput: HTMLInputElement | undefined = $state();

  $effect(() => {
    nameInput?.focus();
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return void (error = t("decks.nameRequired"));
    if (n.length > LIMITS.deckNameChars) return void (error = t("decks.nameTooLong", { n: LIMITS.deckNameChars }));
    error = "";
    busy = true;
    try {
      await onsubmit({ name: n, lang, subject: subject.trim().slice(0, LIMITS.labelChars) });
    } catch {
      error = t("common.saveFailed");
    } finally {
      busy = false;
    }
  }
</script>

<form class="stack" style:--gap="0.875rem" onsubmit={submit} novalidate>
  <div class="field">
    <label for="name-{uid}">{t("decks.name")}</label>
    <input
      id="name-{uid}"
      type="text"
      bind:value={name}
      bind:this={nameInput}
      maxlength={LIMITS.deckNameChars}
      autocomplete="off"
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error ? `err-${uid}` : undefined}
    />
  </div>
  <div class="field">
    <label for="subject-{uid}">{t("decks.subject")}</label>
    <input id="subject-{uid}" type="text" bind:value={subject} list="subjects-{uid}" maxlength={LIMITS.labelChars} autocomplete="off" />
    <datalist id="subjects-{uid}">
      <option value="Economie"></option>
      <option value="Bedrijfseconomie"></option>
      <option value="Informatica"></option>
    </datalist>
  </div>
  <fieldset class="choice">
    <legend>{t("decks.lang")}</legend>
    <label><input type="radio" name="lang-{uid}" value="nl" bind:group={lang} />{t("lang.nl")}</label>
    <label><input type="radio" name="lang-{uid}" value="en" bind:group={lang} />{t("lang.en")}</label>
  </fieldset>
  {#if error}<p class="error" id="err-{uid}" role="alert">{error}</p>{/if}
  <div class="row">
    <button type="submit" class="btn btn-primary" disabled={busy}>{submitLabel}</button>
    <button type="button" class="btn" onclick={oncancel}>{t("common.cancel")}</button>
  </div>
</form>
