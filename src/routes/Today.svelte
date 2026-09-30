<script lang="ts">
  import { tick } from "svelte";
  import { getLang, num, t, tp } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import Illustration from "../components/Illustration.svelte";
  import NewOptions from "../components/NewOptions.svelte";
  import Banners from "../components/Banners.svelte";
  import ExamCard from "../components/ExamCard.svelte";
  import ListCard from "../components/ListCard.svelte";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { app } from "../lib/app.svelte";
  import { formatDay } from "../lib/dates";
  import { weekDays } from "../lib/history";
  import { demoLists } from "../lib/demo";
  import { href, parseHash } from "../lib/router";
  import { peekSession } from "../lib/resume";

  const due = $derived(app.dueCount());
  const next = $derived(app.nextDue());
  const hard = $derived(app.hardCount());
  const s = $derived(app.streak());
  const left = $derived(Math.max(0, app.settings.dailyGoal - app.answersToday()));
  const week = $derived(weekDays(app.today));
  const practiced = $derived(new Set(app.days.filter((d) => d.answers > 0).map((d) => d.day)));
  const hour = new Date().getHours();
  const greeting = $derived(hour < 12 ? t("home.morning") : hour < 18 ? t("home.afternoon") : t("home.evening"));
  const exams = $derived(app.upcomingExams().slice(0, 3));
  const subjects = $derived(app.subjects(t("lists.noSubject")));
  const recent = $derived(app.byRecent().slice(0, 3));
  // A practice left halfway today, if its list still exists.
  const saved = peekSession();
  const savedRoute = saved ? parseHash(`#/oefenen/${saved.key}`) : null;
  const savedDeck = savedRoute?.name === "practice" && savedRoute.scope !== "alles" ? app.deck(savedRoute.scope) : undefined;
  let busy = $state(false);

  async function loadDemo() {
    busy = true;
    try {
      const lang = getLang();
      for (const { deck, cards } of demoLists(lang, { french: t("demo.french"), economics: t("demo.economics") })) {
        const d = await app.createDeck(deck);
        await app.addCards(d.id, cards);
      }
      // The demo button sits low on a phone: start at the top of the new home screen.
      await tick();
      window.scrollTo(0, 0);
      const h = document.querySelector<HTMLElement>("main h1");
      if (h) {
        h.tabIndex = -1;
        h.focus({ preventScroll: true });
      }
    } catch {
      app.showFlash(t("common.saveFailed"));
    } finally {
      busy = false;
    }
  }
</script>

{#if app.decks.length === 0}
  <div class="home-band band">
    <div class="inner">
      <h1>{t("home.welcome")}</h1>
      <p class="sub">{t("home.welcomeBody")}</p>
    </div>
    <svg class="band-wave" viewBox="0 0 1440 36" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 20C240 2 480 0 720 16s480 20 720-4V36H0z" fill="var(--bg)" /></svg>
  </div>
  <section class="welcome lift">
    <div class="card card-pad welcome-card">
      <Illustration name="stack" size={132} />
      <NewOptions />
    </div>
    <div class="row">
      <button type="button" class="btn btn-brand" disabled={busy} onclick={loadDemo}>{t("home.demo")}</button>
      <a class="btn btn-quiet" href={href.help()}>{t("help.link")}</a>
    </div>
  </section>
{:else}
  <div class="home-band band">
    <div class="inner">
      <div class="top-row">
        <h1>{greeting}!</h1>
        <a class="streak-chip" href={href.progress()} class:lit={s.today} aria-label="{tp('home.streak', s.days)}">
          <Icon name="flame" size={20} filled />{tp("home.streakChip", s.days)}
        </a>
      </div>
      <p class="sub">{left === 0 ? t("result.goalDone") : tp("result.goalLeft", left)}</p>
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
    </div>
    <svg class="band-wave" viewBox="0 0 1440 36" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 20C240 2 480 0 720 16s480 20 720-4V36H0z" fill="var(--bg)" /></svg>
  </div>

  <section class="home lift">
    <div class="grid-top">
      <div class="card hero">
        <div class="hero-text">
          <p class="hero-label">{t("home.review")}</p>
          {#if due > 0}
            <p class="hero-num num">{num(due)}</p>
            <p class="hero-sub">{tp("home.due", due)}</p>
            <a class="btn btn-primary" href={href.review()} aria-label={t("home.startReview")}>{t("home.start")}</a>
          {:else}
            <p class="hero-done">{t("home.nothingDue")}</p>
            {#if next}<p class="hero-sub">{t("home.nextDue", { date: formatDay(next, getLang()) })}</p>{/if}
          {/if}
        </div>
        <Illustration name={due > 0 ? "cards" : "trophy"} size={124} />
      </div>

      {#if saved && savedRoute?.name === "practice" && savedDeck}
        <a class="continue card" href={`#/oefenen/${saved.key}`}>
          <span class="ic-round ic-1 cont-ic"><Icon name="learn" size={24} /></span>
          <span class="cont-txt">
            <span class="cont-title">{t("home.continue", { list: savedDeck.name })}</span>
            <span class="small muted">{tp("home.continueMeta", saved.left, { mode: t(`mode.${savedRoute.mode}`) })}</span>
          </span>
          <Icon name="chevron" size={20} />
        </a>
      {/if}
    </div>

    <Banners />

    {#if exams.length > 0}
      <h2 class="sect-title">{t("home.exams")}</h2>
      <div class="exams">
        {#each exams as deck (deck.id)}
          <ExamCard {deck} compact />
        {/each}
      </div>
    {/if}

    {#if hard > 0}
      <a class="hard card" href={href.practice("alles", "leren", "front", "hard")}>
        <span class="ic-round ic-6 hard-ic"><Icon name="learn" size={22} /></span>
        <span class="hard-txt">
          <span class="hard-title">{t("home.hard")}</span>
          <span class="small muted">{tp("home.hardCount", hard)}</span>
        </span>
        <Icon name="chevron" size={20} />
      </a>
    {/if}

    <div class="sect-head">
      <h2>{t("home.recent")}</h2>
      <a class="btn btn-quiet" href={href.lists()}>{t("home.allLists")}</a>
    </div>
    <ul class="recent">
      {#each recent as deck (deck.id)}
        <li><ListCard {deck} /></li>
      {/each}
    </ul>

    <h2 class="sect-title">{t("home.subjects")}</h2>
    <ul class="tiles">
      {#each subjects as sub (sub.name)}
        <li>
          <a class="tile card" href={href.lists(sub.name)}>
            <SubjectBadge subject={sub.name} />
            <span class="tile-name">{sub.name}</span>
            <span class="small muted">{t("home.subjectMeta", { lists: tp("common.decksCount", sub.decks.length), words: tp("common.wordsCount", sub.words) })}</span>
            <span class="bar known" aria-hidden="true"><span style:width="{sub.known}%"></span></span>
            <span class="visually-hidden">{t("lists.learned", { p: sub.known })}</span>
          </a>
        </li>
      {/each}
      <li>
        <a class="tile tile-new" href={href.newList()}>
          <span class="ic-round new-ic"><Icon name="plus" size={24} /></span>
          <span class="tile-name">{t("lists.new")}</span>
        </a>
      </li>
    </ul>
  </section>
{/if}

<style>
  .home-band {
    width: 100vw;
    margin-left: calc(50% - 50vw);
    margin-top: -1.75rem;
    padding-top: 1rem;
    padding-bottom: 4.5rem;
  }
  .inner {
    display: grid;
    gap: 0.5rem;
    max-width: 1040px;
    margin-inline: auto;
    padding-inline: max(var(--gutter), env(safe-area-inset-left)) max(var(--gutter), env(safe-area-inset-right));
  }
  .home-band h1 {
    font-size: var(--fs-h1);
  }
  @media (min-width: 720px) {
    .home-band h1 {
      font-size: var(--fs-display);
    }
  }
  .sub {
    font-weight: 400;
    color: #ffffff;
    max-width: 38rem;
  }
  .top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .streak-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: var(--tap);
    padding: 0 1rem;
    border-radius: var(--r-pill);
    background: #ffffff;
    color: var(--on-light);
    font-weight: 800;
    text-decoration: none;
    white-space: nowrap;
  }
  .streak-chip :global(.icon) {
    color: var(--on-light-2);
  }
  .streak-chip.lit :global(.icon) {
    color: var(--flame);
  }
  .week {
    display: flex;
    gap: 0.5rem;
    margin: 0.25rem 0 0;
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
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.18);
  }
  .did .dot {
    background: #ffffff;
    color: var(--on-light-accent);
  }
  .today .dot {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
  }
  .wd {
    color: #ffffff;
    text-transform: capitalize;
  }

  .welcome {
    display: grid;
    gap: 1rem;
    max-width: 760px;
  }
  .welcome-card {
    display: grid;
    justify-items: center;
    gap: 1rem;
  }
  .welcome-card :global(.options) {
    width: 100%;
  }

  .home {
    display: grid;
    gap: 1rem;
  }
  .grid-top {
    display: grid;
    gap: 1rem;
  }
  @media (min-width: 820px) {
    .grid-top:has(.continue) {
      grid-template-columns: 1.3fr 1fr;
      align-items: stretch;
    }
  }
  .hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1.25rem 1.25rem 1.5rem;
  }
  .hero-text {
    display: grid;
    justify-items: start;
    gap: 0.25rem;
    min-width: 0;
  }
  .hero-label {
    font-weight: 800;
    color: var(--accent-text);
  }
  .hero-num {
    font-size: var(--fs-hero);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.04em;
  }
  .hero-sub {
    font-weight: 700;
    color: var(--ink-2);
    margin-bottom: 0.75rem;
  }
  .hero-done {
    font-size: var(--fs-h2);
    font-weight: 800;
  }

  .continue,
  .hard {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    color: var(--ink-2);
    text-decoration: none;
  }
  .continue {
    border: 2px solid var(--accent);
  }
  .cont-ic,
  .hard-ic {
    width: 48px;
    height: 48px;
  }
  .cont-txt,
  .hard-txt {
    display: grid;
    flex: 1;
    min-width: 0;
  }
  .cont-title,
  .hard-title {
    color: var(--ink);
    font-weight: 800;
    overflow-wrap: anywhere;
  }
  .exams {
    display: grid;
    gap: 0.75rem;
  }
  @media (min-width: 720px) {
    .exams {
      grid-template-columns: 1fr 1fr;
    }
  }

  .sect-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.5rem;
  }
  .sect-head h2,
  .sect-title {
    font-size: var(--fs-h2);
    font-weight: 800;
  }
  .sect-title {
    margin-top: 0.5rem;
  }
  .recent {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 720px) {
    .recent {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 720px) {
    .tiles {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .tile {
    display: grid;
    align-content: start;
    gap: 0.5rem;
    height: 100%;
    padding: 1rem;
    color: var(--ink);
    text-decoration: none;
    transition: transform var(--t-base) var(--ease), border-color var(--t-base) var(--ease);
  }
  .tile:hover {
    border-color: var(--accent);
  }
  .tile-name {
    font-weight: 800;
    font-size: var(--fs-lead);
    overflow-wrap: anywhere;
  }
  .known > span {
    background: var(--cta);
  }
  .tile-new {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 0.5rem;
    min-height: 10rem;
    border: 2px dashed var(--line-strong);
    border-radius: var(--r-lg);
    color: var(--accent-text);
    text-decoration: none;
  }
  .tile-new:hover {
    background: var(--accent-soft);
  }
  .new-ic {
    width: 48px;
    height: 48px;
    background: var(--accent);
  }
</style>
