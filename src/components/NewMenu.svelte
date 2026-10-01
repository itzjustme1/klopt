<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import type { StringKey } from "../i18n/types";
  import { href } from "../lib/router";
  import Icon, { type IconName } from "./Icon.svelte";

  /** What you can make: the rows of the "Nieuw" sheet and of the new-list page. */
  let { onpick }: { onpick?: () => void } = $props();

  const items: { icon: IconName; label: StringKey; href: string }[] = [
    { icon: "lists", label: "new.type", href: href.editorNew() },
    { icon: "cards", label: "new.terms", href: href.termsNew() },
    { icon: "camera", label: "new.photo", href: href.photo() },
    { icon: "paste", label: "new.paste", href: href.import() },
    { icon: "file", label: "new.file", href: href.file() },
  ];
</script>

<ul class="drawer-list">
  {#each items as item (item.label)}
    <li><a class="drawer-item" href={item.href} onclick={() => onpick?.()}><Icon name={item.icon} />{t(item.label)}</a></li>
  {/each}
</ul>
