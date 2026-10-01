<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import Sheet from "../components/Sheet.svelte";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { app } from "../lib/app.svelte";
  import { addDays, formatDay, isValidDay } from "../lib/dates";
  import { downloadText } from "../lib/files";
  import { examPlan } from "../lib/plan";
  import { calendarFile, studyPlan, type CalendarEvent, type PlanTask } from "../lib/planner";
  import { href } from "../lib/router";

  const lang = $derived(getLang());
  const exams = $derived(app.upcomingExams());
  const byId = $derived(new Map(exams.map((d) => [d.id, d])));
  const daysOff = $derived(app.settings.studyDaysOff ?? []);
  const input = $derived(
    exams.map((d) => {
      const cards = app.cardsIn(d.id);
      const plan = examPlan(cards, app.today, d.examDate!);
      return { deckId: d.id, examDate: d.examDate!, toLearn: plan?.toLearn ?? 0, total: cards.length, ...(plan ? { todayTarget: plan.target } : {}) };
    }),
  );
  const toLearn = $derived(new Map(input.map((e) => [e.deckId, e])));
  const days = $derived(studyPlan(input, app.today, daysOff));

  /** Monday first; 5 October 2026 is a Monday. */
  const WEEK = [1, 2, 3, 4, 5, 6, 0];
  const weekdayName = (n: number, style: "short" | "long") => formatDay(addDays("2026-10-04", n === 0 ? 7 : n), lang, { weekday: style });

  // Adding a test date to a list.
  let adding = $state(false);
  let pickDeck = $state("");
  let pickDate = $state("");
  let addError = $state("");
  const candidates = $derived(app.decks.filter((d) => !d.examDate || d.examDate < app.today).toSorted((a, b) => a.name.localeCompare(b.name, lang)));

  function openAdd() {
    pickDeck = candidates[0]?.id ?? "";
    pickDate = "";
    addError = "";
    adding = true;
  }

  async function saveExam(e: SubmitEvent) {
    e.preventDefault();
    if (!pickDeck) return;
    if (!isValidDay(pickDate) || pickDate < app.today) return void (addError = t("editor.examPast"));
    try {
      await app.updateDeck(pickDeck, { examDate: pickDate });
      adding = false;
    } catch {
      addError = t("common.saveFailed");
    }
  }

  async function clearExam(id: string) {
    try {
      await app.updateDeck(id, { examDate: "" });
    } catch {
      app.showFlash(t("common.saveFailed"));
    }
  }

  function toggleDay(n: number) {
    const next = daysOff.includes(n) ? daysOff.filter((x) => x !== n) : [...daysOff, n].toSorted();
    void app.saveSettings({ studyDaysOff: next }).catch(() => app.showFlash(t("common.saveFailed")));
  }

  function dayTitle(day: string): string {
    if (day === app.today) return t("planner.today");
    if (day === addDays(app.today, 1)) return t("planner.tomorrow");
    return formatDay(day, lang, { weekday: "long", day: "numeric", month: "long" });
  }

  function taskText(task: PlanTask): string {
    return task.kind === "learn" ? tp("planner.learn", task.words) : tp("planner.review", task.words);
  }

  function taskHref(task: PlanTask): string {
    if (task.kind === "review") return href.practice(task.deckId, "flashcards");
    return href.practice(task.deckId, "leren", "front", "all", task.words <= 10 ? 10 : task.words <= 20 ? 20 : "all");
  }

  function exportCalendar() {
    const events: CalendarEvent[] = [];
    for (const d of exams) {
      events.push({ uid: `exam-${d.id}-${d.examDate}@klopt`, day: d.examDate!, title: t("planner.icsExam", { name: d.name }), ...(d.subject ? { description: d.subject } : {}), remind: true });
    }
    for (const day of days) {
      for (const task of day.tasks) {
        const name = byId.get(task.deckId)?.name ?? "";
        events.push({ uid: `${task.kind}-${task.deckId}-${day.day}@klopt`, day: day.day, title: `${taskText(task)} · ${name}` });
      }
    }
    downloadText("klopt-toetsweek.ics", calendarFile(t("planner.title"), events, new Date()), "text/calendar");
    app.showFlash(t("planner.exported"));
  }
</script>

<PageHead title={t("planner.title")} subtitle={t("planner.sub")} back={{ href: href.today(), label: t("nav.today") }} />

<section class="planner">
  <div class="sect-head">
    <h2>{t("planner.tests")}</h2>
    {#if candidates.length && exams.length}
      <button type="button" class="btn btn-quiet" onclick={openAdd}><Icon name="plus" size={18} />{t("planner.add")}</button>
    {/if}
  </div>
  {#if exams.length}
    <ul class="rows">
      {#each exams as deck (deck.id)}
        {@const plan = toLearn.get(deck.id)}
        <li class="exam-row">
          <a class="row-item" href={href.deck(deck.id)}>
            <SubjectBadge subject={deck.subject} lang={deck.langFront} />
            <span class="row-main">
              <span class="row-title">{deck.name}</span>
              <span class="row-sub">{plan && plan.toLearn > 0 ? tp("exam.left", plan.toLearn) : t("planner.known")}</span>
            </span>
            <span class="tag">{formatDay(deck.examDate!, lang, { weekday: "short", day: "numeric", month: "short" })}</span>
          </a>
          <button type="button" class="icon-btn" aria-label={t("planner.remove", { name: deck.name })} onclick={() => clearExam(deck.id)}><Icon name="x" size={18} /></button>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="card card-pad empty">
      <p>{t("planner.empty")}</p>
      {#if candidates.length}
        <button type="button" class="btn btn-primary" onclick={openAdd}><Icon name="plus" size={18} />{t("planner.add")}</button>
      {:else}
        <a class="btn btn-primary" href={href.newList()}><Icon name="plus" size={18} />{t("planner.makeList")}</a>
      {/if}
    </div>
  {/if}

  <h2 class="sect">{t("planner.noTime")}</h2>
  <ul class="days-off" aria-label={t("planner.noTime")}>
    {#each WEEK as n (n)}
      <li>
        <button type="button" class="chip day-btn" aria-pressed={daysOff.includes(n)} aria-label={weekdayName(n, "long")} onclick={() => toggleDay(n)}>{weekdayName(n, "short")}</button>
      </li>
    {/each}
  </ul>
  <p class="small muted">{t("planner.noTimeHelp")}</p>

  {#if days.length}
    <div class="sect-head">
      <h2>{t("planner.plan")}</h2>
      <button type="button" class="btn btn-quiet" onclick={exportCalendar}><Icon name="calendar" size={18} />{t("planner.export")}</button>
    </div>
    <ol class="days">
      {#each days as day (day.day)}
        <li class="day">
          <h3 class="day-title">{dayTitle(day.day)}</h3>
          <ul class="rows">
            {#each day.exams as id (id)}
              {@const deck = byId.get(id)}
              {#if deck}
                <li class="row-item test"><Icon name="calendar" size={20} /><span class="row-main"><span class="row-title">{t("planner.testOf", { name: deck.name })}</span></span><span class="tag">{t("planner.testTag")}</span></li>
              {/if}
            {/each}
            {#each day.tasks as task (task.deckId + task.kind)}
              {@const deck = byId.get(task.deckId)}
              {#if deck}
                <li>
                  {#if day.day === app.today}
                    <a class="row-item" href={taskHref(task)}>
                      <SubjectBadge subject={deck.subject} lang={deck.langFront} size={28} />
                      <span class="row-main"><span class="row-title">{taskText(task)}</span><span class="row-sub">{deck.name}</span></span>
                      <span class="go"><Icon name="play" size={16} />{t("exam.go")}</span>
                    </a>
                  {:else}
                    <div class="row-item">
                      <SubjectBadge subject={deck.subject} lang={deck.langFront} size={28} />
                      <span class="row-main"><span class="row-title">{taskText(task)}</span><span class="row-sub">{deck.name}</span></span>
                    </div>
                  {/if}
                </li>
              {/if}
            {/each}
            {#if !day.tasks.length && !day.exams.length}
              <li class="row-item rest"><span class="row-main"><span class="row-sub">{day.off ? t("planner.off") : t("planner.free")}</span></span></li>
            {/if}
          </ul>
        </li>
      {/each}
    </ol>
  {/if}
</section>

{#if adding}
  <Sheet title={t("planner.add")} onclose={() => (adding = false)}>
    <form class="add" onsubmit={saveExam} novalidate>
      <div class="field">
        <label for="plan-deck">{t("planner.which")}</label>
        <select id="plan-deck" bind:value={pickDeck}>
          {#each candidates as d (d.id)}<option value={d.id}>{d.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="plan-date">{t("planner.when")}</label>
        <input id="plan-date" type="date" bind:value={pickDate} min={app.today} required />
      </div>
      {#if addError}<p class="error" role="alert">{addError}</p>{/if}
      <button type="submit" class="btn btn-primary btn-lg">{t("common.save")}</button>
    </form>
  </Sheet>
{/if}

<style>
  .planner {
    display: grid;
    gap: 0.75rem;
    max-width: 720px;
  }
  .sect-head {
    margin-top: 0.5rem;
  }
  .sect {
    margin-top: 1rem;
  }
  .exam-row {
    display: flex;
    align-items: center;
  }
  .exam-row .row-item {
    flex: 1;
    min-width: 0;
  }
  .exam-row .icon-btn {
    margin-right: 0.5rem;
  }
  .empty {
    display: grid;
    gap: 0.875rem;
    justify-items: start;
  }
  .planner > :global(*) {
    min-width: 0;
  }
  .days-off {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .day-btn {
    width: 100%;
    justify-content: center;
    padding-inline: 0;
  }
  .days-off .chip[aria-pressed="true"] {
    background: var(--surface-3);
    color: var(--ink-2);
    text-decoration: line-through;
  }
  .days {
    display: grid;
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .day {
    display: grid;
    gap: 0.5rem;
  }
  .day-title {
    font-size: var(--fs-body);
    font-weight: 800;
    color: var(--ink-2);
  }
  .day-title::first-letter {
    text-transform: uppercase;
  }
  .test :global(.icon) {
    color: var(--yellow);
  }
  .go {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--good);
    font-weight: 800;
  }
  .add {
    display: grid;
    gap: 1rem;
    padding: 0.75rem 1.25rem 0.5rem;
  }
  .rest {
    min-height: 0;
  }
</style>
