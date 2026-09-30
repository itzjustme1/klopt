<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  /** The blue band with the page title and a wave, full width under the header. */
  let {
    title,
    subtitle,
    back,
    lead,
    children,
    lifted = false,
  }: { title: string; subtitle?: string; back?: { href: string; label: string }; lead?: Snippet; children?: Snippet; lifted?: boolean } = $props();
</script>

<div class="page-band band" class:lifted>
  <div class="inner">
    {#if back}
      <a class="back-link" href={back.href}><Icon name="back" size={18} />{back.label}</a>
    {/if}
    <div class="title-row">
      {#if lead}{@render lead()}{/if}
      <div class="titles">
        <h1>{title}</h1>
        {#if subtitle}<p class="sub">{subtitle}</p>{/if}
      </div>
    </div>
    {#if children}<div class="extra">{@render children()}</div>{/if}
  </div>
  <svg class="band-wave" viewBox="0 0 1440 36" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path d="M0 20C240 2 480 0 720 16s480 20 720-4V36H0z" fill="var(--bg)" />
  </svg>
</div>

<style>
  .page-band {
    width: 100vw;
    margin-left: calc(50% - 50vw);
    margin-top: -1.75rem;
    padding-top: 1rem;
    margin-bottom: 1.25rem;
  }
  /* The next element pulls up onto the wave (.lift). */
  .page-band.lifted {
    margin-bottom: 0;
    padding-bottom: 4.5rem;
  }
  .inner {
    display: grid;
    gap: 0.75rem;
    max-width: 1040px;
    margin-inline: auto;
    padding-inline: max(var(--gutter), env(safe-area-inset-left)) max(var(--gutter), env(safe-area-inset-right));
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    justify-self: start;
    min-height: var(--tap);
    font-weight: 700;
    text-decoration: none;
  }
  .back-link:hover {
    text-decoration: underline;
  }
  .title-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-width: 0;
  }
  .titles {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }
  h1 {
    font-size: var(--fs-h1);
    overflow-wrap: anywhere;
  }
  .sub {
    font-weight: 400;
    color: #ffffff;
  }
  .extra {
    display: grid;
    gap: 0.75rem;
  }
  @media (min-width: 720px) {
    h1 {
      font-size: var(--fs-display);
    }
  }
  @media print {
    .page-band {
      width: auto;
      margin: 0 0 1rem;
      padding: 0;
      background: none;
      color: #000;
    }
    .back-link,
    .band-wave,
    .extra,
    .title-row > :global(:not(.titles)) {
      display: none;
    }
  }
</style>
