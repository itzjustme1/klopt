<script lang="ts">
  import type { ContentLang } from "../lib/types";

  let { lang, size = 20 }: { lang: ContentLang; size?: number } = $props();
  const uid = $props.id();
  const h = $derived(Math.round((size * 2) / 3));
</script>

<svg class="flag" width={size} height={h} viewBox="0 0 30 20" aria-hidden="true" focusable="false">
  <clipPath id="flag-{uid}"><rect width="30" height="20" rx="3.5" /></clipPath>
  <g clip-path="url(#flag-{uid})">
    {#if lang === "nl"}
      <rect width="30" height="20" fill="#ae1c28" /><rect y="6.67" width="30" height="6.67" fill="#fff" /><rect y="13.33" width="30" height="6.67" fill="#21468b" />
    {:else if lang === "fr"}
      <rect width="30" height="20" fill="#fff" /><rect width="10" height="20" fill="#002654" /><rect x="20" width="10" height="20" fill="#ce1126" />
    {:else if lang === "de"}
      <rect width="30" height="20" fill="#000" /><rect y="6.67" width="30" height="6.67" fill="#dd0000" /><rect y="13.33" width="30" height="6.67" fill="#ffce00" />
    {:else if lang === "it"}
      <rect width="30" height="20" fill="#fff" /><rect width="10" height="20" fill="#009246" /><rect x="20" width="10" height="20" fill="#ce2b37" />
    {:else if lang === "es"}
      <rect width="30" height="20" fill="#aa151b" /><rect y="5" width="30" height="10" fill="#f1bf00" />
    {:else if lang === "en"}
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6" />
      <path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6.5" />
      <path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.5" />
    {:else if lang === "la"}
      <rect width="30" height="20" fill="#8a1c1c" /><text x="15" y="14" text-anchor="middle" font-size="10" font-weight="800" fill="#f5c542" font-family="Georgia, serif">SPQR</text>
    {:else}
      <rect width="30" height="20" fill="#cfd6e4" /><circle cx="15" cy="10" r="5.5" fill="none" stroke="#545d78" stroke-width="1.5" /><path d="M9.5 10h11M15 4.5c-2.5 3-2.5 8 0 11c2.5-3 2.5-8 0-11" fill="none" stroke="#545d78" stroke-width="1.2" />
    {/if}
  </g>
  <rect width="30" height="20" rx="3.5" fill="none" stroke="rgb(0 0 0 / 0.12)" />
</svg>

<style>
  .flag {
    flex: none;
    display: block;
  }
</style>
