<script lang="ts" module>
  import { t } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import { app } from "../lib/app.svelte";
  import { newId } from "../lib/db";
  import { generateQuiz } from "../lib/quizgen";
  import { href } from "../lib/router";
  import { setSelection } from "../lib/selection";
  import type { Deck, Quiz } from "../lib/types";
  import FolderPicker from "./FolderPicker.svelte";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";

  /** A practice test made from a list's own words; null when the list is too small. */
  export async function makePracticeTest(deck: Deck): Promise<Quiz | null> {
    const lang = deck.langBack === "xx" ? "" : t(`lang.${deck.langBack}`);
    const questions = generateQuiz(deck, app.cardsIn(deck.id), {
      whichTerm: t("quizgen.whichTerm"),
      whatMeans: (term) => t("quizgen.whatMeans", { term }),
      translate: (word) => (lang ? t("quizgen.translate", { word }) : t("quizgen.translatePlain", { word })),
      pairing: (term, explanation) => t("quizgen.pairing", { term, explanation }),
    }, newId);
    if (questions.length < 2) return null;
    return app.saveQuiz({ name: t("quizgen.name", { name: deck.name }).slice(0, LIMITS.deckNameChars), questions, ...(deck.subject ? { subject: deck.subject } : {}) });
  }
</script>

<script lang="ts">

  /** The ⋯ menu of a list in an overview: rename, edit, share, copy, move, delete, without opening it. */
  let { deck, onclose }: { deck: Deck; onclose: () => void } = $props();

  let view = $state<"menu" | "rename" | "delete" | "move">("menu");
  // svelte-ignore state_referenced_locally
  let name = $state(deck.name);
  let busy = $state(false);
  let error = $state("");
  const hasCards = $derived(app.cardsIn(deck.id).length > 0);

  async function rename(e: SubmitEvent) {
    e.preventDefault();
    const n = name.trim().slice(0, LIMITS.deckNameChars);
    if (!n) return void (error = t("editor.nameRequired"));
    busy = true;
    try {
      await app.updateDeck(deck.id, { name: n });
      app.showFlash(t("deck.renamed"));
      onclose();
    } catch {
      error = t("common.saveFailed");
    } finally {
      busy = false;
    }
  }

  async function copy() {
    busy = true;
    try {
      await app.duplicateDeck(deck.id, t("deck.copyName", { name: deck.name.slice(0, LIMITS.deckNameChars - 12) }));
      app.showFlash(t("deck.copied"));
      onclose();
    } catch {
      app.showFlash(t("common.saveFailed"));
    } finally {
      busy = false;
    }
  }

  async function practiceTest() {
    busy = true;
    try {
      const quiz = await makePracticeTest(deck);
      if (!quiz) {
        app.showFlash(t("quizgen.tooFew"));
        busy = false;
        return;
      }
      onclose();
      location.hash = href.quiz(quiz.id);
    } catch {
      app.showFlash(t("common.saveFailed"));
      busy = false;
    }
  }

  async function remove() {
    busy = true;
    try {
      await app.deleteDeck(deck.id);
      setSelection(deck.id, []);
      app.showFlash(t("deck.deleted"));
      onclose();
    } catch {
      app.showFlash(t("common.saveFailed"));
      busy = false;
    }
  }

  async function moveTo(folder: string) {
    try {
      await app.moveToFolder({ decks: [deck.id] }, folder);
      app.showFlash(folder ? t("folder.moved", { name: folder }) : t("folder.removed"));
    } catch {
      app.showFlash(t("common.saveFailed"));
    }
    onclose();
  }
</script>

{#if view === "move"}
  <FolderPicker current={deck.folder ?? ""} onpick={moveTo} {onclose} />
{:else}
  <Sheet title={deck.name} {onclose}>
    {#if view === "rename"}
      <form class="pad" onsubmit={rename}>
        <div class="field">
          <label for="rename-{deck.id}">{t("deck.newName")}</label>
          <input id="rename-{deck.id}" type="text" bind:value={name} maxlength={LIMITS.deckNameChars} autocomplete="off" />
        </div>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
        <div class="row">
          <button type="submit" class="btn btn-primary" disabled={busy || !name.trim()}>{t("common.save")}</button>
          <button type="button" class="btn btn-quiet" onclick={() => (view = "menu")}>{t("common.cancel")}</button>
        </div>
      </form>
    {:else if view === "delete"}
      <div class="pad">
        <p>{t("deck.deleteConfirm", { name: deck.name })}</p>
        <div class="row">
          <button type="button" class="btn btn-danger" disabled={busy} onclick={remove}><Icon name="trash" size={18} />{t("deck.deleteYes")}</button>
          <button type="button" class="btn btn-quiet" onclick={() => (view = "menu")}>{t("common.cancel")}</button>
        </div>
      </div>
    {:else}
      <ul class="drawer-list">
        <li><button type="button" class="drawer-item" onclick={() => (view = "rename")}><Icon name="edit" />{t("deck.rename")}</button></li>
        <li><a class="drawer-item" href={href.edit(deck.id)} onclick={onclose}><Icon name="rows" />{t("deck.editWords")}</a></li>
        {#if hasCards}
          <li><a class="drawer-item" href={href.shareDeck(deck.id)} onclick={onclose}><Icon name="share" />{t("deck.share")}</a></li>
          <li><button type="button" class="drawer-item" disabled={busy} onclick={practiceTest}><Icon name="quiz" />{t("quizgen.make")}</button></li>
          <li><button type="button" class="drawer-item" disabled={busy} onclick={copy}><Icon name="cards" />{t("deck.copy")}</button></li>
        {/if}
        <li><button type="button" class="drawer-item" onclick={() => (view = "move")}><Icon name="folder" />{t("folder.move")}{#if deck.folder}<span class="hint">{deck.folder}</span>{/if}</button></li>
        <li><button type="button" class="drawer-item danger" onclick={() => (view = "delete")}><Icon name="trash" />{t("common.delete")}</button></li>
      </ul>
    {/if}
  </Sheet>
{/if}

<style>
  .danger {
    color: var(--bad);
  }
  .pad {
    display: grid;
    gap: 1rem;
    padding: 0.75rem 1.25rem 0.5rem;
  }
</style>
