<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import type { SharedDeck } from "../lib/backup";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";
  import Flag from "./Flag.svelte";
  import SubjectBadge from "./SubjectBadge.svelte";

  let { shared, oncancel, onadded }: { shared: SharedDeck; oncancel: () => void; onadded?: () => Promise<void> | void } = $props();

  const SHOW = 20;
  let busy = $state(false);
  const lf = $derived(shared.deck.langFront);
  const lb = $derived(shared.deck.langBack);

  async function add() {
    busy = true;
    try {
      const deck = await app.importShared(shared);
      await onadded?.();
      app.showFlash(t("receive.added", { name: deck.name }));
      location.replace(href.deck(deck.id));
    } catch {
      app.showFlash(t("common.saveFailed"));
      busy = false;
    }
  }
</script>

<div class="preview">
  <div class="card card-pad head">
    <SubjectBadge subject={shared.deck.subject || shared.deck.name} size={40} />
    <div>
      <h2>{shared.deck.name}</h2>
      <p class="small muted meta">
        {tp("common.wordsCount", shared.cards.length)}
        <span class="langs"><Flag lang={lf} size={18} />{t("lists.langs", { a: t(`lang.${lf}`), b: t(`lang.${lb}`) })}</span>
      </p>
    </div>
  </div>

  <ol class="words card">
    {#each shared.cards.slice(0, SHOW) as c, i (i)}
      <li>
        <strong lang={lf === "xx" ? undefined : lf}>{c.front}</strong>
        <span lang={lb === "xx" ? undefined : lb}>{c.back}</span>
      </li>
    {/each}
  </ol>
  {#if shared.cards.length > SHOW}
    <p class="small muted">{t("receive.shown", { shown: SHOW, total: shared.cards.length })}</p>
  {/if}

  <div class="row">
    <button type="button" class="btn btn-primary btn-lg" disabled={busy} onclick={add}>{t("receive.add")}</button>
    <button type="button" class="btn btn-lg" onclick={oncancel}>{t("receive.skip")}</button>
  </div>
</div>

<style>
  .preview {
    display: grid;
    gap: 1rem;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .head h2 {
    overflow-wrap: anywhere;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .langs {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .words {
    margin: 0;
    padding: 0.25rem 0;
    list-style: none;
  }
  .words li {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--line);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .words li:first-child {
    border-top: 0;
  }
  .words span {
    color: var(--ink-2);
  }
</style>
