<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import type { BoxCounts } from "../lib/app.svelte";

  let { counts }: { counts: BoxCounts } = $props();

  const total = $derived(counts.reduce((a, b) => a + b, 0));
</script>

<div class="boxbar">
  <div class="bar" aria-hidden="true">
    {#each counts as n, i (i)}
      {#if n > 0}
        <span class="seg b{i + 1}" style:flex-grow={n} title={t("box.summary", { box: i + 1, count: n })}></span>
      {/if}
    {/each}
    {#if total === 0}
      <span class="seg empty"></span>
    {/if}
  </div>
  <ol class="legend mono" aria-label={t("box.distribution")}>
    {#each counts as n, i (i)}
      <li><span class="swatch b{i + 1}" aria-hidden="true"></span><span class="visually-hidden">{t("box.label", { n: i + 1 })}: </span>{n}</li>
    {/each}
  </ol>
</div>

<style>
  .bar {
    display: flex;
    height: 0.625rem;
    border: 1px solid var(--line);
    border-radius: 2px;
    overflow: hidden;
    background: var(--surface-2);
  }
  .seg {
    flex-basis: 0;
    min-width: 3px;
  }
  .seg + .seg {
    border-left: 1px solid var(--surface);
  }
  .empty {
    flex-grow: 1;
  }
  .b1 { background: var(--b1); }
  .b2 { background: var(--b2); }
  .b3 { background: var(--b3); }
  .b4 { background: var(--b4); }
  .b5 { background: var(--b5); }
  .legend {
    display: flex;
    gap: 0.875rem;
    margin: 0.375rem 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.75rem;
    color: var(--ink-2);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .swatch {
    width: 0.5rem;
    height: 0.5rem;
    border: 1px solid var(--line);
  }
</style>
