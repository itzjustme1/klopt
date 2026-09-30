<script lang="ts">
  import { tick, untrack } from "svelte";
  import { t, tp } from "../i18n/index.svelte";
  import BoxRow from "../components/BoxRow.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";
  import { nextBox } from "../lib/scheduler";
import { buildSession } from "../lib/session";
  import { GRADES, type Grade } from "../lib/types";

  let { deckId }: { deckId?: string } = $props();

  // The session is fixed when the screen opens; grading changes due dates but not the queue.
  const queue = untrack(() => buildSession(app.cardsIn(deckId), app.today).map((c) => c.id));
  let index = $state(0);
  let flipped = $state(false);
  let results = $state({ fout: 0, twijfel: 0, goed: 0 });
  let note = $state<{ text: string; box: number; key: number } | null>(null);
  let noteTimer: ReturnType<typeof setTimeout> | undefined;
  let cardEl: HTMLElement | undefined = $state();
  let doneHeading: HTMLElement | undefined = $state();

  const total = queue.length;
  const finished = $derived(index >= total);
  const card = $derived(finished ? undefined : app.cards.find((c) => c.id === queue[index]));
  const deck = $derived(card ? app.deck(card.deckId) : undefined);
  const counts = $derived(app.boxCounts(deckId));

  // A card deleted elsewhere mid-session is skipped.
  $effect(() => {
    if (!finished && !card) index++;
  });

  $effect(() => {
    if (finished) doneHeading?.focus();
  });

  $effect(() => () => clearTimeout(noteTimer));

  function flip() {
    if (!card || flipped) return;
    flipped = true;
    // Keep focus on the card (the "show answer" button disappears), never on a grade button.
    cardEl?.focus({ preventScroll: true });
  }

  /** Moves on immediately (so a fast next keypress isn't lost) and saves in the background. */
  async function grade(g: Grade) {
    if (!card || !flipped) return;
    const id = card.id;
    const fromBox = card.box;
    const toBox = nextBox(fromBox, g);
    results[g]++;
    const key = toBox === fromBox ? "review.stays" : toBox < fromBox ? "review.backTo" : "review.toBox";
    note = { text: t(key, { n: toBox }), box: toBox, key: (note?.key ?? 0) + 1 };
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (note = null), 2200);
    flipped = false;
    index++;
    try {
      await app.grade(id, g);
    } catch {
      app.showFlash(t("common.saveFailed"));
    }
    await tick();
    if (!finished && document.activeElement === document.body) cardEl?.focus({ preventScroll: true });
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    if (finished) return;
    if (e.key === " " || e.code === "Space") {
      // Let Space activate a focused button (grades, stop) as usual.
      if (el?.tagName === "BUTTON" || el?.tagName === "A") return;
      e.preventDefault();
      flip();
    } else if (flipped && (e.key === "1" || e.key === "2" || e.key === "3")) {
      e.preventDefault();
      void grade(GRADES[Number(e.key) - 1]!);
    }
  }

  function cardKey(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip();
    }
  }
</script>

<svelte:window {onkeydown} />

<section class="review">
  <h1 class="visually-hidden">{t("review.title")}</h1>

  {#if total === 0}
    <div class="nothing">
      <p>{t("review.nothing")}</p>
      <a class="btn btn-primary" href={href.today()}>{t("review.backHome")}</a>
    </div>
  {:else if finished}
    <article class="index-card summary" aria-labelledby="done-title">
      <div class="head"><span>{t("review.title")}</span><span>{tp("common.cardsCount", total)}</span></div>
      <div class="body">
        <h2 id="done-title" tabindex="-1" bind:this={doneHeading}>{t("done.title")}</h2>
        <p>{tp("done.summary", total)}</p>
        <dl class="tally">
          {#each GRADES as g (g)}
            <div class={g}><dt>{t(`grade.${g}`)}</dt><dd class="mono">{results[g]}</dd></div>
          {/each}
        </dl>
        <p class="hand" class:quiet={results.fout === 0}>
          {results.fout > 0 ? tp("done.wrong", results.fout) : t("done.noneWrong")}
        </p>
      </div>
    </article>
    <a class="btn btn-primary home" href={href.today()}>{t("done.home")}</a>
    {@render boxes()}
  {:else if card}
    <div class="topline">
      <p class="progress mono" aria-live="polite">{t("review.progress", { i: index + 1, n: total })}</p>
      <a class="btn btn-quiet" href={href.today()}>{t("review.stop")}</a>
    </div>

    <div class="meter" aria-hidden="true"><span style:width="{(index / total) * 100}%"></span></div>

    {#key card.id}
      <!-- It is a button (tabindex 0) until flipped, then a plain focus target (tabindex -1). -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="flipper"
        class:flipped
        role={flipped ? undefined : "button"}
        tabindex={flipped ? -1 : 0}
        aria-label={flipped ? undefined : `${t("review.question")}: ${card.front}. ${t("review.show")}`}
        onclick={flip}
        onkeydown={cardKey}
        bind:this={cardEl}
      >
        <article class="index-card face front" aria-hidden={flipped}>
          <div class="head">
            <span>{t("review.question")}</span>
            <span class="deckname" lang={deck?.lang}>{deck?.name}</span>
          </div>
          <p class="body q" lang={deck?.lang}>{card.front}</p>
        </article>
        <article class="index-card face back" aria-hidden={!flipped}>
          <div class="head">
            <span>{t("review.answer")}</span>
            <span>{t("box.label", { n: card.box })}</span>
          </div>
          <div class="body">
            <p class="q-small" lang={deck?.lang}>{card.front}</p>
            <p class="a" lang={deck?.lang}><span class="highlight">{card.back}</span></p>
          </div>
        </article>
      </div>
    {/key}

    <p class="visually-hidden" aria-live="polite">
      {#if flipped}{t("review.answer")}: {card.back}{/if}
    </p>

    <div class="controls">
      {#if !flipped}
        <button type="button" class="btn btn-primary btn-block show" onclick={flip}>{t("review.show")}</button>
        <p class="hint small muted">{t("review.flipHint")}</p>
      {:else}
        <div class="grades" role="group" aria-label={t("review.gradesLabel")}>
          {#each GRADES as g, i (g)}
            <button type="button" class="btn grade {g}" onclick={() => grade(g)} aria-keyshortcuts={String(i + 1)}>
              <span>{t(`grade.${g}`)}</span><kbd class="mono" aria-hidden="true">{i + 1}</kbd>
            </button>
          {/each}
        </div>
        <p class="hint small muted">{t("review.gradeHint")}</p>
      {/if}
    </div>

    {@render boxes(card.box)}
  {/if}
</section>

{#snippet boxes(current?: number)}
  <div class="boxes-wrap">
    <p class="note hand" aria-live="polite">
      {#if note}{#key note.key}<span class="note-text">{note.text}</span>{/key}{/if}
    </p>
    <BoxRow {counts} {current} flash={note ?? undefined} />
  </div>
{/snippet}

<style>
  .review {
    display: grid;
    gap: 1rem;
    max-width: 36rem;
    margin-inline: auto;
  }
  .nothing {
    display: grid;
    justify-items: start;
    gap: 1rem;
  }

  .topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .progress {
    font-size: 0.875rem;
    color: var(--ink-2);
  }
  .meter {
    height: 2px;
    background: var(--line);
    margin-top: -0.5rem;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--ink);
    transition: width 240ms var(--ease);
  }

  /* Both faces share one grid cell so the card is as tall as its tallest side. */
  .flipper {
    display: grid;
    perspective: 1400px;
    cursor: pointer;
    margin: 0.5rem 6px 6px 0;
    border-radius: var(--radius);
    -webkit-user-select: none;
    user-select: none;
  }
  .flipper.flipped {
    cursor: default;
    -webkit-user-select: text;
    user-select: text;
  }
  .flipper:focus-visible {
    outline-offset: 6px;
  }
  .face {
    grid-area: 1 / 1;
    min-height: 15rem;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    transition: transform 420ms var(--ease);
  }
  .front {
    transform: rotateY(0deg);
  }
  .back {
    transform: rotateY(180deg);
  }
  .flipped .front {
    transform: rotateY(-180deg);
  }
  .flipped .back {
    transform: rotateY(0deg);
  }
  .deckname {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60%;
  }
  .q {
    font-size: 1.375rem;
    padding-top: 2rem;
  }
  .q-small {
    color: var(--ink-2);
    font-size: 1rem;
  }
  .a {
    font-size: 1.25rem;
    margin-top: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .face {
      transition: opacity 1ms;
      transform: none !important;
    }
    .flipped .front,
    .flipper:not(.flipped) .back {
      opacity: 0;
      visibility: hidden;
    }
  }

  .controls {
    display: grid;
    gap: 0.5rem;
    min-height: 5.5rem;
  }
  .show {
    min-height: 3.25rem;
  }
  .hint {
    text-align: center;
  }
  .grades {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }
  .grade {
    min-height: 3.25rem;
    justify-content: space-between;
    padding-inline: 0.875rem;
  }
  .grade kbd {
    font-size: 0.75rem;
    font-weight: 400;
    padding: 0 0.3rem;
    border: 1px solid currentColor;
    border-radius: 2px;
    opacity: 0.7;
  }
  .grade.fout {
    border-color: var(--accent);
    color: var(--accent);
  }
  .grade.fout:hover {
    background: var(--accent);
    color: var(--on-accent);
  }
  .grade.goed {
    background: var(--good);
    border-color: var(--good);
    color: var(--on-good);
  }
  .grade.goed:hover {
    filter: brightness(1.08);
  }

  .boxes-wrap {
    position: relative;
    margin-top: 0.5rem;
  }
  .note {
    min-height: 2.25rem;
    margin-bottom: 0.25rem;
    font-size: 2.25rem;
  }
  .note-text {
    display: inline-block;
    animation: note-in 2200ms var(--ease) forwards;
  }
  @keyframes note-in {
    0% {
      opacity: 0;
      transform: translateY(4px) rotate(-2deg);
    }
    10%,
    80% {
      opacity: 1;
      transform: translateY(0) rotate(-2deg);
    }
    100% {
      opacity: 0;
      transform: rotate(-2deg);
    }
  }

  .summary .body {
    padding-top: 2rem;
    font-family: var(--font-ui);
    font-size: 1.0625rem;
    white-space: normal;
  }
  .summary h2 {
    font-size: 1.75rem;
    line-height: 2rem;
  }
  .tally {
    display: flex;
    gap: 1.5rem;
    margin: 0;
  }
  .tally div {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
  }
  .tally dt {
    color: var(--ink-2);
  }
  .tally dd {
    margin: 0;
    font-weight: 500;
    font-size: 1.25rem;
  }
  .tally .fout dd {
    color: var(--accent);
  }
  .summary .hand {
    font-size: 1.875rem;
    line-height: 2rem;
  }
  .summary .hand.quiet {
    color: var(--ink-2);
  }
  .home {
    justify-self: start;
    margin-top: 0.5rem;
  }
</style>
