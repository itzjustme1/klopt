<script lang="ts">
  let { subject, size = "md" }: { subject?: string; size?: "sm" | "md" | "lg" } = $props();

  const label = $derived((subject ?? "").trim());
  const letters = $derived.by(() => {
    const words = label.split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    const a = words[0]!;
    return (a[0]!.toUpperCase() + (words[1]?.[0] ?? a[1] ?? "")).slice(0, 2);
  });
  const hue = $derived.by(() => {
    let h = 0;
    for (const ch of label.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return (h % 6) + 1;
  });
</script>

{#if letters}
  <span class="badge {size} sub-{hue}" aria-hidden="true">{letters}</span>
{/if}

<style>
  .badge {
    display: inline-grid;
    place-items: center;
    flex: none;
    border-radius: var(--r-sm);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .sm {
    width: 28px;
    height: 28px;
    font-size: var(--fs-caption);
    border-radius: var(--r-xs);
  }
  .md {
    width: 44px;
    height: 44px;
    font-size: var(--fs-body);
  }
  .lg {
    width: 56px;
    height: 56px;
    font-size: var(--fs-h2);
    border-radius: var(--r-sm);
  }
  .sub-1 { background: var(--sub-1-bg); color: var(--sub-1-fg); }
  .sub-2 { background: var(--sub-2-bg); color: var(--sub-2-fg); }
  .sub-3 { background: var(--sub-3-bg); color: var(--sub-3-fg); }
  .sub-4 { background: var(--sub-4-bg); color: var(--sub-4-fg); }
  .sub-5 { background: var(--sub-5-bg); color: var(--sub-5-fg); }
  .sub-6 { background: var(--sub-6-bg); color: var(--sub-6-fg); }
</style>
