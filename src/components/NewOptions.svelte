<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import type { StringKey } from "../i18n/types";
  import { href } from "../lib/router";
  import Icon, { type IconName } from "./Icon.svelte";

  const options: { icon: IconName; title: StringKey; desc: StringKey; href: string; color: number }[] = [
    { icon: "type", title: "new.type", desc: "new.typeDesc", href: href.editorNew(), color: 1 },
    { icon: "camera", title: "new.photo", desc: "new.photoDesc", href: href.photo(), color: 2 },
    { icon: "paste", title: "new.paste", desc: "new.pasteDesc", href: href.import(), color: 4 },
    { icon: "file", title: "new.file", desc: "new.fileDesc", href: href.file(), color: 5 },
  ];
</script>

<ul class="options">
  {#each options as o (o.title)}
    <li>
      <a class="option card" href={o.href}>
        <span class="ic-round ic-{o.color} ic"><Icon name={o.icon} size={24} /></span>
        <span class="txt">
          <span class="title">{t(o.title)}</span>
          <span class="small muted">{t(o.desc)}</span>
        </span>
        <Icon name="chevron" size={20} />
      </a>
    </li>
  {/each}
</ul>

<style>
  .options {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 720px) {
    .options {
      grid-template-columns: 1fr 1fr;
    }
  }
  .option {
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 100%;
    padding: 1rem 1.25rem;
    border: 2px solid transparent;
    color: var(--ink-2);
    text-decoration: none;
    transition: border-color var(--t-base) var(--ease);
  }
  .option:hover {
    border-color: var(--accent);
  }
  .ic {
    width: 52px;
    height: 52px;
  }
  .txt {
    display: grid;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }
  .title {
    color: var(--ink);
    font-weight: 800;
    font-size: var(--fs-lead);
  }
</style>
