<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import { app } from "../lib/app.svelte";
  import Sheet from "./Sheet.svelte";

  /** "Naar map verplaatsen": pick an existing folder, type a new one, or take it out of its folder. */
  let { current = "", onpick, onclose }: { current?: string; onpick: (folder: string) => void; onclose: () => void } = $props();

  const names = $derived(app.folders().map((f) => f.name));
  let choice = $state(untrack(() => current));
  let fresh = $state("");
  /** The "new folder" choice; a name can never contain this character. */
  const NEW = "\u0000new";
  const id = $props.id();

  function submit(e: SubmitEvent) {
    e.preventDefault();
    onpick(choice === NEW ? fresh.trim() : choice);
  }
</script>

<Sheet title={t("folder.move")} {onclose}>
  <form class="pick" onsubmit={submit}>
    <fieldset class="fieldset-wrap">
      <legend class="visually-hidden">{t("folder.move")}</legend>
      <div class="opts">
        {#each names as n (n)}
          <label class="opt"><input type="radio" name="{id}-f" value={n} bind:group={choice} />{n}</label>
        {/each}
        <label class="opt"><input type="radio" name="{id}-f" value={NEW} bind:group={choice} />{t("folder.newOne")}</label>
        {#if choice === NEW}
          <div class="field">
            <label class="visually-hidden" for="{id}-name">{t("folder.name")}</label>
            <!-- svelte-ignore a11y_autofocus -->
            <input id="{id}-name" type="text" bind:value={fresh} maxlength={LIMITS.labelChars} placeholder={t("folder.namePlaceholder")} autocomplete="off" autofocus />
          </div>
        {/if}
        {#if current}
          <label class="opt"><input type="radio" name="{id}-f" value="" bind:group={choice} />{t("folder.noFolder")}</label>
        {/if}
      </div>
    </fieldset>
    <button type="submit" class="btn btn-primary" disabled={choice === NEW && !fresh.trim()}>{t("folder.moveHere")}</button>
  </form>
</Sheet>

<style>
  .pick {
    display: grid;
    gap: 1rem;
    padding: 0.75rem 1.25rem 0.5rem;
  }
  .opts {
    display: grid;
    gap: 0.25rem;
  }
  .opt {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: var(--tap);
    padding: 0 0.75rem;
    border-radius: var(--r-sm);
    font-weight: 700;
    cursor: pointer;
  }
  .opt:has(input:checked) {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .opt input {
    accent-color: var(--accent);
    width: 18px;
    height: 18px;
  }
</style>
