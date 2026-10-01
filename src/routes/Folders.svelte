<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import CreationTabs from "../components/CreationTabs.svelte";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";

  const folders = $derived(app.folders());
</script>

<PageHead title={t("folder.title")}>
  {#snippet actions()}
    <a class="icon-btn add" href={href.newFolder()} aria-label={t("folder.new")} title={t("folder.new")}><Icon name="plus" /></a>
  {/snippet}
</PageHead>

<section class="folders">
  <CreationTabs current="folders" />
  {#if folders.length === 0}
    <p class="muted">{t("folder.none")}</p>
    <a class="btn btn-primary make" href={href.newFolder()}><Icon name="plus" size={20} />{t("folder.new")}</a>
  {:else}
    <ul class="rows">
      {#each folders as f (f.name)}
        <li>
          <a class="row-item" href={href.folder(f.name)}>
            <span class="fic"><Icon name="folder" size={20} /></span>
            <span class="row-main">
              <span class="row-title">{f.name}</span>
              <span class="row-sub">{[f.decks.length ? tp("common.decksCount", f.decks.length) : "", f.quizzes.length ? tp("folder.quizCount", f.quizzes.length) : ""].filter(Boolean).join(" · ")}</span>
            </span>
            <Icon name="chevron" size={20} />
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .folders {
    display: grid;
    gap: 0.75rem;
  }
  .add {
    background: var(--green);
    color: var(--on-green);
  }
  .add:hover {
    background: var(--green-hover);
    color: var(--on-green);
  }
  .make {
    justify-self: start;
  }
  .fic {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: none;
    color: var(--yellow);
  }
</style>
