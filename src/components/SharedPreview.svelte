<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import type { SharedDeck } from "../lib/backup";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";

  let { shared, oncancel }: { shared: SharedDeck; oncancel: () => void } = $props();

  const SHOW = 20;
  let busy = $state(false);

  async function add() {
    busy = true;
    try {
      const deck = await app.importShared(shared);
      app.showFlash(t("receive.added", { name: deck.name }));
      location.replace(href.deck(deck.id));
    } catch {
      app.showFlash(t("common.saveFailed"));
      busy = false;
    }
  }
</script>

<div class="preview">
  <article class="index-card">
    <div class="head">
      <span>{tp("common.cardsCount", shared.cards.length)}</span>
      <span>{t(`lang.${shared.deck.lang}`)}</span>
    </div>
    <div class="body">
      <h2 lang={shared.deck.lang}>{shared.deck.name}</h2>
      {#if shared.deck.subject}<p class="muted" lang={shared.deck.lang}>{shared.deck.subject}</p>{/if}
    </div>
  </article>

  <ol class="cards" lang={shared.deck.lang}>
    {#each shared.cards.slice(0, SHOW) as c, i (i)}
      <li><strong>{c.front}</strong><span>{c.back}</span></li>
    {/each}
  </ol>
  {#if shared.cards.length > SHOW}
    <p class="small muted">{t("receive.shown", { shown: SHOW, total: shared.cards.length })}</p>
  {/if}

  <div class="row">
    <button type="button" class="btn btn-primary" disabled={busy} onclick={add}>{t("receive.add")}</button>
    <button type="button" class="btn" onclick={oncancel}>{t("receive.skip")}</button>
  </div>
</div>

<style>
  .preview {
    display: grid;
    gap: 1rem;
  }
  .preview .index-card {
    margin-right: 6px;
  }
  .preview h2 {
    line-height: 2rem;
    font-family: var(--font-card);
    font-weight: 600;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .preview .body {
    padding-top: 2rem;
  }
  .cards {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--font-card);
  }
  .cards li {
    display: grid;
    gap: 0.125rem;
    padding: 0.625rem 0.875rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .cards span {
    color: var(--ink-2);
  }
</style>
