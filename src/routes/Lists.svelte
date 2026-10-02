<script lang="ts">
  import { untrack } from "svelte";
  import { t, tp } from "../i18n/index.svelte";
  import CreationTabs from "../components/CreationTabs.svelte";
  import Icon from "../components/Icon.svelte";
  import ListCard from "../components/ListCard.svelte";
  import PageHead from "../components/PageHead.svelte";
  import PracticeSheet from "../components/PracticeSheet.svelte";
  import { decksScope } from "../lib/scope";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { app } from "../lib/app.svelte";
  import { normalize } from "../lib/answer";
  import { href } from "../lib/router";

  let { subject: initialSubject }: { subject?: string } = $props();

  let query = $state("");
  let subject = $state<string>(untrack(() => initialSubject ?? ""));
  let sort = $state<"recent" | "name" | "new">("recent");
  // Picking several lists to practise together (chapters 1 to 3 before a test).
  let selecting = $state(false);
  let picked = $state<string[]>([]);
  let practising = $state(false);
  function togglePick(id: string) {
    picked = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
  }
  function stopSelecting() {
    selecting = false;
    picked = [];
  }

  const other = $derived(t("lists.noSubject"));
  const subjectOf = (d: { subject?: string }) => d.subject?.trim() || other;
  const subjects = $derived(app.subjects(other).map((s) => s.name));
  const shown = $derived.by(() => {
    const q = normalize(query);
    const found = app.decks.filter((d) => (!subject || subjectOf(d) === subject) && (!q || normalize(`${d.name} ${d.subject ?? ""}`).includes(q)));
    if (sort === "name") return found.toSorted((a, b) => a.name.localeCompare(b.name));
    if (sort === "new") return found.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
    return app.byRecent(found);
  });
</script>

<PageHead title={t("lists.title")}>
  {#snippet actions()}
    <a class="icon-btn add" href={href.newList()} aria-label={t("lists.new")} title={t("lists.new")}><Icon name="plus" /></a>
  {/snippet}
</PageHead>

<section class="lists">
  <CreationTabs current="lists" />
  {#if app.decks.length === 0}
    <p class="muted">{t("lists.none")}</p>
    <a class="btn btn-primary" href={href.newList()}><Icon name="plus" size={20} />{t("lists.new")}</a>
  {:else}
    <div class="search">
      <Icon name="search" size={20} />
      <label class="visually-hidden" for="list-search">{t("lists.search")}</label>
      <input id="list-search" type="search" placeholder={t("lists.search")} bind:value={query} autocomplete="off" />
    </div>
    {#if subjects.length > 1}
      <fieldset class="filter">
        <legend class="visually-hidden">{t("editor.subject")}</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="subject-filter" value="" bind:group={subject} />{t("lists.all")}</label>
          {#each subjects as s (s)}
            <label class="chip"><input type="radio" name="subject-filter" value={s} bind:group={subject} /><SubjectBadge subject={s} size={20} />{s}</label>
          {/each}
        </div>
      </fieldset>
    {/if}
    <div class="sort">
      {#if app.decks.length > 1}
        <button type="button" class="btn btn-quiet select-btn" aria-pressed={selecting} onclick={() => (selecting ? stopSelecting() : (selecting = true))}>
          <Icon name={selecting ? "check" : "rows"} size={18} />{selecting ? t("multi.cancel") : t("multi.select")}
        </button>
      {/if}
      <label class="small muted" for="list-sort">{t("lists.sort")}</label>
      <select id="list-sort" bind:value={sort}>
        <option value="recent">{t("lists.sortRecent")}</option>
        <option value="name">{t("lists.sortName")}</option>
        <option value="new">{t("lists.sortNew")}</option>
      </select>
    </div>

    {#if shown.length === 0}
      <p class="muted" role="status">{t("lists.noResults", { q: query })}</p>
    {:else}
      {#if selecting}
        <p class="small muted">{t("multi.pick")}</p>
        <ul class="rows">
          {#each shown as deck (deck.id)}
            <li>
              <label class="row-item pick" class:on={picked.includes(deck.id)}>
                <input type="checkbox" checked={picked.includes(deck.id)} onchange={() => togglePick(deck.id)} />
                <SubjectBadge subject={deck.subject} lang={deck.langFront} />
                <span class="row-main">
                  <span class="row-title">{deck.name}</span>
                  <span class="row-sub">{tp(deck.kind === "terms" ? "common.termsCount" : "common.wordsCount", app.cardsIn(deck.id).length)}</span>
                </span>
              </label>
            </li>
          {/each}
        </ul>
        {#if picked.length}
          <div class="pick-bar">
            <button type="button" class="btn btn-primary btn-lg" aria-haspopup="dialog" onclick={() => (practising = true)}><Icon name="play" size={20} />{tp("multi.practise", picked.length)}</button>
          </div>
        {/if}
      {:else}
        <ul class="rows">
          {#each shown as deck (deck.id)}
            <li><ListCard {deck} /></li>
          {/each}
        </ul>
      {/if}
    {/if}
  {/if}
</section>

{#if practising && picked.length}
  <PracticeSheet scope={decksScope(picked)} title={t("deck.practiceWith")} onclose={() => (practising = false)} />
{/if}

<style>
  .select-btn {
    margin-right: auto;
  }
  .pick {
    cursor: pointer;
  }
  .pick input {
    width: 22px;
    height: 22px;
    flex: none;
    accent-color: var(--green);
  }
  .pick.on {
    background: var(--surface-2);
  }
  .pick-bar {
    position: sticky;
    bottom: calc(5rem + env(safe-area-inset-bottom));
    display: flex;
    justify-content: center;
    padding: 0.75rem 0;
  }
  @media (min-width: 720px) {
    .pick-bar {
      bottom: 1rem;
    }
  }
  .lists {
    display: grid;
    gap: 0.75rem;
  }
  .add {
    background: var(--green);
    color: var(--on-green);
  }
  .add:hover {
    background: var(--green-hover);
    color: var(--on-green);
  }
  .filter {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .sort {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .sort select {
    width: auto;
    min-height: var(--tap);
    padding-block: 0.375rem;
    background-color: transparent;
    font-weight: 700;
  }
</style>
