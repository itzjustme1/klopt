<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import DeckForm from "../components/DeckForm.svelte";
  import ReceiveFile from "../components/ReceiveFile.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";

  let { create = false }: { create?: boolean } = $props();

  let editing = $state<string | null>(null);
  let deleting = $state<string | null>(null);
</script>

<section class="stack">
  <div class="title-row">
    <h1>{t("decks.title")}</h1>
    {#if !create}
      <a class="btn btn-primary" href={href.newDeck()}>{t("decks.new")}</a>
    {/if}
  </div>

  {#if create}
    <div class="panel">
      <h2 class="form-title">{t("decks.new")}</h2>
      <DeckForm
        initial={{ name: "", lang: getLang(), subject: "" }}
        submitLabel={t("decks.create")}
        onsubmit={async (v) => {
          const deck = await app.createDeck(v);
          location.hash = href.deck(deck.id);
        }}
        oncancel={() => (location.hash = href.decks())}
      />
    </div>
  {/if}

  {#if app.decks.length === 0}
    {#if !create}<p class="muted">{t("decks.none")}</p>{/if}
  {:else}
    <ul class="list">
      {#each app.decks as deck (deck.id)}
        <li class="item">
          {#if editing === deck.id}
            <DeckForm
              initial={{ name: deck.name, lang: deck.lang, subject: deck.subject ?? "" }}
              submitLabel={t("common.save")}
              onsubmit={async (v) => {
                await app.updateDeck(deck.id, v);
                editing = null;
                app.showFlash(t("deck.saved"));
              }}
              oncancel={() => (editing = null)}
            />
          {:else}
            <div class="main">
              <a class="name" href={href.deck(deck.id)} lang={deck.lang}>{deck.name}</a>
              <p class="small muted">
                {#if deck.subject}<span lang={deck.lang}>{deck.subject}</span> · {/if}{t(`lang.${deck.lang}`)} · {tp("common.cardsCount", app.cardsIn(deck.id).length)}
              </p>
            </div>
            {#if deleting === deck.id}
              <ConfirmInline
                message={t("decks.deleteConfirm", { name: deck.name })}
                confirmLabel={t("decks.deleteYes")}
                onconfirm={async () => {
                  await app.deleteDeck(deck.id);
                  deleting = null;
                }}
                oncancel={() => (deleting = null)}
              />
            {:else}
              <div class="row actions">
                <button type="button" class="btn btn-quiet" onclick={() => (editing = deck.id)}>{t("decks.rename")}</button>
                <a class="btn btn-quiet" href={href.shareDeck(deck.id)}>{t("decks.share")}</a>
                <button type="button" class="btn btn-quiet danger" onclick={() => (deleting = deck.id)}>{t("common.delete")}</button>
              </div>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <ReceiveFile />
</section>

<style>
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .form-title {
    margin-bottom: 1rem;
  }
  .list {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .name {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap);
    font-weight: 700;
    font-size: 1.125rem;
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  .name:hover {
    text-decoration: underline;
  }
  .actions {
    margin-left: -0.5rem;
    gap: 0.25rem;
  }
  .danger {
    color: var(--accent);
  }
</style>
