<script lang="ts">
  import { tick } from "svelte";
  import { getLang, num, t, tp } from "../i18n/index.svelte";
  import Banners from "../components/Banners.svelte";
  import Icon from "../components/Icon.svelte";
  import ListCard from "../components/ListCard.svelte";
  import Logo from "../components/Logo.svelte";
  import NewMenu from "../components/NewMenu.svelte";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { app } from "../lib/app.svelte";
  import { formatDay } from "../lib/dates";
  import { newId } from "../lib/db";
  import { demoLists, demoQuiz } from "../lib/demo";
  import { examPlan } from "../lib/plan";
  import { href, parseHash } from "../lib/router";
  import { peekSession } from "../lib/resume";

  const due = $derived(app.dueCount());
  const next = $derived(app.nextDue());
  const hard = $derived(app.hardCount());
  const starred = $derived(app.starredCount());
  const s = $derived(app.streak());
  const left = $derived(Math.max(0, app.settings.dailyGoal - app.answersToday()));
  const hour = new Date().getHours();
  const greeting = $derived(hour < 12 ? t("home.morning") : hour < 18 ? t("home.afternoon") : t("home.evening"));
  const exams = $derived(
    app.upcomingExams().slice(0, 3).map((deck) => ({ deck, plan: examPlan(app.cardsIn(deck.id), app.today, deck.examDate!) })),
  );
  const subjects = $derived(app.subjects(t("lists.noSubject")));
  const recent = $derived(app.byRecent().slice(0, 4));
  // A practice left halfway today, if its list still exists.
  const saved = peekSession();
  const savedRoute = saved ? parseHash(`#/oefenen/${saved.key}`) : null;
  const savedDeck = savedRoute?.name === "practice" && savedRoute.scope !== "alles" ? app.deck(savedRoute.scope) : undefined;
  let busy = $state(false);

  function examTag(day: string): string {
    return formatDay(day, getLang(), { weekday: "short", day: "numeric", month: "short" });
  }

  async function loadDemo() {
    busy = true;
    try {
      const lang = getLang();
      for (const { deck, cards } of demoLists(lang, { french: t("demo.french"), economics: t("demo.economics"), history: t("demo.history") })) {
        const d = await app.createDeck(deck);
        await app.addCards(d.id, cards);
      }
      await app.saveQuiz(demoQuiz(lang, newId));
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
  <section class="welcome">
    <span class="logo-phone"><Logo /></span>
    <h1>{t("home.welcome")}</h1>
    <p class="muted">{t("home.welcomeBody")}</p>
    <div class="rows menu"><NewMenu /></div>
    <div class="row">
      <button type="button" class="btn" disabled={busy} onclick={loadDemo}>{t("home.demo")}</button>
      <a class="btn btn-quiet" href={href.help()}>{t("help.link")}</a>
    </div>
  </section>
{:else}
  <section class="home">
    <h1 class="visually-hidden">{greeting}</h1>
    <div class="topline">
      <a class="search-link" href={href.lists()}><Icon name="search" size={20} />{t("home.search")}</a>
      <a class="flame" class:lit={s.today} href={href.progress()} aria-label={tp("home.streak", s.days)}>
        <Icon name="flame" size={20} filled /><span class="num">{num(s.days)}</span>
      </a>
    </div>

    <div class="hero">
      <div class="hero-text">
        <p class="hero-label">{t("home.review")}</p>
        {#if due > 0}
          <p class="hero-num num">{num(due)}</p>
          <p class="hero-sub">{tp("home.due", due)}</p>
        {:else}
          <p class="hero-done">{t("home.nothingDue")}</p>
          {#if next}<p class="hero-sub">{t("home.nextDue", { date: formatDay(next, getLang()) })}</p>{/if}
        {/if}
        <p class="goal">{left === 0 ? t("result.goalDone") : tp("result.goalLeft", left)}</p>
      </div>
      {#if due > 0}
        <a class="start" href={href.review()} aria-label={t("home.startReview")}><Icon name="play" size={18} />{t("home.start")}</a>
      {/if}
    </div>

    {#if saved && savedRoute?.name === "practice" && savedDeck}
      <a class="continue" href={`#/oefenen/${saved.key}`}>
        <Icon name="play" size={18} />
        <span class="row-main">
          <span class="row-title">{t("home.continue", { list: savedDeck.name })}</span>
          <span class="row-sub">{tp("home.continueMeta", saved.left, { mode: t(`mode.${savedRoute.mode}`) })}</span>
        </span>
        <Icon name="chevron" size={20} />
      </a>
    {/if}

    <h2 class="sect">{t("home.items")}</h2>
    <ul class="chips">
      <li><a class="chip" href={href.lists()}><Icon name="lists" size={20} />{t("nav.lists")} <span class="count">{app.decks.length}</span></a></li>
      <li><a class="chip" href={href.quizzes()}><Icon name="quiz" size={20} />{t("quiz.title")} <span class="count">{app.quizzes.length}</span></a></li>
      {#if hard > 0}
        <li><a class="chip" href={href.practice("alles", "leren", "front", "hard")}><Icon name="learn" size={20} />{t("home.hard")} <span class="count">{hard}</span></a></li>
      {/if}
      {#if starred > 0}
        <li><a class="chip" href={href.practice("alles", "flashcards", "front", "starred")}><Icon name="star" size={20} />{t("home.starred")} <span class="count">{starred}</span></a></li>
      {/if}
    </ul>

    {#if exams.length > 0}
      <h2 class="sect">{t("home.exams")}</h2>
      <ul class="rows">
        {#each exams as { deck, plan } (deck.id)}
          <li>
            <a class="row-item" href={href.deck(deck.id)}>
              <SubjectBadge subject={deck.subject} lang={deck.langFront} />
              <span class="row-main">
                <span class="row-title">{deck.name}</span>
                <span class="row-sub">{plan && plan.target > 0 ? `${tp("exam.left", plan.toLearn)} ${tp("exam.plan", plan.target)}` : t("exam.ready")}</span>
              </span>
              <span class="tag">{examTag(deck.examDate!)}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}

    <h2 class="sect">{t("home.subjects")}</h2>
    <ul class="chips">
      {#each subjects as sub (sub.name)}
        <li><a class="chip" href={href.lists(sub.name)}><SubjectBadge subject={sub.name} size={22} />{sub.name}</a></li>
      {/each}
    </ul>

    <div class="sect-head">
      <h2>{t("home.recent")}</h2>
      <a class="btn btn-quiet" href={href.lists()}>{t("home.allLists")}</a>
    </div>
    <ul class="rows">
      {#each recent as deck (deck.id)}
        <li><ListCard {deck} /></li>
      {/each}
    </ul>

    <Banners />
  </section>
{/if}

<style>
  .welcome {
    display: grid;
    gap: 1rem;
  }
  .logo-phone {
    margin-bottom: 1rem;
  }
  .menu {
    padding: 0.25rem 0;
  }
  .home {
    display: grid;
  }
  .topline {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .search-link,
  .flame {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-height: 44px;
    padding: 0 1rem;
    border-radius: var(--r-pill);
    background: var(--surface);
    color: var(--ink-2);
    font-weight: 700;
    text-decoration: none;
  }
  .search-link {
    flex: 1;
  }
  .flame {
    color: var(--ink);
    gap: 0.375rem;
  }
  .flame :global(.icon) {
    color: var(--ink-2);
  }
  .flame.lit :global(.icon) {
    color: var(--flame);
  }
  :global(:root[data-theme="light"]) .search-link,
  :global(:root[data-theme="light"]) .flame {
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem;
    border-radius: var(--r-md);
    background: var(--brand);
    color: var(--on-brand);
  }
  .hero-text {
    display: grid;
    gap: 0.125rem;
  }
  .hero-label {
    font-weight: 700;
  }
  .hero-num {
    font-size: var(--fs-hero);
    font-weight: 900;
    line-height: 1;
  }
  .hero-sub {
    font-weight: 700;
  }
  .hero-done {
    font-size: var(--fs-section);
    font-weight: 900;
  }
  .goal {
    margin-top: 0.5rem;
    font-size: var(--fs-small);
  }
  .start {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 48px;
    padding: 0 1.375rem;
    border-radius: var(--r-pill);
    background: #ffffff;
    color: #1046d6;
    box-shadow: 0 var(--edge) 0 rgb(0 0 0 / 0.2);
    font-size: var(--fs-lead);
    font-weight: 900;
    text-decoration: none;
    transition: transform var(--t-press) var(--ease), box-shadow var(--t-press) var(--ease);
  }
  .start:active {
    transform: translateY(var(--edge));
    box-shadow: 0 0 0 rgb(0 0 0 / 0.2);
  }
  .start:focus-visible {
    outline-color: #ffffff;
  }

  .continue {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-top: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: var(--r-md);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }
  .continue > :global(.icon:first-child) {
    color: var(--green);
  }

  .sect {
    margin: 1.5rem 0 0.625rem;
  }
  .sect-head {
    margin: 1.5rem 0 0.375rem;
  }
  .count {
    color: var(--ink-2);
  }
  .home > :global(.banners) {
    margin-top: 1.5rem;
  }
</style>
