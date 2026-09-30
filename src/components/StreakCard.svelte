<script lang="ts">
  import { getLang, num, t, tp } from "../i18n/index.svelte";
  import { app } from "../lib/app.svelte";
  import { formatDay } from "../lib/dates";
  import { weekDays } from "../lib/history";
  import Icon from "./Icon.svelte";

  const s = $derived(app.streak());
  const done = $derived(app.answersToday());
  const goal = $derived(app.settings.dailyGoal);
  const pct = $derived(Math.min(1, done / goal));
  const practiced = $derived(new Set(app.days.filter((d) => d.answers > 0).map((d) => d.day)));
  const week = $derived(weekDays(app.today));
  const R = 24;
  const C = 2 * Math.PI * R;
</script>

<section class="streak card" aria-label={t("home.goalLabel")}>
  <div class="row-main">
    <div class="flame" class:lit={s.today}>
      <Icon name="flame" size={30} filled />
    </div>
    <div class="text">
      <p class="count"><span class="num">{tp("home.streak", s.days)}</span></p>
      <p class="small muted">{s.today ? t("home.streakDone") : s.days > 0 ? t("home.streakKeep") : t("home.streakStart")}</p>
    </div>
    <div class="goal" title={t("home.goal", { done, goal })}>
      <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r={R} fill="none" stroke="var(--surface-2)" stroke-width="7" />
        <circle
          cx="30"
          cy="30"
          r={R}
          fill="none"
          stroke={pct >= 1 ? "var(--good-fill)" : "var(--accent)"}
          stroke-width="7"
          stroke-linecap="round"
          stroke-dasharray={C}
          stroke-dashoffset={C * (1 - pct)}
          transform="rotate(-90 30 30)"
          class="ring"
        />
      </svg>
      <span class="goal-num caption num" aria-hidden="true">{num(done)}/{num(goal)}</span>
      <span class="visually-hidden">{pct >= 1 ? t("home.goalDone") : t("home.goal", { done, goal })}</span>
    </div>
  </div>
  <ol class="week" aria-label={t("progress.week")}>
    {#each week as day (day)}
      {@const did = practiced.has(day)}
      <li class:did class:today={day === app.today}>
        <span class="dot" aria-hidden="true">{#if did}<Icon name="check" size={14} />{/if}</span>
        <span class="wd caption" aria-hidden="true">{formatDay(day, getLang(), { weekday: "narrow" })}</span>
        <span class="visually-hidden">{formatDay(day, getLang(), { weekday: "long" })}: {did ? t("home.practiced") : t("home.notPracticed")}</span>
      </li>
    {/each}
  </ol>
</section>

<style>
  .streak {
    display: grid;
    gap: 1rem;
    padding: 1.25rem 1.25rem;
  }
  .row-main {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .flame {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: var(--r-sm);
    background: var(--surface-2);
    color: var(--line-strong);
    flex: none;
  }
  .flame.lit {
    background: var(--warn-soft);
    color: var(--flame);
  }
  .text {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.125rem;
  }
  .count {
    font-size: var(--fs-h2);
    font-weight: 800;
    line-height: 1.2;
  }
  .goal {
    position: relative;
    width: 60px;
    height: 60px;
    flex: none;
  }
  .goal-num {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: var(--fs-caption);
  }
  .ring {
    transition: stroke-dashoffset var(--t-signature) var(--ease);
  }
  .week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .week li {
    display: grid;
    justify-items: center;
    gap: 0.25rem;
  }
  .dot {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--on-accent);
  }
  .did .dot {
    background: var(--accent);
  }
  .today .dot {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .wd {
    color: var(--ink-2);
    text-transform: capitalize;
  }
</style>
