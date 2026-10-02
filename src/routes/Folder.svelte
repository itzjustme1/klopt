<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import Icon from "../components/Icon.svelte";
  import ListCard from "../components/ListCard.svelte";
  import QuizRow from "../components/QuizRow.svelte";
  import PageHead from "../components/PageHead.svelte";
  import PracticeSheet from "../components/PracticeSheet.svelte";
  import { folderScope } from "../lib/scope";
  import Sheet from "../components/Sheet.svelte";
  import SharePanel from "../components/SharePanel.svelte";
  import { folderShareJson } from "../lib/share";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";

  let { name }: { name: string } = $props();

  const folder = $derived(app.folders().find((f) => f.name === name));
  let moreOpen = $state(false);
  let renaming = $state(false);
  let dissolving = $state(false);
  let newName = $state("");
  let sharing = $state(false);
  let practising = $state(false);
  const cardCount = $derived(folder ? folder.decks.reduce((n, d) => n + app.cardsIn(d.id).length, 0) : 0);

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

    {#if sharing}
      <SharePanel name={name} kind="folder" json={folderShareJson(name, folder.decks, app.cards, folder.quizzes)} title={t("folder.share")} onclose={() => (sharing = false)} />
    {/if}

    {#if dissolving}
      <ConfirmInline message={t("folder.dissolveConfirm", { name })} confirmLabel={t("folder.dissolveYes")} onconfirm={dissolve} oncancel={() => (dissolving = false)} />
    {/if}

    {#if cardCount > 0}
      <button type="button" class="btn btn-primary btn-lg practise" aria-haspopup="dialog" onclick={() => (practising = true)}><Icon name="play" size={20} />{t("multi.practiseFolder")}</button>
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
          <li><QuizRow {quiz} /></li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if moreOpen}
    <Sheet title={t("deck.more")} onclose={() => (moreOpen = false)}>
      <ul class="drawer-list">
        <li><button type="button" class="drawer-item" onclick={() => { moreOpen = false; sharing = true; }}><Icon name="share" />{t("deck.share")}</button></li>
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

{#if practising && folder}
  <PracticeSheet scope={folderScope(name)} title={t("deck.practiceWith")} onclose={() => (practising = false)} />
{/if}

<style>
  .practise {
    justify-self: center;
    min-width: 15rem;
  }
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
