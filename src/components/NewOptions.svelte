<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import type { StringKey } from "../i18n/types";
  import { href } from "../lib/router";
  import Icon, { type IconName } from "./Icon.svelte";

  const options: { icon: IconName; title: StringKey; desc: StringKey; href: string }[] = [
    { icon: "type", title: "new.type", desc: "new.typeDesc", href: href.editorNew() },
    { icon: "camera", title: "new.photo", desc: "new.photoDesc", href: href.photo() },
    { icon: "paste", title: "new.paste", desc: "new.pasteDesc", href: href.import() },
    { icon: "file", title: "new.file", desc: "new.fileDesc", href: href.file() },
  ];
</script>

<ul class="options">
  {#each options as o (o.title)}
    <li>
      <a class="option card" href={o.href}>
        <span class="ic"><Icon name={o.icon} size={26} /></span>
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
    padding: 1rem 1.125rem;
    color: var(--ink-2);
    text-decoration: none;
    transition: border-color var(--t-base) var(--ease);
  }
  .option:hover {
    border-color: var(--accent);
  }
  .ic {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--accent-soft);
    color: var(--accent-text);
    flex: none;
  }
  .txt {
    display: grid;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }
  .title {
    color: var(--ink);
    font-weight: 700;
  }
</style>
