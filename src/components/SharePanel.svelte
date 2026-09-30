<script lang="ts">
  import type { Card, Deck } from "../lib/types";
  let { deck, cards, onclose }: { deck: Deck; cards: Card[]; onclose: () => void } = $props();
</script>

<div hidden data-deck={deck.id} data-count={cards.length}><button type="button" onclick={onclose}>x</button></div>
