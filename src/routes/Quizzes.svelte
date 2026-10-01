<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import CreationTabs from "../components/CreationTabs.svelte";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { app } from "../lib/app.svelte";
  import { quizGrade } from "../lib/quiz";
  import { href } from "../lib/router";

  const quizzes = $derived(app.quizzes.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  const fmt = $derived(new Intl.NumberFormat(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
</script>

<PageHead title={t("quiz.title")}>
  {#snippet actions()}
    <a class="icon-btn add" href={href.quizNew()} aria-label={t("quiz.new")} title={t("quiz.new")}><Icon name="plus" /></a>
  {/snippet}
</PageHead>

<section class="quizzes">
  <CreationTabs current="quizzes" />
  {#if quizzes.length === 0}
    <p class="muted">{t("quiz.none")}</p>
    <a class="btn btn-primary make" href={href.quizNew()}><Icon name="plus" size={20} />{t("quiz.make")}</a>
  {:else}
    <ul class="rows">
      {#each quizzes as quiz (quiz.id)}
        <li>
          <a class="row-item" href={href.quiz(quiz.id)}>
            {#if quiz.subject}<SubjectBadge subject={quiz.subject} />{:else}<span class="qmark"><Icon name="quiz" size={18} /></span>{/if}
            <span class="row-main">
              <span class="row-title">{quiz.name}</span>
              <span class="row-sub">{tp("quiz.questionsCount", quiz.questions.length)}</span>
            </span>
            {#if quiz.last}<span class="row-end num">{t("quiz.lastGrade", { grade: fmt.format(quizGrade(quiz.last.points, quiz.last.total)) })}</span>{/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .quizzes {
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
</style>
