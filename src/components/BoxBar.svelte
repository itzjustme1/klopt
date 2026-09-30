<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import type { BoxCounts } from "../lib/app.svelte";
  import { DAYS } from "../lib/scheduler";

  let { counts }: { counts: BoxCounts } = $props();
  const total = $derived(counts.reduce((a, b) => a + b, 0));
</script>

<div class="boxbar">
  <div class="bar-5" aria-hidden="true">
    {#each counts as n, i (i)}
      {#if n > 0}<span class="seg b{i + 1}" style:flex-grow={n}></span>{/if}
    {/each}
    {#if total === 0}<span class="seg empty"></span>{/if}
  </div>
  <ol class="legend" aria-label={t("box.distribution")}>
    {#each counts as n, i (i)}
      <li>
        <span class="swatch b{i + 1}" aria-hidden="true"></span>
        <span class="caption">{t("box.label", { n: i + 1 })}</span>
        <span class="num small">{n}</span>
        <span class="visually-hidden">, {t("box.interval", { n: DAYS[i]! })}</span>
      </li>
    {/each}
  </ol>
</div>

<style>
  .bar-5 {
    display: flex;
    gap: 3px;
    height: 12px;
  }
  .seg {
    flex-basis: 0;
    min-width: 8px;
    border-radius: var(--r-pill);
  }
  .empty {
    flex-grow: 1;
    background: var(--surface-2);
  }
  .b1 { background: var(--b1); }
  .b2 { background: var(--b2); }
  .b3 { background: var(--b3); }
  .b4 { background: var(--b4); }
  .b5 { background: var(--b5); }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
    color: var(--ink-2);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .legend .num {
    color: var(--ink);
    font-weight: 700;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: var(--r-pill);
  }
</style>
