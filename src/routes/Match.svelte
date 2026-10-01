<script lang="ts">
  import { untrack } from "svelte";
  import { getLang, t, tp } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import { app } from "../lib/app.svelte";
  import { MatchGame } from "../lib/match";
  import { href, type Count, type Which } from "../lib/router";
  import { playRight, playWrong } from "../lib/sounds";

  let { scope, which, count = "all" }: { scope: string; which: Which; count?: Count } = $props();

  let game = $state.raw<MatchGame | null>(null);
  let version = $state(0);
  let wrongTiles = $state<string[]>([]);
  let message = $state("");
  let startedAt = 0;
  let elapsed = $state(0);
  let finishedMs = $state<number | null>(null);
  let best = $state<number | null>(null);
  let newRecord = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let heading: HTMLElement | undefined = $state();

  const exitHref = $derived(scope === "alles" ? href.today() : href.deck(scope));
  const exitLabel = $derived(scope === "alles" ? t("practice.backHome") : t("practice.backToList"));
  const recordKey = $derived(`klopt-match-best-${scope}`);
  const view = $derived.by(() => {
    void version;
    const g = game;
    return g ? { tiles: g.tiles, matched: g.matched, selected: g.selected, round: g.round, rounds: g.rounds.length, roundDone: g.roundDone, finished: g.finished, mistakes: g.mistakes, total: g.total, done: g.matched.size } : null;
  });
  const seconds = (ms: number) => new Intl.NumberFormat(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ms / 1000);

  function readBest(): number | null {
    try {
      const v = Number(localStorage.getItem(recordKey));
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch {
      return null;
    }
  }

  function start() {
    // Tiles are text: picture-only cards sit this game out.
    game = new MatchGame(app.practiceCards(scope, which, count).filter((c) => c.front));
    version++;
    elapsed = 0;
    startedAt = 0;
    finishedMs = null;
    newRecord = false;
    message = "";
    best = readBest();
    clearInterval(timer);
  }

  $effect(() => {
    untrack(start);
    return () => clearInterval(timer);
  });

  function tap(id: string) {
    const g = game;
    if (!g || finishedMs !== null) return;
    if (!startedAt) {
      startedAt = performance.now();
      timer = setInterval(() => (elapsed = performance.now() - startedAt), 100);
    }
    const res = g.select(id);
    if (res.kind === "match") {
      const card = g.tiles.find((x) => x.cardId === res.cardId && x.side === "front")!;
      const other = g.tiles.find((x) => x.cardId === res.cardId && x.side === "back")!;
      message = t("match.pair", { a: card.text, b: other.text });
      if (app.settings.sounds) playRight();
      app.grade(res.cardId, res.grade, "koppelen").catch(() => app.showFlash(t("common.saveFailed")));
      if (g.finished) finish();
    } else if (res.kind === "mismatch") {
      message = t("match.noPair");
      if (app.settings.sounds) playWrong();
      wrongTiles = res.tiles;
      setTimeout(() => (wrongTiles = []), 450);
    }
    version++;
  }

  function finish() {
    clearInterval(timer);
    const ms = performance.now() - startedAt;
    elapsed = ms;
    finishedMs = ms;
    if (best === null || ms < best) {
      newRecord = best !== null;
      best = ms;
      try {
        localStorage.setItem(recordKey, String(Math.round(ms)));
      } catch {
        // Storage unavailable (private mode): the record just isn't kept.
      }
    }
    queueMicrotask(() => heading?.focus());
  }

  function nextRound() {
    game?.nextRound();
    message = "";
    version++;
  }
</script>

<div class="match">
  <header class="p-top">
    <a class="icon-btn" href={exitHref} aria-label={t("practice.stop")}><Icon name="x" /></a>
    <div class="bar p-bar" aria-hidden="true"><span style:width="{view && view.total ? (view.done / view.total) * 100 : 0}%"></span></div>
    <span class="clock caption num" aria-hidden="true">{t("match.seconds", { s: seconds(elapsed) })}</span>
  </header>

  <div class="m-body">
    <h1 class="visually-hidden">{t("mode.koppelen")}</h1>
    {#if view && view.total < 2}
      <div class="card card-pad empty">
        <p>{t("match.tooFew")}</p>
        <a class="btn btn-primary" href={exitHref}>{exitLabel}</a>
      </div>
    {:else if view && finishedMs !== null}
      <section class="done card">
        
        <h2 tabindex="-1" bind:this={heading}>{newRecord ? t("match.newRecord") : t("result.title")}</h2>
        <p class="big num">{t("match.seconds", { s: seconds(finishedMs) })}</p>
        <p class="muted">{t("match.done", { s: seconds(finishedMs) })}</p>
        {#if best !== null}<p class="small muted">{t("match.record", { s: seconds(best) })}</p>{/if}
        {#if view.mistakes > 0}<p class="small">{tp("match.mistakes", view.mistakes)}</p>{/if}
        <div class="row actions">
          <button type="button" class="btn btn-primary btn-lg" onclick={start}>{t("result.again")}</button>
          <a class="btn btn-lg" href={exitHref}>{exitLabel}</a>
        </div>
      </section>
    {:else if view}
      <p class="hint small muted">
        {#if view.rounds > 1}<strong>{t("match.round", { i: view.round + 1, n: view.rounds })}</strong> ·{/if}
        {t("match.hint")}
      </p>
      <div class="grid" role="group" aria-label={t("mode.koppelen")}>
        {#each view.tiles as tile (tile.id)}
          {@const gone = view.matched.has(tile.cardId)}
          <button
            type="button"
            class="tile"
            class:selected={view.selected === tile.id}
            class:wrong={wrongTiles.includes(tile.id)}
            class:gone
            disabled={gone}
            aria-pressed={view.selected === tile.id}
            lang={tile.lang === "xx" ? undefined : tile.lang}
            onclick={() => tap(tile.id)}>{tile.text}</button
          >
        {/each}
      </div>
      <p class="visually-hidden" aria-live="polite">{message}</p>
      {#if view.roundDone && !view.finished}
        <button type="button" class="btn btn-primary btn-lg next" onclick={nextRound}>{t("match.nextRound")}</button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .match {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 100dvh;
  }
  .p-top {
    position: sticky;
    top: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 820px;
    margin-inline: auto;
    padding: calc(0.5rem + env(safe-area-inset-top)) var(--gutter) 0.5rem;
    background: var(--bg);
  }
  .p-bar {
    height: 14px;
  }
  .clock {
    min-width: 4rem;
    text-align: right;
    color: var(--ink-2);
  }
  .m-body {
    display: grid;
    align-content: start;
    gap: 1rem;
    width: 100%;
    max-width: 820px;
    margin-inline: auto;
    padding: 1rem var(--gutter) calc(2rem + env(safe-area-inset-bottom));
  }
  .hint {
    text-align: center;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  @media (min-width: 640px) {
    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (min-width: 900px) {
    .grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .tile {
    min-height: 5.5rem;
    padding: 0.75rem;
    border: 2px solid var(--line);
    border-radius: var(--r-sm);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    line-height: 1.3;
    overflow-wrap: anywhere;
    cursor: pointer;
    box-shadow: 0 var(--edge-2) 0 var(--line-strong);
    margin-bottom: var(--edge-2);
    transition:
      border-color var(--t-base) var(--ease),
      background-color var(--t-base) var(--ease),
      opacity var(--t-base) var(--ease),
      transform var(--t-press) var(--ease);
  }
  .tile:hover:not([disabled], .selected, .wrong) {
    border-color: var(--accent);
  }
  .tile:active:not([disabled]) {
    transform: translateY(var(--edge-2));
  }
  .tile.selected {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }
  .tile.wrong {
    border-color: var(--bad-fill);
    background: var(--bad-soft);
    color: var(--bad);
  }
  .tile.gone {
    opacity: 0;
    transform: scale(0.94);
    cursor: default;
  }
  .next {
    justify-self: center;
  }
  .empty {
    display: grid;
    gap: 1rem;
    justify-items: start;
  }
  .done {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    padding: 2rem 1.25rem 1.5rem;
    text-align: center;
  }
  .done h2 {
    font-size: var(--fs-title);
    font-weight: 800;
  }
  .big {
    font-size: var(--fs-hero);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.04em;
  }
  .actions {
    justify-content: center;
    margin-top: 0.75rem;
  }
</style>
