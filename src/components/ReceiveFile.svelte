<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import SharedPreview from "./SharedPreview.svelte";
  import { parseShared, type SharedDeck } from "../lib/backup";
  import { readTextFile } from "../lib/files";
  import { backupErrorText } from "../lib/messages";

  let error = $state("");
  let shared = $state.raw<SharedDeck | null>(null);
  let input: HTMLInputElement | undefined = $state();

  async function choose(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    error = "";
    shared = null;
    if (!file) return;
    const read = await readTextFile(file, LIMITS.backupBytes);
    if (!read.ok) return void (error = backupErrorText({ code: read.reason }));
    const parsed = parseShared(read.text);
    if (parsed.ok) shared = parsed.data;
    else error = backupErrorText(parsed.error);
  }

  function cancel() {
    shared = null;
    if (input) input.value = "";
  }
</script>

<section class="receive" aria-labelledby="receive-file-title">
  <h2 id="receive-file-title">{t("decks.openShared")}</h2>
  <div class="field">
    <label for="receive-file" class="small muted">{t("decks.openSharedHelp")}</label>
    <input id="receive-file" type="file" accept="application/json,.json" bind:this={input} onchange={choose} />
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if shared}<SharedPreview {shared} oncancel={cancel} />{/if}
</section>

<style>
  .receive {
    display: grid;
    gap: 0.75rem;
    margin-top: 2rem !important;
    padding-top: 1.5rem;
    border-top: 1px solid var(--line);
  }
  .receive .field > label {
    font-weight: 400;
  }
</style>
