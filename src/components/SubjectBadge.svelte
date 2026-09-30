<script lang="ts">
  /** A round, coloured subject icon: a symbol for some subjects, otherwise two letters. */
  let { subject, size = "md" }: { subject?: string; size?: "sm" | "md" | "lg" } = $props();

  const SYMBOLS: Record<string, string> = {
    economie: "€",
    bedrijfseconomie: "€",
    economics: "€",
    "business economics": "€",
    wiskunde: "π",
    mathematics: "π",
    math: "π",
    informatica: "</>",
    "computer science": "</>",
  };

  const label = $derived((subject ?? "").trim());
  const text = $derived.by(() => {
    const key = label.toLowerCase();
    if (SYMBOLS[key]) return SYMBOLS[key]!;
    const words = label.split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    const a = words[0]!;
    return (a[0]!.toUpperCase() + (words[1]?.[0] ?? a[1] ?? "")).slice(0, 2);
  });
  const hue = $derived.by(() => {
    let h = 0;
    for (const ch of label.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return (h % 8) + 1;
  });
</script>

{#if text}
  <span class="ic-round ic-{hue} {size}" class:sym={text.length > 2} aria-hidden="true">{text}</span>
{/if}

<style>
  .sm {
    width: 32px;
    height: 32px;
    font-size: var(--fs-caption);
  }
  .md {
    width: 48px;
    height: 48px;
    font-size: var(--fs-cta);
  }
  .lg {
    width: 64px;
    height: 64px;
    font-size: var(--fs-h2);
  }
  /* Three-character symbols (</>) sit a size smaller and tighter; the small badge is already caption size. */
  .sym {
    letter-spacing: -0.04em;
  }
  .sym.md,
  .sym.lg {
    font-size: var(--fs-small);
  }
</style>
