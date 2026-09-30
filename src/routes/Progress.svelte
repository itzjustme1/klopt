<script lang="ts">
  import { getLang, num, t, tp } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { app } from "../lib/app.svelte";
  import { addDays, formatDay } from "../lib/dates";
  import { weekDays } from "../lib/history";
  import { href } from "../lib/router";

  const s = $derived(app.streak());
  const best = $derived(Math.max(app.bestStreak(), s.days));
  const byDay = $derived(new Map(app.days.map((d) => [d.day, d])));
  const goal = $derived(app.settings.dailyGoal);

  /** 12 weeks, Monday-first columns, ending with the current week. */
  const weeks = $derived.by(() => {
    const monday = weekDays(app.today)[0]!;
    const start = addDays(monday, -7 * 11);
    return Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  });
  function level(day: string): number {
    if (day > app.today) return -1;
    const n = byDay.get(day)?.answers ?? 0;
    if (n === 0) return 0;
    if (n < goal / 2) return 1;
    if (n < goal) return 2;
    return 3;
  }

  const week = $derived(weekDays(app.today));
  const weekStats = $derived.by(() => {
    let answers = 0;
    let correct = 0;
    for (const d of week) {
      const st = byDay.get(d);
      if (st) {
        answers += st.answers;
        correct += st.correct;
      }
    }
    return { answers, pct: answers ? Math.round((correct / answers) * 100) : 0 };
  });
  const hard = $derived(app.hardCount());
</script>

<section class="progress">
  <h1>{t("progress.title")}</h1>

  <div class="top">
    <div class="streak card">
      <span class="flame" class:lit={s.today}><Icon name="flame" size={40} filled /></span>
      <p class="big num">{num(s.days)}</p>
      <p class="label">{tp("progress.streak", s.days)}</p>
      <p class="small muted">{tp("progress.best", best)}</p>
    </div>
    <div class="week card">
      <h2>{t("progress.week")}</h2>
      <p class="big num">{num(weekStats.answers)}</p>
      <p class="label">{tp("progress.answersLabel", weekStats.answers)}</p>
      <p class="small muted">{t("progress.correctPct", { p: weekStats.pct })}</p>
    </div>
  </div>

  <div class="card card-pad cal">
    <h2>{t("progress.calendar")}</h2>
    <div class="cal-head">
      <p class="small muted">{t("progress.goal", { n: goal })}</p>
      <a class="small" href={href.settings()}>{t("progress.changeGoal")}</a>
    </div>
    <div class="heat" role="img" aria-label={t("progress.calendar")}>
      {#each weeks as w, wi (wi)}
        <div class="col">
          {#each w as day (day)}
            {@const lv = level(day)}
            <span
              class="cell l{lv}"
              class:today={day === app.today}
              title={t("progress.dayCell", { date: formatDay(day, getLang(), { day: "numeric", month: "short" }), count: tp("progress.answers", byDay.get(day)?.answers ?? 0) })}
            ></span>
          {/each}
        </div>
      {/each}
    </div>
    <div class="legend caption muted" aria-hidden="true">
      <span>{t("progress.less")}</span>
      <span class="cell l0"></span><span class="cell l1"></span><span class="cell l2"></span><span class="cell l3"></span>
      <span>{t("progress.more")}</span>
    </div>
  </div>

  {#if hard > 0}
    <a class="hard card" href={href.practice("alles", "leren", "front", "hard")}>
      <span class="hard-ic"><Icon name="learn" size={24} /></span>
      <span class="hard-txt">
        <span class="hard-title">{t("home.hard")}</span>
        <span class="small muted">{tp("home.hardCount", hard)}</span>
      </span>
      <Icon name="chevron" size={20} />
    </a>
  {/if}

  {#if app.decks.length}
    <h2 class="section-title">{t("progress.perList")}</h2>
    <ul class="per-list card">
      {#each app.decks as deck (deck.id)}
        {@const pct = app.knownPct(deck.id)}
        <li>
          <a href={href.deck(deck.id)}>
            <SubjectBadge subject={deck.subject || deck.name} size="sm" />
            <span class="pl-name">{deck.name}</span>
            <span class="bar pl-bar" aria-hidden="true"><span style:width="{pct}%"></span></span>
            <span class="caption num pl-pct">{t("lists.learned", { p: pct })}</span>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">{t("progress.empty")}</p>
  {/if}
</section>

<style>
  .progress {
    display: grid;
    gap: 1rem;
  }
  .top {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .streak,
  .week {
    display: grid;
    justify-items: start;
    gap: 0.125rem;
    padding: 1.25rem;
  }
  .week h2 {
    font-size: var(--fs-small);
    color: var(--ink-2);
    margin-bottom: 0.25rem;
  }
  .flame {
    color: var(--line-strong);
    margin-bottom: 0.25rem;
  }
  .flame.lit {
    color: var(--flame);
  }
  .big {
    font-size: 2.5rem;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.03em;
  }
  .label {
    font-weight: 700;
  }
  .cal {
    display: grid;
    gap: 0.75rem;
  }
  .cal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .heat {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 4px;
    max-width: 520px;
  }
  .col {
    display: grid;
    gap: 4px;
  }
  .cell {
    display: block;
    aspect-ratio: 1;
    border-radius: 4px;
    background: var(--heat-0);
  }
  .cell.l-1 {
    background: transparent;
    border: 1px dashed var(--line);
  }
  .cell.l1 { background: var(--heat-1); }
  .cell.l2 { background: var(--heat-2); }
  .cell.l3 { background: var(--heat-3); }
  .cell.today {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }
  .legend {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .legend .cell {
    width: 14px;
  }
  .hard {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.125rem;
    color: var(--ink-2);
    text-decoration: none;
  }
  .hard-ic {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--warn-soft);
    color: var(--warn);
    flex: none;
  }
  .hard-txt {
    display: grid;
    flex: 1;
  }
  .hard-title {
    font-weight: 700;
    color: var(--ink);
  }
  .per-list {
    margin: 0;
    padding: 0.25rem 0;
    list-style: none;
  }
  .per-list li + li {
    border-top: 1px solid var(--line);
  }
  .per-list a {
    display: grid;
    grid-template-columns: auto 1fr 120px auto;
    align-items: center;
    gap: 0.75rem;
    min-height: 56px;
    padding: 0.5rem 1rem;
    color: var(--ink);
    text-decoration: none;
  }
  .pl-name {
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .pl-bar > span {
    background: var(--good-fill);
  }
  .pl-pct {
    color: var(--ink-2);
    min-width: 5.5rem;
    text-align: right;
  }
  @media (max-width: 520px) {
    .per-list a {
      grid-template-columns: auto 1fr auto;
    }
    .pl-bar {
      display: none;
    }
  }
</style>
