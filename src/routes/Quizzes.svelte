<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import CreationTabs from "../components/CreationTabs.svelte";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import QuizRow from "../components/QuizRow.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";

  const quizzes = $derived(app.quizzes.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
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
        <li><QuizRow {quiz} /></li>
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
</style>
