<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import { app } from "../lib/app.svelte";
  import { quizGrade } from "../lib/quiz";
  import { href } from "../lib/router";
  import type { Quiz } from "../lib/types";
  import FolderPicker from "./FolderPicker.svelte";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";
  import SubjectBadge from "./SubjectBadge.svelte";

  /** One quiz as a row, with a ⋯ menu: rename, edit, take, share, move, delete. Goes inside a `.rows` list. */
  let { quiz }: { quiz: Quiz } = $props();

  const fmt = $derived(new Intl.NumberFormat(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  let view = $state<"closed" | "menu" | "rename" | "delete" | "move">("closed");
  let name = $state("");
  let busy = $state(false);
  const close = () => (view = "closed");

  function open() {
    name = quiz.name;
    view = "menu";
  }

  async function rename(e: SubmitEvent) {
    e.preventDefault();
    const n = name.trim().slice(0, LIMITS.deckNameChars);
    if (!n) return;
    busy = true;
    try {
      await app.saveQuiz({ id: quiz.id, name: n, questions: quiz.questions, ...(quiz.subject ? { subject: quiz.subject } : {}) });
      app.showFlash(t("deck.renamed"));
      close();
    } catch {
      app.showFlash(t("common.saveFailed"));
    } finally {
      busy = false;
    }
  }

  async function remove() {
    busy = true;
    try {
      await app.deleteQuiz(quiz.id);
      close();
    } catch {
      app.showFlash(t("common.saveFailed"));
    } finally {
      busy = false;
    }
  }

  async function moveTo(folder: string) {
    try {
      await app.moveToFolder({ quizzes: [quiz.id] }, folder);
      app.showFlash(folder ? t("folder.moved", { name: folder }) : t("folder.removed"));
    } catch {
      app.showFlash(t("common.saveFailed"));
    }
    close();
  }
</script>

<div class="qr">
  <a class="row-item" href={href.quiz(quiz.id)}>
    {#if quiz.subject}<SubjectBadge subject={quiz.subject} />{:else}<span class="qmark"><Icon name="quiz" size={18} /></span>{/if}
    <span class="row-main">
      <span class="row-title">{quiz.name}</span>
      <span class="row-sub">{tp("quiz.questionsCount", quiz.questions.length)}</span>
    </span>
    {#if quiz.last}<span class="row-end num">{t("quiz.lastGrade", { grade: fmt.format(quizGrade(quiz.last.points, quiz.last.total)) })}</span>{/if}
  </a>
  <button type="button" class="icon-btn more" aria-haspopup="dialog" aria-label={t("deck.actions", { name: quiz.name })} title={t("deck.more")} onclick={open}>
    <Icon name="more" />
  </button>
</div>

{#if view === "move"}
  <FolderPicker current={quiz.folder ?? ""} onpick={moveTo} onclose={close} />
{:else if view !== "closed"}
  <Sheet title={quiz.name} onclose={close}>
    {#if view === "rename"}
      <form class="pad" onsubmit={rename}>
        <div class="field">
          <label for="qrename-{quiz.id}">{t("deck.newName")}</label>
          <input id="qrename-{quiz.id}" type="text" bind:value={name} maxlength={LIMITS.deckNameChars} autocomplete="off" />
        </div>
        <div class="row">
          <button type="submit" class="btn btn-primary" disabled={busy || !name.trim()}>{t("common.save")}</button>
          <button type="button" class="btn btn-quiet" onclick={() => (view = "menu")}>{t("common.cancel")}</button>
        </div>
      </form>
    {:else if view === "delete"}
      <div class="pad">
        <p>{t("quiz.deleteConfirm", { name: quiz.name })}</p>
        <div class="row">
          <button type="button" class="btn btn-danger" disabled={busy} onclick={remove}><Icon name="trash" size={18} />{t("deck.deleteYes")}</button>
          <button type="button" class="btn btn-quiet" onclick={() => (view = "menu")}>{t("common.cancel")}</button>
        </div>
      </div>
    {:else}
      <ul class="drawer-list">
        <li><a class="drawer-item" href={href.quizPlay(quiz.id)} onclick={close}><Icon name="play" />{t("quiz.start")}</a></li>
        <li><button type="button" class="drawer-item" onclick={() => (view = "rename")}><Icon name="edit" />{t("deck.rename")}</button></li>
        <li><a class="drawer-item" href={href.quizEdit(quiz.id)} onclick={close}><Icon name="rows" />{t("quiz.editQuestions")}</a></li>
        <li><a class="drawer-item" href={href.quizShare(quiz.id)} onclick={close}><Icon name="share" />{t("deck.share")}</a></li>
        <li><button type="button" class="drawer-item" onclick={() => (view = "move")}><Icon name="folder" />{t("folder.move")}{#if quiz.folder}<span class="hint">{quiz.folder}</span>{/if}</button></li>
        <li><button type="button" class="drawer-item danger" onclick={() => (view = "delete")}><Icon name="trash" />{t("common.delete")}</button></li>
      </ul>
    {/if}
  </Sheet>
{/if}

<style>
  .qr {
    display: flex;
    align-items: center;
  }
  .qr .row-item {
    flex: 1;
    min-width: 0;
  }
  .qr:hover {
    background: var(--surface-2);
  }
  .qr .row-item:hover {
    background: transparent;
  }
  .more {
    margin-right: 0.375rem;
    color: var(--ink-2);
  }
  .more:hover {
    color: var(--ink);
  }
  .qmark {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: none;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--ink-2);
  }
  .pad {
    display: grid;
    gap: 1rem;
    padding: 0.75rem 1.25rem 0.5rem;
  }
  .danger {
    color: var(--bad);
  }
</style>
