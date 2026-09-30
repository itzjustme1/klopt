<script lang="ts">
  import { untrack } from "svelte";
  import { t, tp } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import ListCard from "../components/ListCard.svelte";
  import PageBand from "../components/PageBand.svelte";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { app } from "../lib/app.svelte";
  import { normalize } from "../lib/answer";
  import { href } from "../lib/router";

  let { subject: initialSubject }: { subject?: string } = $props();

  let query = $state("");
  let subject = $state<string>(untrack(() => initialSubject ?? ""));
  let sort = $state<"recent" | "name" | "new">("recent");

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

<PageBand title={t("lists.title")} subtitle={app.decks.length ? tp("common.decksCount", app.decks.length) : undefined}>
  <div class="band-actions">
    <a class="btn btn-primary" href={href.newList()}><Icon name="plus" size={20} />{t("lists.new")}</a>
  </div>
</PageBand>

<section class="lists">
  {#if app.decks.length === 0}
    <p class="muted">{t("lists.none")}</p>
  {:else}
    <div class="tools">
      <div class="search">
        <Icon name="search" size={20} />
        <label class="visually-hidden" for="list-search">{t("lists.search")}</label>
        <input id="list-search" type="search" placeholder={t("lists.search")} bind:value={query} autocomplete="off" />
      </div>
      {#if subjects.length > 1}
        <fieldset class="chips">
          <legend class="visually-hidden">{t("editor.subject")}</legend>
          <label class="chip-opt"><input type="radio" name="subject-filter" value="" bind:group={subject} /><span class="ic-round all-ic"><Icon name="lists" size={16} /></span>{t("lists.all")}</label>
          {#each subjects as s (s)}
            <label class="chip-opt"><input type="radio" name="subject-filter" value={s} bind:group={subject} /><SubjectBadge subject={s} size="sm" />{s}</label>
          {/each}
        </fieldset>
      {/if}
      <fieldset class="segmented">
        <legend class="visually-hidden">{t("lists.sort")}</legend>
        <label><input type="radio" name="list-sort" value="recent" bind:group={sort} />{t("lists.sortRecent")}</label>
        <label><input type="radio" name="list-sort" value="name" bind:group={sort} />{t("lists.sortName")}</label>
        <label><input type="radio" name="list-sort" value="new" bind:group={sort} />{t("lists.sortNew")}</label>
      </fieldset>
    </div>

    {#if shown.length === 0}
      <p class="muted" role="status">{t("lists.noResults", { q: query })}</p>
    {:else}
      <ul class="grid">
        {#each shown as deck (deck.id)}
          <li><ListCard {deck} /></li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .band-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .lists {
    display: grid;
    gap: 1rem;
  }
  .tools {
    display: grid;
    gap: 0.75rem;
  }
  .search {
    position: relative;
    max-width: 420px;
  }
  .search :global(.icon) {
    position: absolute;
    left: 0.875rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ink-2);
    pointer-events: none;
  }
  .search input {
    padding-left: 2.75rem;
    border-radius: var(--r-pill);
  }
  .chips {
    display: flex;
    gap: 0.5rem;
    margin: 0;
    padding: 0 0 0.25rem;
    border: 0;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .chip-opt {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex: none;
    min-height: var(--tap);
    padding: 0.25rem 1rem 0.25rem 0.375rem;
    border: 2px solid var(--line);
    border-radius: var(--r-pill);
    background: var(--surface);
    font-weight: 800;
    font-size: var(--fs-small);
    cursor: pointer;
    transition: border-color var(--t-base) var(--ease), background-color var(--t-base) var(--ease);
  }
  .chip-opt:has(input:checked) {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .chip-opt:has(input:focus-visible) {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .chip-opt input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .all-ic {
    width: 32px;
    height: 32px;
    background: var(--ink-2);
  }
  .tools :global(.segmented) {
    justify-self: start;
  }
  .grid {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 720px) {
    .grid {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
