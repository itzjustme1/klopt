<script lang="ts">
  import { getLang, num, t, tp } from "../i18n/index.svelte";
  import BoxBar from "../components/BoxBar.svelte";
  import { app } from "../lib/app.svelte";
  import { formatDay } from "../lib/dates";
  import { demoCards } from "../lib/demo";
  import { href } from "../lib/router";

  const due = $derived(app.dueCount());
  const next = $derived(app.nextDue());
  const dateLine = $derived(formatDay(app.today, getLang(), { weekday: "long", day: "numeric", month: "long" }));
  let busy = $state(false);

  async function loadDemo() {
    busy = true;
    try {
      const lang = getLang();
      const deck = await app.createDeck({ name: t("demo.name"), lang });
      await app.addCards(deck.id, demoCards(lang));
    } catch {
      app.showFlash(t("common.saveFailed"));
    } finally {
      busy = false;
    }
  }
</script>

<section class="today">
  <p class="date mono">{dateLine}</p>
  <h1 class="visually-hidden">{t("today.title")}</h1>

  {#if app.cards.length === 0}
    <div class="empty">
      <h2>{t("empty.title")}</h2>
      <p>{t("empty.body")}</p>
      <div class="row actions">
        <a class="btn btn-primary" href={href.newDeck()}>{t("empty.create")}</a>
        <a class="btn" href={href.import()}>{t("empty.import")}</a>
      </div>
      <button type="button" class="btn btn-quiet" disabled={busy} onclick={loadDemo}>{t("empty.demo")}</button>

      <article class="index-card how">
        <div class="head"><span>{t("empty.howTitle")}</span></div>
        <p class="body">{t("empty.how")}</p>
      </article>
    </div>
  {:else}
    <div class="hero">
      <p class="count mono" aria-hidden="true">{num(due)}</p>
      <p class="count-label"><span class="visually-hidden">{num(due)} </span>{tp("today.due", due)}</p>
      {#if due > 0}
        <a class="btn btn-primary start" href={href.review()}>{t("today.start")}</a>
      {:else}
        <p class="done">
          <span>{t("today.nothingDue")}</span>
          {#if next}<span>{t("today.nextDue", { date: formatDay(next, getLang()) })}</span>{/if}
        </p>
      {/if}
    </div>
  {/if}

  {#if app.decks.length > 0}
    <h2 class="decks-title">{t("today.decks")}</h2>
    <ul class="decks">
      {#each app.decks as deck (deck.id)}
        {@const deckDue = app.dueCount(deck.id)}
        {@const total = app.cardsIn(deck.id).length}
        <li class="deck">
          <div class="deck-head">
            <a class="deck-name" href={href.deck(deck.id)} lang={deck.lang}>{deck.name}</a>
            <span class="deck-due mono" class:zero={deckDue === 0}>{tp("today.deckDue", deckDue)}</span>
          </div>
          <p class="deck-meta small muted">
            {#if deck.subject}<span lang={deck.lang}>{deck.subject}</span> · {/if}{tp("common.cardsCount", total)}
          </p>
          <BoxBar counts={app.boxCounts(deck.id)} />
          {#if deckDue > 0 && deckDue < due}
            <a class="btn btn-quiet deck-review" href={href.review(deck.id)}>{t("today.reviewDeck")}</a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .date {
    font-size: 0.8125rem;
    color: var(--ink-2);
    margin-bottom: 1.25rem;
  }
  .date::first-letter {
    text-transform: uppercase;
  }

  .hero {
    display: grid;
    justify-items: start;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--line);
  }
  .count {
    font-size: clamp(5rem, 24vw, 8rem);
    font-weight: 500;
    line-height: 0.9;
    letter-spacing: -0.04em;
  }
  .count-label {
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 0.5rem;
  }
  .start {
    margin-top: 1.5rem;
    min-width: min(100%, 16rem);
    min-height: 3.25rem;
    font-size: 1.0625rem;
  }
  .done {
    display: grid;
    gap: 0.25rem;
    margin-top: 0.75rem;
    color: var(--ink-2);
    max-width: 32rem;
  }

  .empty {
    display: grid;
    justify-items: start;
    gap: 1rem;
  }
  .empty h2 {
    font-size: 1.75rem;
  }
  .empty > p {
    max-width: 34rem;
    color: var(--ink-2);
  }
  .actions {
    margin-top: 0.25rem;
  }
  .how {
    margin-top: 1.5rem;
    width: 100%;
    max-width: 34rem;
  }
  .how .body {
    font-size: 1.0625rem;
    padding-top: 0;
  }

  .decks-title {
    margin-top: 2rem;
    margin-bottom: 0.75rem;
  }
  .decks {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .deck {
    padding: 0.875rem 1rem 0.75rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .deck-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }
  .deck-name {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap);
    font-weight: 700;
    font-size: 1.0625rem;
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  .deck-name:hover {
    text-decoration: underline;
  }
  .deck-due {
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
  }
  .deck-due.zero {
    color: var(--ink-2);
    font-weight: 400;
  }
  .deck-meta {
    margin: 0.125rem 0 0.625rem;
  }
  .deck-review {
    margin-top: 0.375rem;
    margin-left: -0.5rem;
  }
</style>
