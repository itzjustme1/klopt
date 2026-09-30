<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import Flag from "../components/Flag.svelte";
  import Icon from "../components/Icon.svelte";
  import PageBand from "../components/PageBand.svelte";
  import { app } from "../lib/app.svelte";
  import { takePendingImport } from "../lib/handoff";
  import { cardKey, parseImport } from "../lib/importText";
  import { skipText } from "../lib/messages";
  import { href } from "../lib/router";
  import { CONTENT_LANGS, type ContentLang } from "../lib/types";

  let { deckId }: { deckId?: string } = $props();

  const PREVIEW_ROWS = 100;
  const SKIPPED_ROWS = 50;

  const fromPhoto = takePendingImport();
  let text = $state(fromPhoto?.text ?? "");
  let parsedText = $state(fromPhoto?.text ?? "");
  // svelte-ignore state_referenced_locally
  let target = $state<string>(deckId && app.deck(deckId) ? deckId : "new");
  let newName = $state("");
  let langFront = $state<ContentLang>(fromPhoto?.langFront ?? "en");
  let langBack = $state<ContentLang>(fromPhoto?.langBack ?? getLang());
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
  const targetDeck = $derived(target === "new" ? undefined : app.deck(target));
  const lf = $derived(targetDeck?.langFront ?? langFront);
  const lb = $derived(targetDeck?.langBack ?? langBack);
  const canImport = $derived(count > 0 && !result.tooMany && !result.tooBig && !busy && parsedText === text);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!canImport) return;
    error = "";
    let id = target;
    let name = targetDeck?.name ?? "";
    if (target === "new") {
      name = newName.trim();
      if (!name) {
        error = t("editor.nameRequired");
        nameInput?.focus();
        return;
      }
      if (name.length > LIMITS.deckNameChars) {
        error = t("editor.nameTooLong", { n: LIMITS.deckNameChars });
        nameInput?.focus();
        return;
      }
    }
    busy = true;
    try {
      if (target === "new") id = (await app.createDeck({ name, langFront, langBack })).id;
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
</script>

<PageBand
  title={t("import.title")}
  subtitle={done ? undefined : fromPhoto?.source === "photo" ? t("import.fromPhoto") : fromPhoto?.source === "share" ? t("import.fromShare") : t("import.intro")}
  back={{ href: href.newList(), label: t("common.back") }}
/>
<section class="import">

  {#if done}
    <div class="card card-pad success" role="status">
      <span class="ok-ic" aria-hidden="true"><Icon name="check" size={28} /></span>
      <p class="success-text">{tp("import.success", done.count, { deck: done.deckName })}</p>
      <div class="row">
        <a class="btn btn-primary" href={href.deck(done.deckId)}>{t("import.toDeck")}</a>
        <button type="button" class="btn" onclick={() => (done = null)}>{t("import.again")}</button>
      </div>
    </div>
  {:else}
    <form class="stack" style:--gap="1.25rem" onsubmit={submit} novalidate>
      <div class="field card card-pad">
        <label for="import-text">{t("import.textLabel")}</label>
        <textarea id="import-text" class="paste" rows="8" bind:value={text} placeholder={t("import.placeholder")} spellcheck="false" autocomplete="off"></textarea>
      </div>

      <div class="card card-pad target">
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
          <div class="field">
            <label for="import-name">{t("import.newDeckName")}</label>
            <input id="import-name" type="text" bind:value={newName} bind:this={nameInput} maxlength={LIMITS.deckNameChars} autocomplete="off" placeholder={t("editor.namePlaceholder")} />
          </div>
          <div class="langs">
            <div class="field">
              <label for="imp-lf">{t("editor.langFront")}</label>
              <select id="imp-lf" bind:value={langFront}>
                {#each CONTENT_LANGS as l (l)}<option value={l}>{t(`lang.${l}`)}</option>{/each}
              </select>
            </div>
            <div class="field">
              <label for="imp-lb">{t("editor.langBack")}</label>
              <select id="imp-lb" bind:value={langBack}>
                {#each CONTENT_LANGS as l (l)}<option value={l}>{t(`lang.${l}`)}</option>{/each}
              </select>
            </div>
          </div>
        {/if}
      </div>

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
          <div class="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th scope="col" class="num-col">{t("import.col.line")}</th>
                  <th scope="col"><span class="th"><Flag lang={lf} size={18} />{t(`lang.${lf}`)}</span></th>
                  <th scope="col"><span class="th"><Flag lang={lb} size={18} />{t(`lang.${lb}`)}</span></th>
                </tr>
              </thead>
              <tbody>
                {#each result.cards.slice(0, PREVIEW_ROWS) as c (c.line)}
                  <tr>
                    <td class="num-col num">{c.line}</td>
                    <td lang={lf === "xx" ? undefined : lf}>{c.front}</td>
                    <td lang={lb === "xx" ? undefined : lb}>{c.back}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if count > PREVIEW_ROWS}<p class="small muted">{tp("import.moreRows", count - PREVIEW_ROWS)}</p>{/if}
        {/if}
      </section>

      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button type="submit" class="btn btn-primary btn-lg submit" disabled={!canImport}>
        {tp("import.submit", count > 0 ? Math.min(count, LIMITS.importCards) : 0)}
      </button>
    </form>
  {/if}
</section>

<style>
  .import {
    display: grid;
    gap: 1rem;
    max-width: 820px;
  }
  .paste {
    white-space: pre-wrap;
    tab-size: 4;
    font-size: var(--fs-body);
  }
  .target {
    display: grid;
    gap: 1rem;
  }
  .langs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
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
    color: var(--bad);
    display: grid;
    gap: 0.25rem;
  }
  .table-wrap {
    margin-top: 0.75rem;
    max-height: 26rem;
    overflow: auto;
    border-radius: var(--r-sm);
    box-shadow: none;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th,
  td {
    padding: 0.75rem 0.75rem;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--line);
    overflow-wrap: anywhere;
  }
  th {
    position: sticky;
    top: 0;
    background: var(--surface);
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .th {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  td:nth-child(2) {
    font-weight: 700;
  }
  .num-col {
    width: 4.5rem;
    color: var(--ink-2);
    font-size: var(--fs-caption);
  }
  .submit {
    justify-self: start;
  }
  .success {
    display: grid;
    gap: 1rem;
    justify-items: start;
  }
  .ok-ic {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--good-fill);
    color: #ffffff;
  }
  .success-text {
    font-size: var(--fs-h2);
    font-weight: 800;
  }
</style>
