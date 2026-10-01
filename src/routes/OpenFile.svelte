<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import PageHead from "../components/PageHead.svelte";
  import SharedPreview from "../components/SharedPreview.svelte";
  import { parseShared, type SharedDeck } from "../lib/backup";
  import { readTextFile } from "../lib/files";
  import { backupErrorText } from "../lib/messages";
  import { href } from "../lib/router";

  let error = $state("");
  let shared = $state.raw<SharedDeck | null>(null);
  let input: HTMLInputElement | undefined = $state();

  async function choose() {
    const file = input?.files?.[0];
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

<PageHead title={t("new.file")} subtitle={t("new.fileDesc")} back={{ href: href.newList(), label: t("common.back") }} />
<section class="open">
  {#if !shared}
    <div class="field card card-pad">
      <label for="receive-file">{t("receive.choose")}</label>
      <input id="receive-file" type="file" accept="application/json,.json" bind:this={input} onchange={choose} />
    </div>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if shared}<SharedPreview {shared} oncancel={cancel} />{/if}
</section>

<style>
  .open {
    display: grid;
    gap: 1rem;
    max-width: 720px;
  }
</style>
