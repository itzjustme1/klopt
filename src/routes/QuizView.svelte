<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import FolderPicker from "../components/FolderPicker.svelte";
  import SharePanel from "../components/SharePanel.svelte";
  import { quizShareJson } from "../lib/share";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import Sheet from "../components/Sheet.svelte";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { app } from "../lib/app.svelte";
  import { quizGrade } from "../lib/quiz";
  import { href } from "../lib/router";
  import type { QuizQuestion } from "../lib/types";

  let { id, share = false }: { id: string; share?: boolean } = $props();

  const quiz = $derived(app.quiz(id));
  const fmt = $derived(new Intl.NumberFormat(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  let moreOpen = $state(false);
  let deleting = $state(false);
  let moving = $state(false);
  async function moveTo(folder: string) {
    moving = false;
    await app.moveToFolder({ quizzes: [id] }, folder);
    app.showFlash(folder ? t("folder.moved", { name: folder }) : t("folder.removed"));
  }

  function preview(q: QuizQuestion): string {
    return q.type === "cloze" ? q.text.replace(/\[[^\]\n]+\]/g, "…") : q.prompt;
  }

  async function remove() {
    await app.deleteQuiz(id);
    app.showFlash(t("quiz.deleted"));
    location.hash = href.quizzes();
  }
</script>

{#if !quiz}
  <PageHead title={t("quiz.notFound")} back={{ href: href.quizzes(), label: t("quiz.title") }} />
{:else}
  <section class="quiz">
    <PageHead title={quiz.name} subtitle={[quiz.subject, tp("quiz.questionsCount", quiz.questions.length)].filter(Boolean).join(" · ")} back={{ href: href.quizzes(), label: t("quiz.title") }}>
      {#snippet mark()}
        {#if quiz.subject}<SubjectBadge subject={quiz.subject} size={32} />{:else}<Icon name="quiz" size={28} />{/if}
      {/snippet}
      {#snippet actions()}
        <button type="button" class="icon-btn" aria-haspopup="dialog" aria-label={t("deck.more")} title={t("deck.more")} onclick={() => (moreOpen = true)}><Icon name="more" /></button>
      {/snippet}
      {#if quiz.last}
        <span class="tag">{t("quiz.lastGrade", { grade: fmt.format(quizGrade(quiz.last.points, quiz.last.total)) })}</span>
      {/if}
      <a class="btn btn-primary btn-lg start" href={href.quizPlay(id)}><Icon name="play" size={18} />{t("quiz.start")}</a>
    </PageHead>

    {#if share}
      <SharePanel name={quiz.name} kind="quiz" json={quizShareJson(quiz)} title={t("quiz.share")} onclose={() => (location.hash = href.quiz(id))} />
    {/if}

    {#if deleting}
      <ConfirmInline message={t("quiz.deleteConfirm", { name: quiz.name })} confirmLabel={t("deck.deleteYes")} onconfirm={remove} oncancel={() => (deleting = false)} />
    {/if}

    <ol class="rows">
      {#each quiz.questions as q, i (q.id)}
        <li class="qrow">
          <span class="n num">{i + 1}</span>
          <span class="row-main">
            <span class="row-sub">{t(`quiz.type.${q.type}`)}</span>
            <span class="text">{preview(q)}</span>
          </span>
        </li>
      {/each}
    </ol>
  </section>

  {#if moving}
    <FolderPicker current={quiz.folder ?? ""} onpick={moveTo} onclose={() => (moving = false)} />
  {/if}
  {#if moreOpen}
    <Sheet title={t("deck.more")} onclose={() => (moreOpen = false)}>
      <ul class="drawer-list">
        <li><a class="drawer-item" href={href.quizEdit(id)}><Icon name="edit" />{t("common.edit")}</a></li>
        <li><a class="drawer-item" href={href.quizShare(id)} onclick={() => (moreOpen = false)}><Icon name="share" />{t("deck.share")}</a></li>
        <li><button type="button" class="drawer-item" onclick={() => { moreOpen = false; moving = true; }}><Icon name="folder" />{t("folder.move")}{#if quiz.folder}<span class="hint">{quiz.folder}</span>{/if}</button></li>
        <li><button type="button" class="drawer-item danger" onclick={() => { moreOpen = false; deleting = true; }}><Icon name="trash" />{t("common.delete")}</button></li>
      </ul>
    </Sheet>
  {/if}
{/if}

<style>
  .quiz {
    display: grid;
    gap: 1rem;
  }
  .start {
    min-width: 15rem;
  }
  .qrow {
    display: flex;
    gap: 0.875rem;
    padding: 0.75rem 1rem;
  }
  .n {
    width: 1.5rem;
    color: var(--ink-2);
    font-weight: 700;
    text-align: right;
    flex: none;
  }
  .text {
    font-weight: 700;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .danger {
    color: var(--bad);
  }
</style>
