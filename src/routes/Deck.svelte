<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import CardForm from "../components/CardForm.svelte";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import SharePanel from "../components/SharePanel.svelte";
  import BoxBar from "../components/BoxBar.svelte";
  import { app } from "../lib/app.svelte";
  import { formatDay } from "../lib/dates";
  import { href } from "../lib/router";

  let { id, share = false }: { id: string; share?: boolean } = $props();

  const deck = $derived(app.deck(id));
  const cards = $derived(app.cardsIn(id).toSorted((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
  const due = $derived(app.dueCount(id));

  let editing = $state<string | null>(null);
  let deleting = $state<string | null>(null);
  let formKey = $state(0);

  function dueText(day: string): string {
    return day <= app.today ? t("deck.dueToday") : t("deck.dueOn", { date: formatDay(day, getLang()) });
  }
</script>

{#if !deck}
  <section class="stack">
    <h1>{t("deck.notFound")}</h1>
    <a class="btn" href={href.decks()}>{t("deck.back")}</a>
  </section>
{:else}
  <section class="stack" style:--gap="1.25rem">
    <a class="back small" href={href.decks()}>{t("deck.back")}</a>
    <header class="head">
      <h1 lang={deck.lang}>{deck.name}</h1>
      <p class="muted small">
        {#if deck.subject}<span lang={deck.lang}>{deck.subject}</span> · {/if}{tp("common.cardsCount", cards.length)}
      </p>
      {#if cards.length > 0}<BoxBar counts={app.boxCounts(id)} />{/if}
      <div class="row">
        {#if due > 0}
          <a class="btn btn-primary" href={href.review(id)}>{t("today.reviewDeck")} ({due})</a>
        {/if}
        <a class="btn" href={href.import(id)}>{t("deck.importHere")}</a>
        {#if !share && cards.length > 0}
          <a class="btn" href={href.shareDeck(id)}>{t("decks.share")}</a>
        {/if}
      </div>
    </header>

    {#if share}
      <SharePanel {deck} {cards} onclose={() => (location.hash = href.deck(id))} />
    {/if}

    <div class="panel">
      <h2 class="form-title">{t("deck.addCard")}</h2>
      {#key formKey}
        <CardForm
          lang={deck.lang}
          submitLabel={t("deck.add")}
          autofocus={cards.length === 0 && !share}
          onsubmit={async (v) => {
            await app.addCards(id, [v]);
            formKey++;
            app.showFlash(t("deck.added"));
          }}
        />
      {/key}
    </div>

    {#if cards.length === 0}
      <p class="muted">{t("deck.empty")}</p>
    {:else}
      <h2>{tp("common.cardsCount", cards.length)}</h2>
      <ol class="cards">
        {#each cards as card (card.id)}
          <li class="card">
            {#if editing === card.id}
              <CardForm
                lang={deck.lang}
                initial={card}
                submitLabel={t("common.save")}
                autofocus
                onsubmit={async (v) => {
                  await app.updateCard(card.id, v);
                  editing = null;
                  app.showFlash(t("deck.saved"));
                }}
                oncancel={() => (editing = null)}
              />
            {:else}
              <div class="sides" lang={deck.lang}>
                <p class="front">{card.front}</p>
                <p class="backside">{card.back}</p>
              </div>
              <p class="meta mono">
                {t("deck.cardMeta", { box: card.box, due: dueText(card.due) })}{#if card.topic} · <span lang={deck.lang}>{card.topic}</span>{/if}
              </p>
              {#if deleting === card.id}
                <ConfirmInline
                  message={t("deck.deleteCardConfirm")}
                  confirmLabel={t("common.delete")}
                  onconfirm={async () => {
                    await app.deleteCard(card.id);
                    deleting = null;
                  }}
                  oncancel={() => (deleting = null)}
                />
              {:else}
                <div class="row actions">
                  <button type="button" class="btn btn-quiet" onclick={() => (editing = card.id)}>{t("common.edit")}</button>
                  <button type="button" class="btn btn-quiet danger" onclick={() => (deleting = card.id)}>{t("common.delete")}</button>
                </div>
              {/if}
            {/if}
          </li>
        {/each}
      </ol>
    {/if}
  </section>
{/if}

<style>
  .back {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap);
    color: var(--ink-2);
  }
  .head {
    display: grid;
    gap: 0.625rem;
    margin-top: 0 !important;
  }
  .head h1 {
    overflow-wrap: anywhere;
  }
  .form-title {
    margin-bottom: 1rem;
  }
  .cards {
    display: grid;
    gap: 0.625rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .card {
    display: grid;
    gap: 0.375rem;
    padding: 0.75rem 1rem 0.5rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .sides {
    display: grid;
    gap: 0.25rem;
    font-family: var(--font-card);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .front {
    font-weight: 600;
  }
  .backside {
    color: var(--ink-2);
  }
  .meta {
    font-size: 0.75rem;
    color: var(--ink-2);
  }
  .actions {
    margin-left: -0.5rem;
    gap: 0.25rem;
  }
  .danger {
    color: var(--accent);
  }
</style>
