<script lang="ts">
  import type { Snippet } from "svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "./Icon.svelte";

  /**
   * The top of a screen, as in the StudyGo app. With `back`: a back arrow, an optional mark in the
   * middle and the title centred below. Without: a large title on the left with actions beside it.
   */
  let {
    title,
    subtitle,
    back,
    mark,
    actions,
    children,
  }: { title: string; subtitle?: string; back?: { href: string; label: string }; mark?: Snippet; actions?: Snippet; children?: Snippet } = $props();
</script>

{#if back}
  <header class="head centered">
    <div class="page-top">
      <a class="icon-btn" href={back.href} aria-label={t("common.backTo", { place: back.label })} title={back.label}><Icon name="back" /></a>
      <span>{#if mark}{@render mark()}{/if}</span>
      <span class="actions">{#if actions}{@render actions()}{/if}</span>
    </div>
    <h1 class="page-title">{title}</h1>
    {#if subtitle}<p class="sub">{subtitle}</p>{/if}
    {#if children}<div class="extra">{@render children()}</div>{/if}
  </header>
{:else}
  <header class="head">
    <div class="title-row">
      <h1>{title}</h1>
      {#if actions}<span class="actions">{@render actions()}</span>{/if}
    </div>
    {#if subtitle}<p class="sub">{subtitle}</p>{/if}
    {#if children}<div class="extra">{@render children()}</div>{/if}
  </header>
{/if}

<style>
  .head {
    display: grid;
    gap: 0.375rem;
    margin-bottom: 1.25rem;
  }
  .centered {
    justify-items: center;
    text-align: center;
  }
  .centered .page-top {
    width: 100%;
    margin-top: -0.5rem;
  }
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: var(--tap);
  }
  h1 {
    overflow-wrap: anywhere;
  }
  .sub {
    color: var(--ink-2);
    max-width: 36rem;
  }
  .actions {
    display: inline-flex;
    gap: 0.25rem;
  }
  .extra {
    display: grid;
    justify-items: inherit;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
  @media print {
    .page-top,
    .extra,
    .actions {
      display: none;
    }
  }
</style>
