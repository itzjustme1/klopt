<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";
  import type { Deck } from "../lib/types";
  import DeckActions from "./DeckActions.svelte";
  import Icon from "./Icon.svelte";
  import SubjectBadge from "./SubjectBadge.svelte";

  /** One list as a row: its mark, name, size, what is due, and a ⋯ menu. Goes inside a `.rows` list. */
  let { deck }: { deck: Deck } = $props();

  const count = $derived(app.cardsIn(deck.id).length);
  const due = $derived(app.dueCount(deck.id));
  let menu = $state(false);
</script>

<div class="lc">
  <a class="row-item" href={href.deck(deck.id)}>
    <SubjectBadge subject={deck.subject} lang={deck.langFront} />
    <span class="row-main">
      <span class="row-title">{deck.name}</span>
      <span class="row-sub">{tp(deck.kind === "terms" ? "common.termsCount" : "common.wordsCount", count)}</span>
    </span>
    {#if due > 0}<span class="row-end">{tp("lists.due", due)}</span>{/if}
  </a>
  <button type="button" class="icon-btn more" aria-haspopup="dialog" aria-label={t("deck.actions", { name: deck.name })} title={t("deck.more")} onclick={() => (menu = true)}>
    <Icon name="more" />
  </button>
</div>

{#if menu}
  <DeckActions {deck} onclose={() => (menu = false)} />
{/if}

<style>
  .lc {
    display: flex;
    align-items: center;
  }
  .lc .row-item {
    flex: 1;
    min-width: 0;
  }
  .lc:hover {
    background: var(--surface-2);
  }
  .lc .row-item:hover {
    background: transparent;
  }
  .more {
    margin-right: 0.375rem;
    color: var(--ink-2);
  }
  .more:hover {
    color: var(--ink);
  }
</style>
