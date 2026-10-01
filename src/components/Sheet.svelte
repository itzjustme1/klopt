<script lang="ts">
  import type { Snippet } from "svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "./Icon.svelte";

  /** A bottom sheet over a scrim: Escape, the scrim and the close button all close it; focus returns afterwards. */
  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();

  const id = $props.id();
  let box: HTMLElement | undefined = $state();

  $effect(() => {
    const before = document.activeElement as HTMLElement | null;
    // The first option rather than the close button, so Enter does the obvious thing.
    (box?.querySelector<HTMLElement>(".drawer-body a[href], .drawer-body button:not([disabled]), .drawer-body input") ?? box)?.focus();
    return () => before?.focus?.();
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onclose();
      return;
    }
    if (e.key !== "Tab" || !box) return;
    // Keep Tab inside the sheet.
    const items = [...box.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])")];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="{id}-title" tabindex="-1" bind:this={box} {onkeydown}>
  <div class="drawer-head">
    <h2 id="{id}-title">{title}</h2>
    <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={onclose}><Icon name="x" /></button>
  </div>
  <div class="drawer-body">{@render children()}</div>
</div>
