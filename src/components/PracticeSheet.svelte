<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import { app } from "../lib/app.svelte";
  import { MODE_ICON } from "../lib/modeStyle";
  import { href, type Count } from "../lib/router";
  import type { Mode } from "../lib/types";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";

  /** "Oefen met" for several lists at once (a folder, or lists picked on the Lists screen). */
  let { scope, title, onclose }: { scope: string; title: string; onclose: () => void } = $props();

  const decks = $derived(app.scopeDecks(scope) ?? app.decks);
  const total = $derived(decks.reduce((n, d) => n + app.cardsIn(d.id).length, 0));
  const allTerms = $derived(decks.every((d) => d.kind === "terms"));
  const allForms = $derived(decks.every((d) => d.kind === "forms"));
  const modes = $derived<Exclude<Mode, "herhalen">[]>(
    // The verb-forms drill works on one list at a time, so it is not offered here.
    allForms ? ["leren", "flashcards", "meerkeuze", "typen"] : allTerms ? ["flashcards", "leren", "meerkeuze", "toets", "koppelen"] : ["leren", "toets", "flashcards", "meerkeuze", "typen", "spelling", "koppelen"],
  );
  const recommended = $derived(allTerms ? "flashcards" : "leren");
  let count = $state<"10" | "20" | "all">("all");
  const countValue = $derived<Count>(count === "all" ? "all" : (Number(count) as 10 | 20));
</script>

<Sheet {title} {onclose}>
  <p class="small muted intro">{tp("multi.summary", total, { lists: decks.length })}</p>
  {#if total > 10}
    <fieldset class="fieldset-wrap count">
      <legend>{t("deck.count")}</legend>
      <div class="segmented">
        <label><input type="radio" name="multi-count" value="10" bind:group={count} />10</label>
        {#if total > 20}<label><input type="radio" name="multi-count" value="20" bind:group={count} />20</label>{/if}
        <label><input type="radio" name="multi-count" value="all" bind:group={count} />{t("deck.countAll")}</label>
      </div>
    </fieldset>
  {/if}
  <ul class="drawer-list">
    <li>
      <a class="drawer-item" href={href.practice(scope, "herhalen", "front", "due")} onclick={onclose}>
        <Icon name={MODE_ICON.herhalen} />{t("mode.herhalen")}<span class="hint">{tp("lists.due", decks.reduce((n, d) => n + app.dueCount(d.id), 0))}</span>
      </a>
    </li>
    {#each modes as m (m)}
      <li>
        <a class="drawer-item" href={href.practice(scope, m, "front", "all", countValue)} onclick={onclose}>
          <Icon name={MODE_ICON[m]} />{t(`mode.${m}`)}
          {#if m === recommended}<span class="tag">{t("deck.recommended")}</span>{/if}
        </a>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .intro {
    padding: 0.5rem 1.25rem 0;
  }
  .count {
    padding: 0.75rem 1.25rem 0.25rem;
  }
</style>
