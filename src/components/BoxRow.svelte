<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import type { BoxCounts } from "../lib/app.svelte";
  import { DAYS } from "../lib/scheduler";

  let { counts, current, flash }: { counts: BoxCounts; current?: number; flash?: { box: number; key: number } } = $props();
</script>

<ol class="boxes" aria-label={t("box.distribution")}>
  {#each counts as n, i (i)}
    {@const box = i + 1}
    {#key flash?.box === box ? flash.key : 0}
      <li class="box b{box}" class:current={current === box} class:flash={flash?.box === box && flash.key > 0}>
        <span class="label">{t("box.label", { n: box })}</span>
        <span class="count mono">{n}</span>
        <span class="interval mono" title={tp("box.intervalLong", DAYS[i]!)}>
          <span aria-hidden="true">{t("box.interval", { n: DAYS[i]! })}</span>
          <span class="visually-hidden">, {tp("common.cardsCount", n)}, {tp("box.intervalLong", DAYS[i]!)}</span>
        </span>
      </li>
    {/key}
  {/each}
</ol>

<style>
  .boxes {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.375rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .box {
    display: grid;
    justify-items: center;
    gap: 0.125rem;
    padding: 0.5rem 0.25rem 0.375rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-top-width: 4px;
    border-radius: var(--radius);
    min-width: 0;
  }
  .b1 { border-top-color: var(--b1); }
  .b2 { border-top-color: var(--b2); }
  .b3 { border-top-color: var(--b3); }
  .b4 { border-top-color: var(--b4); }
  .b5 { border-top-color: var(--b5); }
  .current {
    border-color: var(--ink);
    border-top-width: 4px;
  }
  .b1.current { border-top-color: var(--b1); }
  .b2.current { border-top-color: var(--b2); }
  .b3.current { border-top-color: var(--b3); }
  .b4.current { border-top-color: var(--b4); }
  .b5.current { border-top-color: var(--b5); }
  .label {
    font-size: 0.75rem;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .count {
    font-size: 1.25rem;
    font-weight: 500;
    line-height: 1.2;
  }
  .interval {
    font-size: 0.6875rem;
    color: var(--ink-2);
  }
  .flash {
    animation: box-flash 900ms var(--ease);
  }
  @keyframes box-flash {
    0%,
    35% {
      background: var(--marker);
      color: var(--on-marker);
    }
  }
  .flash .label,
  .flash .interval {
    animation: box-flash-muted 900ms var(--ease);
  }
  @keyframes box-flash-muted {
    0%,
    35% {
      color: var(--on-marker);
    }
  }
</style>
