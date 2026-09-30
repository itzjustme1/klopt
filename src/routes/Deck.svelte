<script lang="ts">
  import { untrack } from "svelte";
  import { t, tp } from "../i18n/index.svelte";
  import type { StringKey } from "../i18n/types";
  import BoxBar from "../components/BoxBar.svelte";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import Flag from "../components/Flag.svelte";
  import Icon, { type IconName } from "../components/Icon.svelte";
  import SharePanel from "../components/SharePanel.svelte";
  import SpeakButton from "../components/SpeakButton.svelte";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { LIMITS } from "../config";
  import { app } from "../lib/app.svelte";
  import { difficulty } from "../lib/history";
  import type { Direction } from "../lib/practice";
  import { href, type Count, type Which } from "../lib/router";
  import { canSpeak, loadVoices } from "../lib/speech";
  import type { Mode } from "../lib/types";

  let { id, share = false }: { id: string; share?: boolean } = $props();

  const deck = $derived(app.deck(id));
  const cards = $derived(app.sortedCards(id));
  const due = $derived(app.dueCount(id));
  const hard = $derived(app.hardCount(id));
  const diff = $derived(app.diffCounts(id));

  const starred = $derived(app.starredCount(id));
  let dir = $state<Direction>("front");
  let which = $state<Which>("all");
  // Big lists start with a round of 20; small ones with everything.
  let count = $state<string>(untrack(() => (app.cardsIn(id).length > 20 ? "20" : "all")));
  const countValue = $derived<Count>(count === "10" ? 10 : count === "20" ? 20 : "all");
  let deleting = $state(false);
  let voice = $state(false);

  $effect(() => {
    const d = deck;
    if (!d) return;
    void loadVoices().then(() => (voice = (d.langFront !== "xx" && canSpeak(d.langFront)) || (d.langBack !== "xx" && canSpeak(d.langBack))));
  });
  $effect(() => {
    if ((hard === 0 && which === "hard") || (starred === 0 && which === "starred")) which = "all";
  });

  const sameLang = $derived(!deck || deck.langFront === deck.langBack || deck.langFront === "xx" || deck.langBack === "xx");
  const dirLabels = $derived.by(() => {
    if (!deck) return { front: "", back: "" };
    if (sameLang) return { front: t("deck.leftToRight"), back: t("deck.rightToLeft") };
    const a = t(`lang.${deck.langFront}`);
    const b = t(`lang.${deck.langBack}`);
    return { front: t("lists.langs", { a, b }), back: t("lists.langs", { a: b, b: a }) };
  });

  const modes: { mode: Exclude<Mode, "herhalen">; icon: IconName; desc: StringKey }[] = [
    { mode: "leren", icon: "learn", desc: "modeDesc.leren" },
    { mode: "flashcards", icon: "cards", desc: "modeDesc.flashcards" },
    { mode: "meerkeuze", icon: "choice", desc: "modeDesc.meerkeuze" },
    { mode: "typen", icon: "type", desc: "modeDesc.typen" },
    { mode: "dictee", icon: "listen", desc: "modeDesc.dictee" },
    { mode: "toets", icon: "test", desc: "modeDesc.toets" },
  ];

  const DIFF_ORDER = ["vaak", "soms", "goed", "nieuw"] as const;

  let copying = $state(false);
  async function duplicate() {
    if (!deck) return;
    copying = true;
    try {
      const copy = await app.duplicateDeck(id, t("deck.copyName", { name: deck.name.slice(0, LIMITS.deckNameChars - 12) }));
      app.showFlash(t("deck.copied"));
      location.hash = href.deck(copy.id);
    } catch {
      app.showFlash(t("common.saveFailed"));
    } finally {
      copying = false;
    }
  }

  async function remove() {
    await app.deleteDeck(id);
    app.showFlash(t("deck.deleted"));
    location.hash = href.lists();
  }
</script>

{#if !deck}
  <section class="stack">
    <h1>{t("deck.notFound")}</h1>
    <a class="btn" href={href.lists()}>{t("deck.back")}</a>
  </section>
{:else}
  <section class="deck">
    <a class="back small" href={href.lists()}><Icon name="back" size={18} />{t("deck.back")}</a>

    <header class="head">
      <SubjectBadge subject={deck.subject || deck.name} size="lg" />
      <div class="titles">
        <h1>{deck.name}</h1>
        <ul class="meta">
          {#if deck.subject}<li class="chip">{deck.subject}</li>{/if}
          <li class="chip">{tp("common.wordsCount", cards.length)}</li>
          {#if !sameLang}
            <li class="chip">
              <Flag lang={deck.langFront} size={18} /><span class="visually-hidden">{t("lists.langs", { a: t(`lang.${deck.langFront}`), b: t(`lang.${deck.langBack}`) })}</span><span aria-hidden="true">›</span><Flag lang={deck.langBack} size={18} />
            </li>
          {/if}
        </ul>
      </div>
    </header>

    <div class="actions row">
      <a class="btn" href={href.edit(id)}><Icon name="edit" size={20} />{t("common.edit")}</a>
      {#if cards.length > 0 && !share}
        <a class="btn" href={href.shareDeck(id)}><Icon name="share" size={20} />{t("deck.share")}</a>
      {/if}
      {#if cards.length > 0}
        <button type="button" class="btn" disabled={copying} onclick={duplicate}><Icon name="cards" size={20} />{t("deck.copy")}</button>
      {/if}
    </div>

    {#if share}
      <SharePanel {deck} {cards} onclose={() => (location.hash = href.deck(id))} />
    {/if}

    {#if cards.length === 0}
      <div class="card card-pad empty">
        <p>{t("deck.empty")}</p>
        <div class="row">
          <a class="btn btn-primary" href={href.edit(id)}>{t("deck.addWords")}</a>
          <a class="btn" href={href.photo(id)}><Icon name="camera" size={20} />{t("new.photo")}</a>
          <a class="btn" href={href.import(id)}><Icon name="paste" size={20} />{t("new.paste")}</a>
        </div>
      </div>
    {:else}
      {#if due > 0}
        <div class="due-strip">
          <p><strong>{tp("deck.dueHero", due)}</strong></p>
          <a class="btn btn-inverse" href={href.review(id)}><Icon name="review" size={20} />{t("home.startReview")}</a>
        </div>
      {/if}

      <h2 class="section-title">{t("deck.practice")}</h2>
      <div class="options">
        <fieldset class="fieldset-wrap">
          <legend>{t("deck.direction")}</legend>
          <div class="segmented">
            <label><input type="radio" name="dir" value="front" bind:group={dir} />{dirLabels.front}</label>
            <label><input type="radio" name="dir" value="back" bind:group={dir} />{dirLabels.back}</label>
            <label><input type="radio" name="dir" value="mixed" bind:group={dir} />{t("deck.mixed")}</label>
          </div>
        </fieldset>
        <fieldset class="fieldset-wrap">
          <legend>{t("deck.which")}</legend>
          <div class="segmented">
            <label><input type="radio" name="which" value="all" bind:group={which} />{t("deck.allWords", { n: cards.length })}</label>
            <label class:disabled={hard === 0}><input type="radio" name="which" value="hard" bind:group={which} disabled={hard === 0} />{t("deck.hardWords", { n: hard })}</label>
            <label class:disabled={starred === 0}><input type="radio" name="which" value="starred" bind:group={which} disabled={starred === 0} />{t("deck.starredWords", { n: starred })}</label>
          </div>
        </fieldset>
        {#if cards.length > 10}
          <fieldset class="fieldset-wrap">
            <legend>{t("deck.count")}</legend>
            <div class="segmented">
              <label><input type="radio" name="count" value="10" bind:group={count} />10</label>
              {#if cards.length > 20}<label><input type="radio" name="count" value="20" bind:group={count} />20</label>{/if}
              <label><input type="radio" name="count" value="all" bind:group={count} />{t("deck.countAll")}</label>
            </div>
          </fieldset>
        {/if}
      </div>

      <ul class="modes">
        {#each modes as m (m.mode)}
          {@const disabled = m.mode === "dictee" && !voice}
          <li class:featured={m.mode === "leren"}>
            {#if disabled}
              <div class="mode card disabled" aria-disabled="true">
                <span class="mode-ic"><Icon name={m.icon} size={24} /></span>
                <span class="mode-txt">
                  <span class="mode-name">{t(`mode.${m.mode}`)}</span>
                  <span class="small muted">{t("modeDesc.noVoice", { lang: t(`lang.${deck.langFront === "nl" ? deck.langBack : deck.langFront}`) })}</span>
                </span>
              </div>
            {:else}
              <a class="mode card" href={href.practice(id, m.mode, dir, which, countValue)}>
                <span class="mode-ic"><Icon name={m.icon} size={24} /></span>
                <span class="mode-txt">
                  <span class="mode-name">{t(`mode.${m.mode}`)}</span>
                  <span class="small muted">{t(m.desc)}</span>
                </span>
                <Icon name="chevron" size={20} />
              </a>
            {/if}
          </li>
        {/each}
      </ul>

      <h2 class="section-title">{t("deck.progress")}</h2>
      <div class="card card-pad progress">
        <ul class="diff">
          {#each DIFF_ORDER as d (d)}
            <li class="d-{d}">
              <span class="d-num num">{diff[d]}</span>
              <span class="small">{t(`diff.${d}`)}</span>
            </li>
          {/each}
        </ul>
        <div class="boxes">
          <h3>{t("box.title")}</h3>
          <p class="small muted">{t("box.help")}</p>
          <BoxBar counts={app.boxCounts(id)} />
        </div>
      </div>

      <div class="words-head">
        <h2 class="section-title">{t("deck.words")}</h2>
        <a class="btn btn-quiet" href={href.edit(id)}><Icon name="edit" size={18} />{t("common.edit")}</a>
      </div>
      <ol class="words card">
        {#each cards as card (card.id)}
          {@const d = difficulty(card.hist)}
          <li class="word">
            <span class="dot d-{d}" title={t(`diff.${d}`)}></span>
            <span class="visually-hidden">{t("deck.statusLabel", { status: t(`diff.${d}`) })}</span>
            <span class="side s-front">
              <span class="w-front" lang={deck.langFront === "xx" ? undefined : deck.langFront}>{card.front}</span>
              <SpeakButton text={card.front} lang={deck.langFront} size={18} />
            </span>
            <span class="side s-back">
              <span class="w-back" lang={deck.langBack === "xx" ? undefined : deck.langBack}>{card.back}</span>
              <SpeakButton text={card.back} lang={deck.langBack} size={18} />
            </span>
            <button
              type="button"
              class="icon-btn star"
              class:on={card.starred}
              aria-pressed={!!card.starred}
              aria-label={card.starred ? t("deck.unstar", { word: card.front }) : t("deck.star", { word: card.front })}
              onclick={() => app.setStarred(card.id, !card.starred)}
            >
              <Icon name="star" size={20} filled={!!card.starred} />
            </button>
          </li>
        {/each}
      </ol>
    {/if}

    <div class="danger">
      {#if deleting}
        <ConfirmInline message={t("deck.deleteConfirm", { name: deck.name })} confirmLabel={t("deck.deleteYes")} onconfirm={remove} oncancel={() => (deleting = false)} />
      {:else}
        <button type="button" class="btn btn-quiet del" onclick={() => (deleting = true)}><Icon name="trash" size={20} />{t("common.delete")}</button>
      {/if}
    </div>
  </section>
{/if}

<style>
  .deck {
    display: grid;
    gap: 1rem;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .titles {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }
  .titles h1 {
    overflow-wrap: anywhere;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.25rem 0 0;
    padding: 0;
    list-style: none;
  }
  .meta .chip {
    color: var(--ink-2);
  }
  .actions {
    gap: 0.5rem;
  }
  .empty {
    display: grid;
    gap: 1rem;
  }
  .due-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 1rem 1.25rem;
    border-radius: var(--r-lg);
    background: var(--accent);
    color: var(--on-accent);
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    align-items: flex-end;
  }
  .options .segmented {
    display: flex;
  }
  .segmented .disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .modes {
    display: grid;
    gap: 0.75rem;
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 720px) {
    .modes {
      grid-template-columns: 1fr 1fr;
    }
  }
  .mode {
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 100%;
    padding: 1rem 1.25rem;
    color: var(--ink-2);
    text-decoration: none;
    transition: border-color var(--t-base) var(--ease);
  }
  a.mode:hover {
    border-color: var(--accent);
  }
  .mode.disabled {
    opacity: 0.6;
  }
  .mode-ic {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: var(--r-sm);
    background: var(--accent-soft);
    color: var(--accent-text);
    flex: none;
  }
  .featured .mode {
    border: 2px solid var(--accent);
  }
  .featured .mode-ic {
    background: var(--accent);
    color: var(--on-accent);
  }
  .mode-txt {
    display: grid;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }
  .mode-name {
    color: var(--ink);
    font-weight: 700;
    font-size: var(--fs-lead);
  }

  .progress {
    display: grid;
    gap: 1.5rem;
  }
  .diff {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 720px) {
    .diff {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .diff li {
    display: grid;
    gap: 0.125rem;
    padding: 0.75rem 1rem;
    border-radius: var(--r-sm);
  }
  .d-num {
    font-size: var(--fs-h1);
    font-weight: 800;
    line-height: 1.1;
  }
  .diff .d-vaak { background: var(--bad-soft); color: var(--bad); }
  .diff .d-soms { background: var(--warn-soft); color: var(--warn); }
  .diff .d-goed { background: var(--good-soft); color: var(--good); }
  .diff .d-nieuw { background: var(--surface-2); color: var(--ink-2); }
  .boxes {
    display: grid;
    gap: 0.5rem;
  }

  .danger {
    margin-top: 1.5rem;
  }
  .del {
    color: var(--bad);
  }
  .del:hover {
    background: var(--bad-soft);
  }
  .words-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .words-head .section-title {
    margin-bottom: 0;
  }
  .words {
    margin: 0;
    padding: 0.25rem 0;
    list-style: none;
  }
  .word {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.125rem 0.75rem;
    align-items: center;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--line);
  }
  .word:first-child {
    border-top: 0;
  }
  @media (min-width: 720px) {
    .word {
      grid-template-columns: auto 1fr 1fr auto;
    }
  }
  .s-front {
    grid-column: 2;
    grid-row: 1;
  }
  .s-back {
    grid-column: 2;
    grid-row: 2;
  }
  .star {
    grid-column: 3;
    grid-row: 1 / span 2;
  }
  @media (min-width: 720px) {
    .s-back {
      grid-column: 3;
      grid-row: 1;
    }
    .star {
      grid-column: 4;
      grid-row: 1;
    }
  }
  .star.on {
    color: #f5a524;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    grid-column: 1;
    grid-row: 1 / span 2;
  }
  @media (min-width: 720px) {
    .dot {
      grid-row: 1;
    }
  }
  .dot.d-vaak { background: var(--bad-fill); }
  .dot.d-soms { background: #f59e0b; }
  .dot.d-goed { background: var(--good-fill); }
  .dot.d-nieuw { background: var(--line-strong); }
  .side {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
  }
  .w-front {
    font-weight: 700;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .w-back {
    color: var(--ink-2);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
</style>
