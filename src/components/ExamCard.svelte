<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { app } from "../lib/app.svelte";
  import { formatDay } from "../lib/dates";
  import { examPlan } from "../lib/plan";
  import { href } from "../lib/router";
  import type { Deck } from "../lib/types";
  import Icon from "./Icon.svelte";

  /** The plan for a list with a test date: when, how many today, and a button to practise them. */
  let { deck }: { deck: Deck } = $props();

  const plan = $derived(deck.examDate ? examPlan(app.cardsIn(deck.id), app.today, deck.examDate) : null);
  const when = $derived(
    !plan ? "" : plan.daysLeft === 0 ? t("exam.today") : plan.daysLeft === 1 ? t("exam.tomorrow") : tp("exam.inDays", plan.daysLeft),
  );
  const date = $derived(deck.examDate ? formatDay(deck.examDate, getLang(), { weekday: "long", day: "numeric", month: "long" }) : "");
  const tag = $derived(deck.examDate ? formatDay(deck.examDate, getLang(), { weekday: "short", day: "numeric", month: "short" }) : "");
  const pct = $derived(plan && plan.target ? Math.min(100, Math.round((plan.doneToday / plan.target) * 100)) : 100);
  const count = $derived(!plan ? "all" : plan.target <= 10 ? 10 : plan.target <= 20 ? 20 : "all");
</script>

{#if deck.examDate && !plan}
  <div class="exam card card-pad">
    <p class="small">{t("exam.past", { date })}</p>
    <button type="button" class="btn btn-quiet" onclick={() => app.updateDeck(deck.id, { examDate: "" })}>{t("exam.clear")}</button>
  </div>
{:else if plan}
  <div class="exam card card-pad">
    <div class="top">
      <Icon name="calendar" size={20} />
      <p class="when"><strong>{when}</strong> <span class="muted">{t("exam.on", { date })}</span></p>
      <span class="tag">{tag}</span>
    </div>
    {#if plan.target === 0}
      <p class="small">{t("exam.ready")}</p>
    {:else}
      <p class="small">{tp("exam.plan", plan.target)} {tp("exam.left", plan.toLearn)}</p>
      <div class="progress">
        <div class="bar" aria-hidden="true"><span style:width="{pct}%"></span></div>
        <span class="caption num muted">{t("exam.progress", { done: Math.min(plan.doneToday, plan.target), target: plan.target })}</span>
      </div>
      <a class="btn btn-primary go" href={href.practice(deck.id, "leren", "front", "all", count)}><Icon name="play" size={18} />{t("exam.go")}</a>
    {/if}
  </div>
{/if}

<style>
  .exam {
    display: grid;
    gap: 0.75rem;
    text-align: left;
    width: 100%;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }
  .top > :global(.icon) {
    color: var(--yellow);
  }
  .when {
    flex: 1;
    min-width: 0;
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
