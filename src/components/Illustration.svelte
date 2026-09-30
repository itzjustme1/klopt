<script lang="ts">
  /**
   * Small original illustrations in a flat, outlined sticker style (ink outlines, bright fills).
   * Decorative only: always aria-hidden. The backdrop circle follows the theme; the sticker itself does not.
   */
  let { name, size = 120 }: { name: "cards" | "trophy" | "stack" | "camera"; size?: number } = $props();
  const INK = "#131a2e";
</script>

<svg class="illustration" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
  {#if name === "cards"}
    <circle cx="60" cy="62" r="50" fill="var(--accent-soft)" />
    <rect x="24" y="42" width="60" height="42" rx="8" fill="#ff7ab6" stroke={INK} stroke-width="3" transform="rotate(-10 54 63)" />
    <rect x="34" y="34" width="60" height="42" rx="8" fill="#ffffff" stroke={INK} stroke-width="3" transform="rotate(6 64 55)" />
    <path d="M50 56l9 9 18-20" fill="none" stroke="#16a34a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="96" cy="26" r="9" fill="#ffd43b" stroke={INK} stroke-width="3" />
    <path d="M84 30q12-12 24-8" stroke={INK} stroke-width="3" fill="none" stroke-linecap="round" />
    <path d="M20 22l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="#ffd43b" stroke={INK} stroke-width="2" stroke-linejoin="round" />
  {:else if name === "trophy"}
    <circle cx="60" cy="62" r="50" fill="var(--yellow-soft)" />
    <path d="M38 30h44v18a22 22 0 0 1-44 0z" fill="#ffd43b" stroke={INK} stroke-width="3" stroke-linejoin="round" />
    <path d="M38 36h-9a10 10 0 0 0 11 16M82 36h9a10 10 0 0 1-11 16" fill="none" stroke={INK} stroke-width="3" stroke-linecap="round" />
    <path d="M54 70h12v12H54z" fill="#ffd43b" stroke={INK} stroke-width="3" stroke-linejoin="round" />
    <rect x="42" y="82" width="36" height="12" rx="4" fill="#1660ff" stroke={INK} stroke-width="3" />
    <path d="M60 38l3.5 7 7.5 1-5.5 5 1.5 7.5L60 55l-7 3.5 1.5-7.5-5.5-5 7.5-1z" fill="#ffffff" stroke={INK} stroke-width="2" stroke-linejoin="round" />
    <path d="M22 26l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1zM98 70l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#ff7ab6" stroke={INK} stroke-width="2" stroke-linejoin="round" />
  {:else if name === "stack"}
    <circle cx="60" cy="62" r="50" fill="var(--accent-soft)" />
    <rect x="22" y="58" width="64" height="40" rx="8" fill="#38bdf8" stroke={INK} stroke-width="3" transform="rotate(-6 54 78)" />
    <rect x="28" y="44" width="64" height="40" rx="8" fill="#ffd43b" stroke={INK} stroke-width="3" transform="rotate(4 60 64)" />
    <rect x="30" y="30" width="64" height="40" rx="8" fill="#ffffff" stroke={INK} stroke-width="3" transform="rotate(-3 62 50)" />
    <path d="M42 44h30M42 54h20" stroke="#d3dae8" stroke-width="4" stroke-linecap="round" />
    <path d="M86 18l14 14-34 34-18 4 4-18z" fill="#ff7ab6" stroke={INK} stroke-width="3" stroke-linejoin="round" />
    <path d="M52 70l4-18 14 14z" fill="#ffffff" stroke={INK} stroke-width="3" stroke-linejoin="round" />
    <path d="M80 24l14 14" stroke={INK} stroke-width="3" />
  {:else}
    <circle cx="60" cy="62" r="50" fill="var(--accent-soft)" />
    <rect x="22" y="40" width="76" height="52" rx="12" fill="#ffffff" stroke={INK} stroke-width="3" />
    <path d="M44 40l6-10h20l6 10" fill="#ffd43b" stroke={INK} stroke-width="3" stroke-linejoin="round" />
    <circle cx="60" cy="66" r="15" fill="#1660ff" stroke={INK} stroke-width="3" />
    <circle cx="60" cy="66" r="6" fill="#ffffff" stroke={INK} stroke-width="2" />
    <circle cx="86" cy="52" r="4" fill="#ff7ab6" stroke={INK} stroke-width="2" />
  {/if}
</svg>

<style>
  .illustration {
    flex: none;
    display: block;
  }
</style>
