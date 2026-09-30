<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";
  import type { Deck } from "../lib/types";
  import Flag from "./Flag.svelte";
  import SubjectBadge from "./SubjectBadge.svelte";

  let { deck }: { deck: Deck } = $props();

  const count = $derived(app.cardsIn(deck.id).length);
  const due = $derived(app.dueCount(deck.id));
  const known = $derived(app.knownPct(deck.id));
  const twoLangs = $derived(deck.langFront !== deck.langBack);
</script>

<a class="list-card card" href={href.deck(deck.id)}>
  <div class="top">
    <SubjectBadge subject={deck.subject || deck.name} />
    <div class="titles">
      <span class="name">{deck.name}</span>
      <span class="meta small">
        {tp("common.wordsCount", count)}
        {#if twoLangs}
          <span class="langs" aria-label={t("lists.langs", { a: t(`lang.${deck.langFront}`), b: t(`lang.${deck.langBack}`) })}>
            <Flag lang={deck.langFront} size={18} /><span aria-hidden="true" class="to">›</span><Flag lang={deck.langBack} size={18} />
          </span>
        {/if}
      </span>
    </div>
    {#if due > 0}<span class="due caption">{tp("lists.due", due)}</span>{/if}
  </div>
  <div class="known">
    <div class="bar" aria-hidden="true"><span style:width="{known}%"></span></div>
    <span class="caption muted">{t("lists.learned", { p: known })}</span>
  </div>
</a>

<style>
  .list-card {
    display: grid;
    gap: 1rem;
    padding: 1rem 1.25rem;
    color: inherit;
    text-decoration: none;
    border: 2px solid transparent;
    transition: border-color var(--t-base) var(--ease);
  }
  .list-card:hover {
    border-color: var(--accent);
  }
  .top {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }
  .titles {
    display: grid;
    gap: 0.125rem;
    min-width: 0;
    flex: 1;
  }
  .name {
    font-weight: 800;
    font-size: var(--fs-lead);
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .meta {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--ink-2);
    flex-wrap: wrap;
    font-weight: 400;
  }
  .langs {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .due {
    flex: none;
    align-self: flex-start;
    padding: 0.25rem 0.75rem;
    border-radius: var(--r-pill);
    background: var(--yellow-soft);
    border: 2px solid var(--yellow);
    color: var(--ink);
  }
  .known {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.75rem;
  }
  .known .bar > span {
    background: var(--cta);
  }
</style>
