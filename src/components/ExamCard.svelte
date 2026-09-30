<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { app } from "../lib/app.svelte";
  import { formatDay } from "../lib/dates";
  import { examPlan } from "../lib/plan";
  import { href } from "../lib/router";
  import type { Deck } from "../lib/types";
  import Icon from "./Icon.svelte";

  /** `compact` shows the list name (home screen); the full version sits on the list page. */
  let { deck, compact = false }: { deck: Deck; compact?: boolean } = $props();

  const plan = $derived(deck.examDate ? examPlan(app.cardsIn(deck.id), app.today, deck.examDate) : null);
  const when = $derived(
    !plan ? "" : plan.daysLeft === 0 ? t("exam.today") : plan.daysLeft === 1 ? t("exam.tomorrow") : tp("exam.inDays", plan.daysLeft),
  );
  const date = $derived(deck.examDate ? formatDay(deck.examDate, getLang(), { weekday: "long", day: "numeric", month: "long" }) : "");
  const pct = $derived(plan && plan.target ? Math.min(100, Math.round((plan.doneToday / plan.target) * 100)) : 100);
  const count = $derived(!plan ? "all" : plan.target <= 10 ? 10 : plan.target <= 20 ? 20 : "all");
</script>

{#if deck.examDate && !plan}
  <div class="exam callout past">
    <p class="small">{t("exam.past", { date })}</p>
    <button type="button" class="btn btn-quiet" onclick={() => app.updateDeck(deck.id, { examDate: "" })}>{t("exam.clear")}</button>
  </div>
{:else if plan}
  <div class="exam callout" class:soon={plan.daysLeft <= 2}>
    <div class="top">
      <span class="ic-round exam-ic"><Icon name="test" size={22} /></span>
      <div class="titles">
        {#if compact}<a class="name" href={href.deck(deck.id)}>{deck.name}</a>{/if}
        <p class="when"><strong>{when}</strong><span class="muted">{t("exam.on", { date })}</span></p>
      </div>
    </div>
    {#if plan.target === 0}
      <p class="small">{t("exam.ready")}</p>
    {:else}
      <p class="small">{tp("exam.plan", plan.target)} {tp("exam.left", plan.toLearn)}</p>
      <div class="progress">
        <div class="bar" aria-hidden="true"><span style:width="{pct}%"></span></div>
        <span class="caption num muted">{t("exam.progress", { done: Math.min(plan.doneToday, plan.target), target: plan.target })}</span>
      </div>
      <a class="btn btn-primary go" href={href.practice(deck.id, "leren", "front", "all", count)}>{t("exam.go")}</a>
    {/if}
  </div>
{/if}

<style>
  .exam {
    display: grid;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
  }
  .exam.soon {
    border-color: var(--warn);
  }
  .exam-ic {
    width: 44px;
    height: 44px;
    background: var(--yellow);
    color: var(--on-light);
  }
  .bar {
    background: var(--surface);
  }
  .bar > span {
    background: var(--good-fill);
  }
  .past {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .titles {
    display: grid;
    gap: 0.125rem;
    min-width: 0;
  }
  .name {
    color: var(--ink);
    font-weight: 800;
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  .name:hover {
    text-decoration: underline;
  }
  .when {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .soon .when strong {
    color: var(--warn);
  }
  .progress {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.75rem;
  }
  .go {
    justify-self: start;
  }
</style>
