<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import { app } from "../lib/app.svelte";
  import { cardKey, parseImport } from "../lib/importText";
  import { skipText } from "../lib/messages";
  import { href } from "../lib/router";
  import type { Lang } from "../lib/types";

  let { deckId }: { deckId?: string } = $props();

  const PREVIEW_ROWS = 100;
  const SKIPPED_ROWS = 50;

  let text = $state("");
  let parsedText = $state("");
  // svelte-ignore state_referenced_locally
  let target = $state<string>(deckId && app.deck(deckId) ? deckId : "new");
  let newName = $state("");
  let newLang = $state<Lang>(getLang());
  let error = $state("");
  let busy = $state(false);
  let done = $state<{ count: number; deckId: string; deckName: string } | null>(null);
  let nameInput: HTMLInputElement | undefined = $state();

  // Parse shortly after typing stops so large pastes don't block every keystroke.
  $effect(() => {
    const value = text;
    const id = setTimeout(() => (parsedText = value), value.length > 20_000 ? 250 : 60);
    return () => clearTimeout(id);
  });

  const existing = $derived(new Set(target === "new" ? [] : app.cardsIn(target).map((c) => cardKey(c.front, c.back))));
  const result = $derived(parseImport(parsedText, existing));
  const count = $derived(result.cards.length);
  const cardLang = $derived(target === "new" ? newLang : (app.deck(target)?.lang ?? newLang));
  const canImport = $derived(count > 0 && !result.tooMany && !result.tooBig && !busy && parsedText === text);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!canImport) return;
    error = "";
    let id = target;
    let name = app.deck(target)?.name ?? "";
    if (target === "new") {
      name = newName.trim();
      if (!name) {
        error = t("decks.nameRequired");
        nameInput?.focus();
        return;
      }
      if (name.length > LIMITS.deckNameChars) {
        error = t("decks.nameTooLong", { n: LIMITS.deckNameChars });
        nameInput?.focus();
        return;
      }
    }
    busy = true;
    try {
      if (target === "new") id = (await app.createDeck({ name, lang: newLang })).id;
      await app.addCards(id, result.cards.map(({ front, back }) => ({ front, back })));
      done = { count, deckId: id, deckName: name };
      text = "";
      parsedText = "";
      newName = "";
    } catch {
      error = t("common.saveFailed");
    } finally {
      busy = false;
    }
  }

  function again() {
    done = null;
    target = "new";
  }
</script>

<section class="stack" style:--gap="1.25rem">
  <h1>{t("import.title")}</h1>

  {#if done}
    <div class="panel success" role="status">
      <p class="hand">{tp("import.success", done.count, { deck: done.deckName })}</p>
      <div class="row">
        <a class="btn btn-primary" href={href.deck(done.deckId)}>{t("import.toDeck")}</a>
        <button type="button" class="btn" onclick={again}>{t("import.again")}</button>
      </div>
    </div>
  {:else}
    <p class="intro muted">{t("import.intro")}</p>

    <form class="stack" style:--gap="1.25rem" onsubmit={submit} novalidate>
      <div class="field">
        <label for="import-text">{t("import.textLabel")}</label>
        <textarea
          id="import-text"
          class="paste mono"
          rows="8"
          bind:value={text}
          placeholder={t("import.placeholder")}
          spellcheck="false"
          autocomplete="off"
          lang={cardLang}
        ></textarea>
      </div>

      <div class="field">
        <label for="import-target">{t("import.target")}</label>
        <select id="import-target" bind:value={target}>
          <option value="new">{t("import.newDeck")}</option>
          {#each app.decks as d (d.id)}
            <option value={d.id}>{d.name}</option>
          {/each}
        </select>
      </div>

      {#if target === "new"}
        <div class="new-deck stack" style:--gap="1rem">
          <div class="field">
            <label for="import-name">{t("import.newDeckName")}</label>
            <input id="import-name" type="text" bind:value={newName} bind:this={nameInput} maxlength={LIMITS.deckNameChars} autocomplete="off" />
          </div>
          <fieldset class="choice">
            <legend>{t("decks.lang")}</legend>
            <label><input type="radio" name="import-lang" value="nl" bind:group={newLang} />{t("lang.nl")}</label>
            <label><input type="radio" name="import-lang" value="en" bind:group={newLang} />{t("lang.en")}</label>
          </fieldset>
        </div>
      {/if}

      <section class="preview" aria-labelledby="preview-title">
        <h2 id="preview-title">{t("import.preview")}</h2>
        <div aria-live="polite" class="status">
          {#if result.tooBig}
            <p class="error">{t("import.tooBig")}</p>
          {:else if parsedText.trim() === ""}
            <p class="muted">{t("import.nothing")}</p>
          {:else}
            <p><strong>{tp("import.recognised", count)}</strong>{#if result.skipped.length > 0}<span class="muted">, {tp("import.skipped", result.skipped.length)}</span>{/if}</p>
            {#if result.tooMany}
              <p class="error">{t("import.tooMany", { n: count, max: LIMITS.importCards })}</p>
            {/if}
          {/if}
        </div>

        {#if result.skipped.length > 0}
          <ul class="skipped small">
            {#each result.skipped.slice(0, SKIPPED_ROWS) as s (s.line)}
              <li>{skipText(s.line, s.reason)}</li>
            {/each}
            {#if result.skipped.length > SKIPPED_ROWS}
              <li class="muted">{tp("import.skipped", result.skipped.length - SKIPPED_ROWS)}</li>
            {/if}
          </ul>
        {/if}

        {#if count > 0}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col" class="num">{t("import.col.line")}</th>
                  <th scope="col">{t("import.col.front")}</th>
                  <th scope="col">{t("import.col.back")}</th>
                </tr>
              </thead>
              <tbody lang={cardLang}>
                {#each result.cards.slice(0, PREVIEW_ROWS) as c (c.line)}
                  <tr>
                    <td class="num mono">{c.line}</td>
                    <td>{c.front}</td>
                    <td>{c.back}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if count > PREVIEW_ROWS}<p class="small muted">{tp("import.moreRows", count - PREVIEW_ROWS)}</p>{/if}
        {/if}
      </section>

      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button type="submit" class="btn btn-primary submit" disabled={!canImport}>
        {count > 0 ? tp("import.submit", Math.min(count, LIMITS.importCards)) : tp("import.submit", 0)}
      </button>
    </form>
  {/if}
</section>

<style>
  .intro {
    max-width: 38rem;
  }
  .paste {
    font-size: 0.875rem;
    line-height: 1.6;
    white-space: pre-wrap;
    tab-size: 4;
  }
  .new-deck {
    padding-left: 1rem;
    border-left: 1px solid var(--line);
  }
  .preview h2 {
    margin-bottom: 0.5rem;
  }
  .status {
    display: grid;
    gap: 0.25rem;
  }
  .skipped {
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
    color: var(--accent);
    display: grid;
    gap: 0.25rem;
  }
  .table-wrap {
    margin-top: 0.75rem;
    max-height: 26rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9375rem;
  }
  th,
  td {
    padding: 0.5rem 0.75rem;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--rule);
    overflow-wrap: break-word;
    hyphens: auto;
  }
  th {
    position: sticky;
    top: 0;
    background: var(--surface);
    border-bottom: 2px solid var(--accent);
    font-size: 0.8125rem;
    color: var(--ink-2);
    font-weight: 600;
  }
  td {
    font-family: var(--font-card);
  }
  .num {
    width: 3.5rem;
    color: var(--ink-2);
    font-size: 0.8125rem;
  }
  td.num {
    font-family: var(--font-mono);
  }
  .submit {
    justify-self: start;
    min-height: 3.25rem;
  }
  .success {
    display: grid;
    gap: 1rem;
  }
  .success .hand {
    font-size: 2rem;
  }
</style>
