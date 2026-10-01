<script lang="ts">
  import type { ContentLang } from "../lib/types";
  import Flag from "./Flag.svelte";

  /**
   * The mark in front of a subject or list, as in StudyGo: a round flag for a language subject,
   * otherwise a coloured circle with a symbol (€, π, </>) or the first letter.
   */
  let { subject, lang, size = 28 }: { subject?: string; lang?: ContentLang; size?: number } = $props();

  const LANGS: Record<string, ContentLang> = {
    frans: "fr", french: "fr", engels: "en", english: "en", duits: "de", german: "de",
    spaans: "es", spanish: "es", italiaans: "it", italian: "it", latijn: "la", latin: "la",
    nederlands: "nl", dutch: "nl",
  };
  const SYMBOLS: Record<string, string> = {
    economie: "€", bedrijfseconomie: "€", economics: "€", "business economics": "€",
    wiskunde: "π", mathematics: "π", math: "π", informatica: "</>", "computer science": "</>",
  };

  const label = $derived((subject ?? "").trim());
  const key = $derived(label.toLowerCase());
  const flag = $derived<ContentLang | undefined>(LANGS[key] ?? (!label && lang && lang !== "xx" && lang !== "nl" ? lang : undefined));
  const text = $derived(SYMBOLS[key] ?? (label ? label[0]!.toUpperCase() : ""));
  const hue = $derived.by(() => {
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return (h % 8) + 1;
  });
</script>

{#if flag}
  <span class="mark" style:width="{size}px" style:height="{size}px" aria-hidden="true"><Flag lang={flag} size={Math.round(size * 1.5)} /></span>
{:else if text}
  <span class="mark letter" class:sym={text.length > 2} style:width="{size}px" style:height="{size}px" style:font-size="{Math.round(size * (text.length > 2 ? 0.4 : 0.56))}px" style:background="var(--sub-{hue})" aria-hidden="true">{text}</span>
{/if}

<style>
  .mark {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex: none;
    border-radius: 50%;
    overflow: hidden;
  }
  /* The 3:2 flag, centred and cropped to a circle. */
  .mark > :global(svg) {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
  .letter {
    color: var(--on-sub);
    font-weight: 900;
    line-height: 1;
  }
  .sym {
    letter-spacing: -0.06em;
  }
</style>
