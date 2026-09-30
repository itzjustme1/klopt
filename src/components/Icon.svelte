<script lang="ts" module>
  type Shape =
    | { p: string; evenodd?: boolean }
    | { c: [number, number, number]; fill?: boolean }
    | { r: [number, number, number, number, number] };

  /** A small original icon set on a 24px grid, 2px round strokes. */
  export const ICONS = {
    home: [{ p: "M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" }],
    lists: [{ r: [3.5, 7.5, 14, 13, 2] }, { p: "M7.5 4h11a2 2 0 0 1 2 2v11" }],
    progress: [{ p: "M5 20v-6M12 20V5M19 20v-10" }, { p: "M3 20.5h18" }],
    settings: [{ p: "M4 7h9M17 7h3M4 17h3M11 17h9" }, { c: [15, 7, 2] }, { c: [9, 17, 2] }],
    plus: [{ p: "M12 5v14M5 12h14" }],
    search: [{ c: [11, 11, 6.5] }, { p: "m20 20-4.2-4.2" }],
    speaker: [{ p: "M4 9.5v5h3.5l5 4v-13l-5 4z" }, { p: "M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" }],
    camera: [{ r: [3, 7, 18, 13, 3] }, { p: "m8 7 1.5-2.5h5L16 7" }, { c: [12, 13.5, 3.5] }],
    check: [{ p: "m5 12.5 4.5 4.5L19 7.5" }],
    x: [{ p: "M6.5 6.5l11 11M17.5 6.5l-11 11" }],
    back: [{ p: "M15 5l-7 7 7 7" }],
    chevron: [{ p: "m9 5 7 7-7 7" }],
    edit: [{ p: "M4 20h4.5L19.5 9 15 4.5 4 15.5z" }, { p: "m13 6.5 4.5 4.5" }],
    trash: [{ p: "M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" }],
    share: [{ p: "M12 3.5v11M7.5 8 12 3.5 16.5 8" }, { p: "M5 13.5v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" }],
    hint: [{ p: "M9 18h6M10 21h4" }, { p: "M12 3a6 6 0 0 0-3.6 10.8c.6.5.6 1 .6 1.7v.5h6v-.5c0-.7 0-1.2.6-1.7A6 6 0 0 0 12 3z" }],
    paste: [{ r: [5, 4.5, 14, 16.5, 2] }, { p: "M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7" }],
    file: [{ p: "M6 3h8.5L19 7.5V21H6z" }, { p: "M14 3v5h5" }],
    type: [{ r: [2.5, 6, 19, 12, 2.5] }, { p: "M6.5 10h1M10.5 10h1M14.5 10h1M7 14.5h10" }],
    swap: [{ p: "M7 7.5h13M16.5 4 20 7.5 16.5 11" }, { p: "M17 16.5H4M7.5 13 4 16.5 7.5 20" }],
    cards: [{ r: [3, 6.5, 14, 14, 2.5] }, { p: "M7 3.5h11.5a2 2 0 0 1 2 2V17" }],
    learn: [{ p: "M4.5 12a7.5 7.5 0 0 1 13.2-4.9M19.5 12a7.5 7.5 0 0 1-13.2 4.9" }, { p: "M18 3.5v4h-4M6 20.5v-4h4" }],
    choice: [{ p: "M10 6.5h10M10 12h10M10 17.5h10" }, { c: [5, 6.5, 1.5] }, { c: [5, 12, 1.5] }, { c: [5, 17.5, 1.5] }],
    listen: [{ p: "M4 15.5v-3.5a8 8 0 0 1 16 0v3.5" }, { r: [3, 14, 4.5, 6.5, 1.5] }, { r: [16.5, 14, 4.5, 6.5, 1.5] }],
    test: [{ r: [5, 4.5, 14, 16.5, 2] }, { p: "M9 4.5V3h6v1.5" }, { p: "m9 13 2 2 4-4.5" }],
    review: [{ r: [3.5, 5, 17, 15.5, 2.5] }, { p: "M3.5 10h17M8.5 3v4M15.5 3v4" }, { p: "m9.5 15 1.8 1.8 3.5-3.6" }],
    more: [{ c: [5.5, 12, 1.6], fill: true }, { c: [12, 12, 1.6], fill: true }, { c: [18.5, 12, 1.6], fill: true }],
    flame: [
      {
        p: "M12.6 2.2c.5 3.3 2.8 5 4.3 7.2 1 1.5 1.8 3.1 1.8 5.1a6.7 6.7 0 0 1-13.4 0c0-2.7 1.3-4.7 2.9-6.2.2 1.9 1 3.2 2.3 3.9-.4-3.7.4-7.1 2.1-10z M12 13.2c1.6 1.4 2.6 2.6 2.6 4.2a2.6 2.6 0 0 1-5.2 0c0-1.4.9-2.7 2.6-4.2z",
        evenodd: true,
      },
    ],
  } satisfies Record<string, Shape[]>;

  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  let { name, size = 24, filled = false }: { name: IconName; size?: number; filled?: boolean } = $props();
  const shapes = $derived(ICONS[name] as Shape[]);
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled ? "currentColor" : "none"}
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#each shapes as s, i (i)}
    {#if "p" in s}
      <path d={s.p} fill-rule={s.evenodd ? "evenodd" : undefined} />
    {:else if "c" in s}
      <circle cx={s.c[0]} cy={s.c[1]} r={s.c[2]} fill={s.fill ? "currentColor" : undefined} stroke={s.fill ? "none" : undefined} />
    {:else}
      <rect x={s.r[0]} y={s.r[1]} width={s.r[2]} height={s.r[3]} rx={s.r[4]} />
    {/if}
  {/each}
</svg>

<style>
  .icon {
    flex: none;
    display: block;
  }
</style>
