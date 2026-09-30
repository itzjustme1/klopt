<script lang="ts">
  import { getLang, num, t, tp } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import ListCard from "../components/ListCard.svelte";
  import ExamCard from "../components/ExamCard.svelte";
  import NewOptions from "../components/NewOptions.svelte";
  import StreakCard from "../components/StreakCard.svelte";
  import { app } from "../lib/app.svelte";
  import { formatDay } from "../lib/dates";
  import { demoLists } from "../lib/demo";
  import { href } from "../lib/router";

  const due = $derived(app.dueCount());
  const next = $derived(app.nextDue());
  const hard = $derived(app.hardCount());
  const hour = new Date().getHours();
  const greeting = $derived(hour < 12 ? t("home.morning") : hour < 18 ? t("home.afternoon") : t("home.evening"));
  const exams = $derived(app.upcomingExams().slice(0, 3));
  const recent = $derived(app.decks.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4));
  let busy = $state(false);

  async function loadDemo() {
    busy = true;
    try {
      const lang = getLang();
      for (const { deck, cards } of demoLists(lang, { french: t("demo.french"), economics: t("demo.economics") })) {
        const d = await app.createDeck(deck);
        await app.addCards(d.id, cards);
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
    <h1>{t("home.welcome")}</h1>
    <p class="lead muted">{t("home.welcomeBody")}</p>
    <NewOptions />
    <button type="button" class="btn btn-quiet demo" disabled={busy} onclick={loadDemo}>{t("home.demo")}</button>
  </section>
{:else}
  <section class="home">
    <h1>{greeting}</h1>

    <div class="top-grid">
      <div class="hero">
        <p class="hero-label caption">{t("home.review")}</p>
        {#if due > 0}
          <p class="hero-num num">{num(due)}</p>
          <p class="hero-text">{tp("home.due", due)}</p>
          <a class="btn btn-inverse btn-lg start" href={href.review()}>
            <Icon name="review" size={22} />{t("home.startReview")}
          </a>
        {:else}
          <p class="hero-done">{t("home.nothingDue")}</p>
          {#if next}<p class="hero-text">{t("home.nextDue", { date: formatDay(next, getLang()) })}</p>{/if}
        {/if}
      </div>
      <StreakCard />
    </div>

    {#if exams.length > 0}
      <h2 class="lists-head-title">{t("exam.upcoming")}</h2>
      <div class="exams">
        {#each exams as deck (deck.id)}
          <ExamCard {deck} compact />
        {/each}
      </div>
    {/if}

    {#if hard > 0}
      <a class="hard card" href={href.practice("alles", "leren", "front", "hard")}>
        <span class="hard-ic"><Icon name="learn" size={24} /></span>
        <span class="hard-txt">
          <span class="hard-title">{t("home.hard")}</span>
          <span class="small muted">{tp("home.hardCount", hard)}</span>
        </span>
        <span class="btn btn-primary hard-btn" aria-hidden="true">{t("home.practiceHard")}</span>
      </a>
    {/if}

    <div class="lists-head">
      <h2>{t("home.lists")}</h2>
      <a class="btn btn-quiet" href={href.lists()}>{t("home.allLists")}</a>
    </div>
    <ul class="grid">
      {#each recent as deck (deck.id)}
        <li><ListCard {deck} /></li>
      {/each}
      <li>
        <a class="new card" href={href.newList()}>
          <Icon name="plus" size={24} />
          <span>{t("lists.new")}</span>
        </a>
      </li>
    </ul>
  </section>
{/if}

<style>
  .welcome {
    display: grid;
    gap: 1.25rem;
    max-width: 760px;
  }
  .welcome h1 {
    font-size: var(--fs-display);
  }
  .lead {
    font-size: var(--fs-lead);
    max-width: 36rem;
  }
  .demo {
    justify-self: start;
  }

  .home {
    display: grid;
    gap: 1.25rem;
  }
  .top-grid {
    display: grid;
    gap: 1rem;
  }
  @media (min-width: 820px) {
    .top-grid {
      grid-template-columns: 1.15fr 1fr;
      align-items: stretch;
    }
  }

  .hero {
    display: grid;
    align-content: start;
    justify-items: start;
    gap: 0.25rem;
    padding: 1.5rem;
    border-radius: var(--r-lg);
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: 0 var(--edge) 0 var(--accent-edge);
    margin-bottom: var(--edge);
  }
  .hero-label {
    font-size: var(--fs-small);
  }
  .hero-num {
    font-size: var(--fs-hero);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.04em;
    margin-top: 0.25rem;
  }
  .hero-text {
    font-weight: 700;
    font-size: var(--fs-lead);
  }
  .hero-done {
    font-size: var(--fs-h2);
    font-weight: 800;
    margin-top: 0.25rem;
  }
  .start {
    margin-top: 1.25rem;
  }

  .hard {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    color: inherit;
    text-decoration: none;
  }
  .hard:hover {
    border-color: var(--line-strong);
  }
  .hard-ic {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: var(--r-sm);
    background: var(--warn-soft);
    color: var(--warn);
    flex: none;
  }
  .hard-txt {
    display: grid;
    flex: 1;
    min-width: 0;
  }
  .hard-title {
    font-weight: 700;
  }
  @media (max-width: 480px) {
    .hard-btn {
      display: none;
    }
  }

  .lists-head-title {
    margin-top: 0.75rem;
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
  .lists-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.75rem;
  }
  .grid {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 720px) {
    .grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .new {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 100%;
    padding: 1.5rem;
    border-style: dashed;
    border-width: 2px;
    box-shadow: none;
    background: transparent;
    color: var(--accent-text);
    font-weight: 700;
    text-decoration: none;
  }
  .new:hover {
    background: var(--accent-soft);
  }
</style>
