<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { ACCENTS } from "../lib/accents";
  import type { ContentLang } from "../lib/types";

  /** Buttons for hard-to-type characters. `oninsert` receives the character; focus stays in the input. */
  let { lang, oninsert }: { lang: ContentLang; oninsert: (ch: string) => void } = $props();
  const chars = $derived(ACCENTS[lang] ?? []);
</script>

{#if chars.length}
  <div class="accents" role="group" aria-label={t("editor.accents")}>
    {#each chars as ch (ch)}
      <button
        type="button"
        class="acc"
        aria-label={t("editor.insert", { char: ch })}
        onpointerdown={(e) => e.preventDefault()}
        onclick={() => oninsert(ch)}>{ch}</button
      >
    {/each}
  </div>
{/if}

<style>
  .accents {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
  .acc {
    min-width: var(--tap);
    min-height: var(--tap);
    padding: 0 0.5rem;
    border: 2px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    font-size: 1.0625rem;
    cursor: pointer;
    box-shadow: 0 2px 0 var(--line);
    transition: transform var(--t-press) var(--ease), box-shadow var(--t-press) var(--ease);
  }
  .acc:hover {
    border-color: var(--line-strong);
  }
  .acc:active {
    transform: translateY(2px);
    box-shadow: 0 0 0 var(--line);
  }
</style>
