<script lang="ts" module>
  type Shape =
    | { p: string; evenodd?: boolean; fill?: boolean }
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
    star: [{ p: "M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z" }],
    match: [{ r: [2.5, 6, 8, 12, 2] }, { r: [13.5, 6, 8, 12, 2] }, { p: "M10.5 12h3" }],
    image: [{ r: [3.5, 4.5, 17, 15, 2.5] }, { c: [9, 9.5, 1.6] }, { p: "m4 17 5-4.5 3.5 3 3-2.5 4.5 4" }],
    folder: [{ p: "M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2.5h7.2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" }],
    play: [{ p: "M8 5.5v13l10.5-6.5z", fill: true }],
    calendar: [{ r: [3.5, 5, 17, 15.5, 2.5] }, { p: "M3.5 10h17M8.5 3v4M15.5 3v4" }],
    menu: [{ p: "M4 7h16M4 12h16M4 17h16" }],
    quiz: [{ r: [3.5, 3.5, 17, 17, 3] }, { p: "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7" }, { c: [12, 17, 0.9], fill: true }],
    spell: [{ p: "M4 18 8.5 6l4.5 12M5.7 14h5.6" }, { p: "m14 15 2.5 2.5L21 12" }],
    more: [{ c: [5.5, 12, 1.6], fill: true }, { c: [12, 12, 1.6], fill: true }, { c: [18.5, 12, 1.6], fill: true }],
    flame: [
      {
        p: "M11 1.5c.8 3.1 3 5 4.3 6.9.5-.7 1.1-1.3 1.7-1.9 1.7 2.1 2.5 4.9 2.5 8a7.5 7.5 0 0 1-15 0c0-5.1 4.1-7.8 6.5-13z M12 12.5c1.6 1.5 2.8 2.7 2.8 4.4a2.8 2.8 0 0 1-5.6 0c0-1.6 1.1-2.9 2.8-4.4z",
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
      <path d={s.p} fill-rule={s.evenodd ? "evenodd" : undefined} fill={s.fill ? "currentColor" : undefined} />
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
