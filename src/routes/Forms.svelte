<script lang="ts">
  import { tick, untrack } from "svelte";
  import { t, tp } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import { app } from "../lib/app.svelte";
  import { FormsDrill, markRow, type FormsResult } from "../lib/forms";
  import { href, type Count, type Which } from "../lib/router";
  import { playRight, playWrong } from "../lib/sounds";

  let { scope, which, count }: { scope: string; which: Which; count: Count } = $props();

  const deck = $derived(app.deck(scope));
  const columns = $derived(deck?.columns ?? []);
  let drill = $state.raw<FormsDrill | null>(null);
  let version = $state(0);
  let given = $state<string[]>([]);
  let result = $state<FormsResult | null>(null);
  let box: HTMLElement | undefined = $state();
  const exitHref = $derived(href.deck(scope));

  function start() {
    const cards = app.practiceCards(scope, which, count).flatMap((c) => (c.forms ? [{ id: c.id, front: c.front, back: c.back, forms: c.forms }] : []));
    drill = new FormsDrill(cards);
    version++;
    given = [];
    result = null;
    void focusFirst();
  }
  untrack(start);

  const card = $derived.by(() => {
    void version;
    return drill?.current ?? null;
  });
  const stats = $derived.by(() => {
    void version;
    return drill ? { done: drill.done, total: drill.total, right: drill.right, wrong: drill.wrong } : { done: 0, total: 0, right: 0, wrong: 0 };
  });

  async function focusFirst() {
    await tick();
    box?.querySelector<HTMLInputElement>("input:not([readonly])")?.focus();
  }

  function check(e?: SubmitEvent) {
    e?.preventDefault();
    if (!card || !drill) return;
    if (result) return next();
    result = markRow(card, given, { lenientAccents: app.settings.lenientAccents, lenientTypos: app.settings.lenientTypos });
    if (app.settings.sounds) (result.grade === "goed" ? playRight : playWrong)();
    void tick().then(() => box?.querySelector<HTMLElement>(".next")?.focus());
  }

  function next() {
    if (!card || !drill || !result) return;
    app.grade(card.id, result.grade, "vervoegen").catch(() => app.showFlash(t("common.saveFailed")));
    drill.answer(result);
    version++;
    given = [];
    result = null;
    void focusFirst();
  }

  /** Enter in a field moves to the next field; in the last one it checks. */
  function onkey(e: KeyboardEvent, i: number) {
    if (e.key !== "Enter" || e.isComposing) return;
    e.preventDefault();
    if (result) return next();
    const inputs = [...(box?.querySelectorAll<HTMLInputElement>("input.form") ?? [])];
    const nextInput = inputs.slice(inputs.indexOf(e.currentTarget as HTMLInputElement) + 1)[0];
    if (nextInput && i < columns.length - 1) nextInput.focus();
    else check();
  }

  const mistakes = $derived.by(() => {
    void version;
    if (!drill) return [];
    return [...drill.first.entries()].filter(([, g]) => g !== "goed").map(([id]) => app.cards.find((c) => c.id === id)).filter((c) => !!c);
  });
</script>

<div class="play">
  <header class="p-top">
    <a class="icon-btn" href={exitHref} aria-label={t("practice.stop")}><Icon name="x" /></a>
    <div class="bar" aria-hidden="true"><span style:width="{stats.total ? (stats.done / stats.total) * 100 : 0}%"></span></div>
    <span class="caption num counts"><span class="ok">✓ {stats.right}</span> <span class="bad">✗ {stats.wrong}</span></span>
  </header>

  <div class="p-body" bind:this={box}>
    <h1 class="visually-hidden">{t("mode.vervoegen")}</h1>
    {#if !deck || !drill}
      <p>{t("deck.notFound")}</p>
    {:else if drill.total === 0}
      <div class="card card-pad"><p>{t("forms.nothing")}</p><a class="btn btn-primary" href={exitHref}>{t("practice.backToList")}</a></div>
    {:else if !card}
      <section class="done card card-pad">
        <h2 tabindex="-1">{t("result.title")}</h2>
        <p class="muted">{t("result.firstTry", { right: [...drill.first.values()].filter((g) => g === "goed").length, total: drill.total })}</p>
        <div class="row actions-row">
          <button type="button" class="btn btn-primary btn-lg" onclick={start}>{t("result.again")}</button>
          <a class="btn btn-lg" href={exitHref}>{t("practice.backToList")}</a>
        </div>
      </section>
      {#if mistakes.length}
        <h2>{t("result.mistakes")}</h2>
        <ul class="rows">
          {#each mistakes as c (c.id)}
            <li class="mistake"><span class="m-q">{c.front}</span><span class="m-a">{(c.forms ?? []).filter(Boolean).join(" · ")}</span></li>
          {/each}
        </ul>
      {/if}
    {:else}
      <form class="qcard card" onsubmit={check}>
        <span class="q-type caption muted"><Icon name="rows" size={18} />{t("mode.vervoegen")}</span>
        <p class="verb">{card.front}</p>
        {#if card.back}<p class="meaning muted">{card.back}</p>{/if}
        <ol class="grid">
          {#each columns as label, i (i)}
            {#if card.forms[i]?.trim()}
              {@const ok = result?.right[i]}
              <li>
                <label for="form-{i}" class="label">{label}</label>
                <div class="cell">
                  <input
                    id="form-{i}"
                    class="form"
                    class:ok={result && ok}
                    class:bad={result && ok === false}
                    type="text"
                    bind:value={given[i]}
                    readonly={!!result}
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                    lang={deck.langFront === "xx" ? undefined : deck.langFront}
                    onkeydown={(e) => onkey(e, i)}
                  />
                  {#if result && ok === false}<span class="right-form">{card.forms[i]}</span>{/if}
                </div>
              </li>
            {/if}
          {/each}
        </ol>
        {#if result}
          <div class="sheet {result.grade === 'goed' ? 'correct' : result.grade === 'twijfel' ? 'close' : 'wrong'}" role="status">
            <p class="sheet-title">{result.grade === "goed" ? t("practice.correct") : result.grade === "twijfel" ? t("forms.almost") : t("practice.wrong")}</p>
            {#if result.grade !== "goed"}<p class="small">{tp("forms.wrongCount", result.right.filter((r) => r === false).length)}</p>{/if}
          </div>
        {/if}
        <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
      </form>
      <div class="actions">
        {#if result}
          <button type="button" class="btn btn-primary btn-lg btn-block next" onclick={next}>{t("practice.next")}</button>
        {:else}
          <button type="button" class="btn btn-primary btn-lg btn-block" onclick={() => check()}>{t("practice.check")}</button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .play {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 100dvh;
  }
  .p-top {
    position: sticky;
    top: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 720px;
    margin-inline: auto;
    padding: calc(0.5rem + env(safe-area-inset-top)) var(--gutter) 0.5rem;
    background: var(--bg);
  }
  .bar {
    height: 12px;
  }
  .counts {
    display: inline-flex;
    gap: 0.5rem;
  }
  .ok {
    color: var(--good);
  }
  .bad {
    color: var(--bad);
  }
  .p-body {
    display: grid;
    align-content: start;
    gap: 1rem;
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
    padding: 1rem var(--gutter) calc(2rem + env(safe-area-inset-bottom));
  }
  .qcard {
    display: grid;
    gap: 0.75rem;
    padding: 1rem 1.25rem 1.5rem;
    overflow: hidden;
  }
  .q-type {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
  .verb {
    font-size: var(--fs-prompt);
    font-weight: 900;
    line-height: 1.15;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .meaning {
    text-align: center;
    font-weight: 700;
    margin-top: -0.5rem;
  }
  .grid {
    display: grid;
    gap: 0.5rem;
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
  }
  .grid li {
    display: grid;
    grid-template-columns: minmax(5.5rem, 30%) 1fr;
    align-items: center;
    gap: 0.75rem;
  }
  .label {
    text-align: right;
    overflow-wrap: anywhere;
  }
  .cell {
    display: grid;
    gap: 0.125rem;
  }
  .form {
    font-weight: 700;
  }
  .form.ok {
    border-color: var(--green);
    color: var(--good);
  }
  .form.bad {
    border-color: var(--bad-fill);
    color: var(--bad);
  }
  .right-form {
    color: var(--good);
    font-weight: 700;
    font-size: var(--fs-small);
  }
  .sheet {
    display: grid;
    gap: 0.25rem;
    margin: 0.25rem -1.25rem -1.5rem;
    padding: 1rem 1.25rem 1.25rem;
  }
  .sheet.correct {
    background: var(--good-soft);
    color: var(--good);
  }
  .sheet.close {
    background: var(--warn-soft);
    color: var(--warn);
  }
  .sheet.wrong {
    background: var(--bad-soft);
    color: var(--bad);
  }
  .sheet-title {
    font-size: var(--fs-section);
    font-weight: 900;
  }
  .actions {
    display: grid;
  }
  .done {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    text-align: center;
  }
  .actions-row {
    justify-content: center;
    margin-top: 0.5rem;
  }
  .mistake {
    display: grid;
    gap: 0.125rem;
    padding: 0.75rem 1rem;
    overflow-wrap: anywhere;
  }
  .m-q {
    font-weight: 700;
  }
  .m-a {
    color: var(--good);
  }
</style>
