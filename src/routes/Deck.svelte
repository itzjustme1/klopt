<script lang="ts">
  import { untrack } from "svelte";
  import { num, t, tp } from "../i18n/index.svelte";
  import BoxBar from "../components/BoxBar.svelte";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import { makePracticeTest } from "../components/DeckActions.svelte";
  import ExamCard from "../components/ExamCard.svelte";
  import FolderPicker from "../components/FolderPicker.svelte";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import Sheet from "../components/Sheet.svelte";
  import SharePanel from "../components/SharePanel.svelte";
  import SpeakButton from "../components/SpeakButton.svelte";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { LIMITS } from "../config";
  import { app } from "../lib/app.svelte";
  import { difficulty, isHard } from "../lib/history";
  import { normalize } from "../lib/answer";
  import { MODE_ICON } from "../lib/modeStyle";
  import type { Direction } from "../lib/practice";
  import { href, type Count } from "../lib/router";
  import { getSelection, setSelection } from "../lib/selection";
  import { shareJson } from "../lib/share";
  import { canSpeak, loadVoices } from "../lib/speech";
  import type { Mode } from "../lib/types";

  let { id, share = false }: { id: string; share?: boolean } = $props();

  const deck = $derived(app.deck(id));
  const cards = $derived(app.sortedCards(id));
  const due = $derived(app.dueCount(id));
  const diff = $derived(app.diffCounts(id));

  let dir = $state<Direction>("front");
  // Big lists start with a round of 20; small ones with everything.
  let count = $state<string>(untrack(() => (app.cardsIn(id).length > 20 ? "20" : "all")));
  const countValue = $derived<Count>(count === "10" ? 10 : count === "20" ? 20 : "all");
  let selected = $state<string[]>(untrack(() => getSelection(id)));
  const selectedSet = $derived(new Set(selected));
  $effect(() => setSelection(id, selected));

  let practiceOpen = $state(false);
  let moreOpen = $state(false);
  let moving = $state(false);
  async function moveTo(folder: string) {
    moving = false;
    try {
      await app.moveToFolder({ decks: [id] }, folder);
      app.showFlash(folder ? t("folder.moved", { name: folder }) : t("folder.removed"));
    } catch {
      app.showFlash(t("common.saveFailed"));
    }
  }
  let deleting = $state(false);

  /** Long lists show the first words; the rest on request (keeps big lists quick on phones). */
  const PAGE = 100;
  let showAll = $state(false);
  let wordQuery = $state("");
  const filtered = $derived.by(() => {
    const q = normalize(wordQuery);
    return q ? cards.filter((c) => normalize(`${c.front} ${c.back}`).includes(q)) : cards;
  });
  const shownCards = $derived(showAll || wordQuery ? filtered : filtered.slice(0, PAGE));
  const hardIds = $derived(cards.filter((c) => isHard(c.hist)).map((c) => c.id));
  const starredIds = $derived(cards.filter((c) => c.starred).map((c) => c.id));

  // Printing shows every word, whatever was on screen.
  $effect(() => {
    const before = () => (showAll = true);
    window.addEventListener("beforeprint", before);
    return () => window.removeEventListener("beforeprint", before);
  });

  let voice = $state(false);
  $effect(() => {
    const d = deck;
    if (!d) return;
    void loadVoices().then(() => (voice = (d.langFront !== "xx" && canSpeak(d.langFront)) || (d.langBack !== "xx" && canSpeak(d.langBack))));
  });

  const sameLang = $derived(!deck || deck.langFront === deck.langBack || deck.langFront === "xx" || deck.langBack === "xx");
  const isTerms = $derived(deck?.kind === "terms");
  const isForms = $derived(deck?.kind === "forms");
  const dirLabel = $derived.by(() => {
    if (!deck) return "";
    if (dir === "mixed") return t("deck.mixed");
    if (isTerms) return dir === "front" ? t("deck.termToExplanation") : t("deck.explanationToTerm");
    if (sameLang) return dir === "front" ? t("deck.leftToRight") : t("deck.rightToLeft");
    const a = t(`lang.${deck.langFront}`);
    const b = t(`lang.${deck.langBack}`);
    return dir === "front" ? t("lists.langs", { a, b }) : t("lists.langs", { a: b, b: a });
  });
  function nextDir() {
    dir = dir === "front" ? "back" : dir === "back" ? "mixed" : "front";
  }

  // Terms are learnt mostly by flipping cards; dictation makes no sense for them.
  const modes = $derived<Exclude<Mode, "herhalen">[]>(
    isForms
      ? ["vervoegen", "leren", "flashcards", "meerkeuze", "typen", "spelling", "koppelen"]
      : isTerms
        ? ["flashcards", "leren", "meerkeuze", "toets", "typen", "koppelen"]
        : ["leren", "toets", "flashcards", "meerkeuze", "typen", "spelling", "dictee", "koppelen"],
  );
  const recommended = $derived(isForms ? "vervoegen" : isTerms ? "flashcards" : "leren");
  const which = $derived(selected.length ? "selectie" : "all");

  function toggle(cardId: string) {
    selected = selectedSet.has(cardId) ? selected.filter((x) => x !== cardId) : [...selected, cardId];
  }
  function selectOnly(ids: string[]) {
    const same = ids.length === selected.length && ids.every((x) => selectedSet.has(x));
    selected = same ? [] : ids;
  }

  let copying = $state(false);
  async function duplicate() {
    if (!deck) return;
    copying = true;
    moreOpen = false;
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

  async function practiceTest() {
    if (!deck) return;
    moreOpen = false;
    copying = true;
    try {
      const quiz = await makePracticeTest(deck);
      if (quiz) location.hash = href.quiz(quiz.id);
      else app.showFlash(t("quizgen.tooFew"));
    } catch {
      app.showFlash(t("common.saveFailed"));
    } finally {
      copying = false;
    }
  }

  async function remove() {
    await app.deleteDeck(id);
    setSelection(id, []);
    location.hash = href.lists();
  }
</script>

{#if !deck}
  <PageHead title={t("deck.notFound")} back={{ href: href.lists(), label: t("nav.lists") }} />
{:else}
  <section class="deck">
    <PageHead title={deck.name} subtitle={[deck.subject, tp(isForms ? "forms.count" : isTerms ? "common.termsCount" : "common.wordsCount", cards.length)].filter(Boolean).join(" · ")} back={{ href: href.lists(), label: t("nav.lists") }}>
      {#snippet mark()}<SubjectBadge subject={deck.subject} lang={deck.langFront} size={32} />{/snippet}
      {#snippet actions()}
        <button type="button" class="icon-btn" aria-haspopup="dialog" aria-label={t("deck.more")} title={t("deck.more")} onclick={() => (moreOpen = true)}><Icon name="more" /></button>
      {/snippet}
      {#if cards.length > 0}
        {#if !deck.examDate}
          <a class="when-link" href={href.edit(id)}><Icon name="calendar" size={20} />{t("deck.whenTest")}</a>
        {/if}
        <button type="button" class="btn btn-primary btn-lg practice-btn" aria-haspopup="dialog" onclick={() => (practiceOpen = true)}>
          <Icon name="play" size={18} />{selected.length ? tp("deck.practiceSelection", selected.length) : isForms ? t("deck.practiceAllRows") : isTerms ? t("deck.practiceAllTerms") : t("deck.practiceAll")}
        </button>
        <button type="button" class="dir" onclick={nextDir} aria-label={t("deck.directionNow", { dir: dirLabel })}><Icon name="swap" size={18} />{dirLabel}</button>
      {/if}
    </PageHead>

    {#if share}
      <SharePanel name={deck.name} json={shareJson(deck, cards)} {cards} onclose={() => (location.hash = href.deck(id))} />
    {/if}

    {#if deck.examDate}<ExamCard {deck} />{/if}

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
        <a class="due-row" href={href.review(id)}>
          <Icon name="review" size={20} />
          <span class="row-main"><span class="row-title">{tp("deck.dueHero", due)}</span></span>
          <span class="row-end">{t("home.startReview")}</span>
        </a>
      {/if}

      <div class="words-head">
        <h2>{isTerms ? t("deck.terms") : deck.kind === "forms" ? t("deck.verbs") : t("deck.words")}</h2>
        <div class="pick">
          {#if hardIds.length}<button type="button" class="chip" aria-pressed={hardIds.length === selected.length && hardIds.every((x) => selectedSet.has(x))} onclick={() => selectOnly(hardIds)}>{t("deck.hardWords", { n: hardIds.length })}</button>{/if}
          {#if starredIds.length}<button type="button" class="chip" aria-pressed={starredIds.length === selected.length && starredIds.every((x) => selectedSet.has(x))} onclick={() => selectOnly(starredIds)}>{t("deck.starredWords", { n: starredIds.length })}</button>{/if}
          {#if selected.length}<button type="button" class="btn btn-quiet" onclick={() => (selected = [])}>{t("deck.clearSelection")}</button>{/if}
        </div>
      </div>
      {#if cards.length > 20}
        <div class="search no-print">
          <Icon name="search" size={20} />
          <label class="visually-hidden" for="word-search">{t("deck.searchWords")}</label>
          <input id="word-search" type="search" placeholder={t("deck.searchWords")} bind:value={wordQuery} autocomplete="off" />
        </div>
        {#if wordQuery && filtered.length === 0}<p class="muted" role="status">{t("deck.noMatches", { q: wordQuery })}</p>{/if}
      {/if}
      <ol class="rows words">
        {#each shownCards as card (card.id)}
          {@const d = difficulty(card.hist)}
          {@const sel = selectedSet.has(card.id)}
          <li class="word" class:sel>
            <SpeakButton text={card.front} lang={deck.langFront} size={20} />
            {#if card.image}<img class="w-img" src={card.image} alt="" />{/if}
            <span class="w-text">
              <span class="w-front" lang={deck.langFront === "xx" ? undefined : deck.langFront}>{card.front}</span>
              <span class="w-back" lang={deck.langBack === "xx" ? undefined : deck.langBack}>{card.back}</span>
              {#if card.forms?.some((f) => f)}<span class="w-forms" lang={deck.langFront === "xx" ? undefined : deck.langFront}>{card.forms.filter(Boolean).join(" · ")}</span>{/if}
            </span>
            <span class="status d-{d}" title={t(`diff.${d}`)}><span class="visually-hidden">{t("deck.statusLabel", { status: t(`diff.${d}`) })}</span></span>
            <button
              type="button"
              class="icon-btn star no-print"
              class:on={card.starred}
              aria-pressed={!!card.starred}
              aria-label={card.starred ? t("deck.unstar", { word: card.front }) : t("deck.star", { word: card.front })}
              onclick={() => app.setStarred(card.id, !card.starred)}
            >
              <Icon name="star" size={20} filled={!!card.starred} />
            </button>
            <label class="select no-print">
              <input type="checkbox" checked={sel} onchange={() => toggle(card.id)} />
              <span class="visually-hidden">{t("deck.select", { word: card.front })}</span>
              <span class="circle" aria-hidden="true">{#if sel}<Icon name="check" size={16} />{/if}</span>
            </label>
          </li>
        {/each}
      </ol>
      {#if cards.length > shownCards.length}
        <button type="button" class="btn show-all" onclick={() => (showAll = true)}>{t("deck.showAll", { n: num(cards.length) })}</button>
      {/if}

      <h2 class="section-title">{t("deck.progress")}</h2>
      <div class="card card-pad progress">
        <ul class="diff">
          {#each ["vaak", "soms", "goed", "nieuw"] as const as k (k)}
            <li class="d-{k}"><span class="d-num num">{diff[k]}</span><span class="small">{t(`diff.${k}`)}</span></li>
          {/each}
        </ul>
        <div class="boxes">
          <h3>{t("box.title")}</h3>
          <BoxBar counts={app.boxCounts(id)} />
        </div>
      </div>
    {/if}

    {#if deleting}
      <ConfirmInline message={t("deck.deleteConfirm", { name: deck.name })} confirmLabel={t("deck.deleteYes")} onconfirm={remove} oncancel={() => (deleting = false)} />
    {/if}
  </section>

  {#if practiceOpen}
    <Sheet title={t("deck.practiceWith")} onclose={() => (practiceOpen = false)}>
      {#if cards.length > 10 && !selected.length}
        <fieldset class="fieldset-wrap count">
          <legend>{t("deck.count")}</legend>
          <div class="segmented">
            <label><input type="radio" name="count" value="10" bind:group={count} />10</label>
            {#if cards.length > 20}<label><input type="radio" name="count" value="20" bind:group={count} />20</label>{/if}
            <label><input type="radio" name="count" value="all" bind:group={count} />{t("deck.countAll")}</label>
          </div>
        </fieldset>
      {/if}
      <ul class="drawer-list">
        {#each modes as m (m)}
          {@const off = m === "dictee" && !voice}
          <li>
            {#if off}
              <span class="drawer-item" aria-disabled="true"><Icon name={MODE_ICON[m]} />{t(`mode.${m}`)}<span class="hint">{t("deck.noVoice")}</span></span>
            {:else}
              <a class="drawer-item" href={href.practice(id, m, dir, which, selected.length ? "all" : countValue)}>
                <Icon name={MODE_ICON[m]} />{t(`mode.${m}`)}
                {#if m === recommended}<span class="tag">{t("deck.recommended")}</span>{/if}
              </a>
            {/if}
          </li>
        {/each}
      </ul>
    </Sheet>
  {/if}

  {#if moving}
    <FolderPicker current={deck.folder ?? ""} onpick={moveTo} onclose={() => (moving = false)} />
  {/if}

  {#if moreOpen}
    <Sheet title={t("deck.more")} onclose={() => (moreOpen = false)}>
      <ul class="drawer-list">
        <li><a class="drawer-item" href={href.edit(id)}><Icon name="edit" />{t("common.edit")}</a></li>
        {#if cards.length > 0}
          <li><a class="drawer-item" href={href.shareDeck(id)} onclick={() => (moreOpen = false)}><Icon name="share" />{t("deck.share")}</a></li>
          <li><button type="button" class="drawer-item" disabled={copying} onclick={practiceTest}><Icon name="quiz" />{t("quizgen.make")}</button></li>
          <li><button type="button" class="drawer-item" disabled={copying} onclick={duplicate}><Icon name="cards" />{t("deck.copy")}</button></li>
          <li><button type="button" class="drawer-item" onclick={() => { moreOpen = false; setTimeout(() => window.print(), 50); }}><Icon name="file" />{t("deck.print")}</button></li>
        {/if}
        <li><button type="button" class="drawer-item" onclick={() => { moreOpen = false; moving = true; }}><Icon name="folder" />{t("folder.move")}{#if deck.folder}<span class="hint">{deck.folder}</span>{/if}</button></li>
        <li><a class="drawer-item" href={href.photo(id)}><Icon name="camera" />{t("new.photo")}</a></li>
        <li><a class="drawer-item" href={href.import(id)}><Icon name="paste" />{t("new.paste")}</a></li>
        <li><button type="button" class="drawer-item danger" onclick={() => { moreOpen = false; deleting = true; }}><Icon name="trash" />{t("common.delete")}</button></li>
      </ul>
    </Sheet>
  {/if}
{/if}

<style>
  .deck {
    display: grid;
    gap: 1rem;
  }
  .when-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: var(--tap);
    font-weight: 700;
    text-decoration: none;
  }
  .practice-btn {
    min-width: 15rem;
  }
  .dir {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: var(--tap);
    padding: 0 0.75rem;
    border: 0;
    border-radius: var(--r-pill);
    background: transparent;
    color: var(--ink-2);
    font-weight: 700;
    cursor: pointer;
  }
  .dir:hover {
    color: var(--ink);
    background: var(--surface);
  }
  .empty {
    display: grid;
    gap: 1rem;
  }
  .due-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 1rem;
    border-radius: var(--r-md);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }
  .due-row > :global(.icon) {
    color: var(--accent);
  }
  .words-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .pick {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .word {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem 0.375rem 0.25rem;
    transition: background-color var(--t-base) var(--ease);
  }
  .word.sel {
    background: var(--accent-soft);
  }
  .w-text {
    display: grid;
    flex: 1;
    min-width: 0;
    padding: 0.375rem 0;
  }
  .w-img {
    width: 48px;
    height: 48px;
    flex: none;
    object-fit: cover;
    border-radius: var(--r-xs);
  }
  .w-front {
    font-weight: 700;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .w-forms {
    font-size: var(--fs-small);
    color: var(--accent);
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .w-back {
    color: var(--ink-2);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
  }
  .status.d-vaak { background: var(--bad-fill); }
  .status.d-soms { background: var(--warn); }
  .status.d-goed { background: var(--green); }
  .status.d-nieuw { background: transparent; }
  .star.on {
    color: var(--yellow);
  }
  .select {
    display: grid;
    place-items: center;
    width: var(--tap);
    height: var(--tap);
    flex: none;
    cursor: pointer;
  }
  .select input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .circle {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px var(--line-strong);
    color: var(--on-green);
  }
  .sel .circle {
    background: var(--green);
    box-shadow: none;
  }
  .select:has(input:focus-visible) .circle {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .show-all {
    justify-self: start;
  }
  .progress {
    display: grid;
    gap: 1.25rem;
  }
  .diff {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 560px) {
    .diff {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .diff li {
    display: grid;
    gap: 0.125rem;
    padding: 0.75rem;
    border-radius: var(--r-sm);
    background: var(--surface-2);
  }
  .d-num {
    font-size: var(--fs-title);
    font-weight: 900;
    line-height: 1.1;
  }
  .diff .d-vaak .d-num { color: var(--bad); }
  .diff .d-soms .d-num { color: var(--warn); }
  .diff .d-goed .d-num { color: var(--good); }
  .boxes {
    display: grid;
    gap: 0.5rem;
  }
  .count {
    padding: 0.75rem 1.25rem 0.25rem;
  }
  .danger {
    color: var(--bad);
  }

  /* Printing a list: the title and the words, ink on paper. */
  @media print {
    .deck > :global(*:not(.head):not(.words)),
    .no-print,
    .status,
    .words-head,
    :global(.speak) {
      display: none !important;
    }
    .word.sel {
      background: none;
    }
    .w-back {
      color: #000;
    }
  }
</style>
