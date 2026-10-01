<script lang="ts">
  import { tp } from "../i18n/index.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";
  import type { Deck } from "../lib/types";
  import SubjectBadge from "./SubjectBadge.svelte";

  /** One list as a row: its mark, name, size and what is due. Goes inside a `.rows` list. */
  let { deck }: { deck: Deck } = $props();

  const count = $derived(app.cardsIn(deck.id).length);
  const due = $derived(app.dueCount(deck.id));
</script>

<a class="row-item" href={href.deck(deck.id)}>
  <SubjectBadge subject={deck.subject} lang={deck.langFront} />
  <span class="row-main">
    <span class="row-title">{deck.name}</span>
    <span class="row-sub">{tp("common.wordsCount", count)}</span>
  </span>
  {#if due > 0}<span class="row-end">{tp("lists.due", due)}</span>{/if}
</a>
