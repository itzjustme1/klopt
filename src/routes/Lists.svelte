<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import ListCard from "../components/ListCard.svelte";
  import { app } from "../lib/app.svelte";
  import { normalize } from "../lib/answer";
  import { href } from "../lib/router";

  let query = $state("");
  let subject = $state<string>("");

  const subjects = $derived([...new Set(app.decks.map((d) => d.subject?.trim()).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b)));
  const shown = $derived.by(() => {
    const q = normalize(query);
    return app.decks
      .filter((d) => !subject || d.subject?.trim() === subject)
      .filter((d) => !q || normalize(`${d.name} ${d.subject ?? ""}`).includes(q))
      .toSorted((a, b) => a.name.localeCompare(b.name));
  });
</script>

<section>
  <div class="page-head">
    <h1>{t("lists.title")}</h1>
    <a class="btn btn-primary" href={href.newList()}><Icon name="plus" size={20} />{t("lists.new")}</a>
  </div>

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
        <fieldset class="segmented filters">
          <legend class="visually-hidden">{t("editor.subject")}</legend>
          <label><input type="radio" name="subject-filter" value="" bind:group={subject} />{t("lists.all")}</label>
          {#each subjects as s (s)}
            <label><input type="radio" name="subject-filter" value={s} bind:group={subject} />{s}</label>
          {/each}
        </fieldset>
      {/if}
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
  .tools {
    display: grid;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
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
  }
  .filters {
    justify-self: start;
    max-width: 100%;
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
