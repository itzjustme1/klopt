<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "../i18n/index.svelte";
  import CreationTabs from "../components/CreationTabs.svelte";
  import Icon from "../components/Icon.svelte";
  import ListCard from "../components/ListCard.svelte";
  import PageHead from "../components/PageHead.svelte";
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
      <ul class="rows">
        {#each shown as deck (deck.id)}
          <li><ListCard {deck} /></li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
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
