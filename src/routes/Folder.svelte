<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import Icon from "../components/Icon.svelte";
  import ListCard from "../components/ListCard.svelte";
  import PageHead from "../components/PageHead.svelte";
  import Sheet from "../components/Sheet.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";

  let { name }: { name: string } = $props();

  const folder = $derived(app.folders().find((f) => f.name === name));
  let moreOpen = $state(false);
  let renaming = $state(false);
  let dissolving = $state(false);
  let newName = $state("");

  async function rename(e: SubmitEvent) {
    e.preventDefault();
    const to = newName.trim();
    if (!to || to === name) return void (renaming = false);
    await app.renameFolder(name, to);
    location.replace(href.folder(to));
  }

  async function dissolve() {
    if (folder) await app.moveToFolder({ decks: folder.decks.map((d) => d.id), quizzes: folder.quizzes.map((q) => q.id) }, "");
    app.showFlash(t("folder.dissolved"));
    location.hash = href.folders();
  }
</script>

{#if !folder}
  <PageHead title={t("folder.notFound")} back={{ href: href.folders(), label: t("folder.title") }} />
{:else}
  <section class="folder">
    <PageHead
      title={name}
      subtitle={[folder.decks.length ? tp("common.decksCount", folder.decks.length) : "", folder.quizzes.length ? tp("folder.quizCount", folder.quizzes.length) : ""].filter(Boolean).join(" · ")}
      back={{ href: href.folders(), label: t("folder.title") }}
    >
      {#snippet mark()}<span class="fic"><Icon name="folder" size={28} /></span>{/snippet}
      {#snippet actions()}
        <button type="button" class="icon-btn" aria-haspopup="dialog" aria-label={t("deck.more")} title={t("deck.more")} onclick={() => (moreOpen = true)}><Icon name="more" /></button>
      {/snippet}
    </PageHead>

    {#if dissolving}
      <ConfirmInline message={t("folder.dissolveConfirm", { name })} confirmLabel={t("folder.dissolveYes")} onconfirm={dissolve} oncancel={() => (dissolving = false)} />
    {/if}

    {#if folder.decks.length}
      <h2 class="sr">{t("nav.lists")}</h2>
      <ul class="rows">
        {#each folder.decks as deck (deck.id)}<li><ListCard {deck} /></li>{/each}
      </ul>
    {/if}
    {#if folder.quizzes.length}
      <h2 class="sr">{t("quiz.title")}</h2>
      <ul class="rows">
        {#each folder.quizzes as quiz (quiz.id)}
          <li>
            <a class="row-item" href={href.quiz(quiz.id)}>
              <Icon name="quiz" size={22} />
              <span class="row-main"><span class="row-title">{quiz.name}</span><span class="row-sub">{tp("quiz.questionsCount", quiz.questions.length)}</span></span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if moreOpen}
    <Sheet title={t("deck.more")} onclose={() => (moreOpen = false)}>
      <ul class="drawer-list">
        <li><button type="button" class="drawer-item" onclick={() => { moreOpen = false; newName = name; renaming = true; }}><Icon name="edit" />{t("folder.rename")}</button></li>
        <li><button type="button" class="drawer-item danger" onclick={() => { moreOpen = false; dissolving = true; }}><Icon name="trash" />{t("folder.dissolve")}</button></li>
      </ul>
    </Sheet>
  {/if}
  {#if renaming}
    <Sheet title={t("folder.rename")} onclose={() => (renaming = false)}>
      <form class="rename" onsubmit={rename}>
        <div class="field">
          <label for="folder-name">{t("folder.name")}</label>
          <input id="folder-name" type="text" bind:value={newName} maxlength={LIMITS.labelChars} autocomplete="off" />
        </div>
        <button type="submit" class="btn btn-primary" disabled={!newName.trim()}>{t("common.save")}</button>
      </form>
    </Sheet>
  {/if}
{/if}

<style>
  .folder {
    display: grid;
    gap: 0.75rem;
  }
  .fic {
    color: var(--yellow);
  }
  .sr {
    margin-top: 0.5rem;
  }
  .rename {
    display: grid;
    gap: 1rem;
    padding: 0.75rem 1.25rem 0.5rem;
  }
  .danger {
    color: var(--bad);
  }
</style>
