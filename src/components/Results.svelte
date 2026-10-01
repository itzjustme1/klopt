<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { app } from "../lib/app.svelte";
  import type { Practice } from "../lib/practice";
  import Icon from "./Icon.svelte";

  let {
    engine,
    exitHref,
    exitLabel,
    onagain,
    onmistakes,
  }: { engine: Practice; exitHref: string; exitLabel: string; onagain: () => void; onmistakes: () => void } = $props();

  const isTest = $derived(engine.mode === "toets");
  const firstRight = $derived([...engine.first.values()].filter((g) => g === "goed").length);
  const cijfer = $derived(new Intl.NumberFormat(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(engine.cijfer));
  const pass = $derived(engine.cijfer >= 5.5);
  const s = $derived(app.streak());
  const left = $derived(Math.max(0, app.settings.dailyGoal - app.answersToday()));
  let heading: HTMLElement | undefined = $state();

  $effect(() => {
    heading?.focus();
  });
</script>

<section class="results">
  <div class="score card">
    {#if isTest}
      <h2 tabindex="-1" bind:this={heading}>{t("result.testTitle")}</h2>
      <p class="cijfer num" class:pass class:fail={!pass}>{cijfer}</p>
      <p class="muted">{t("result.firstTry", { right: firstRight, total: engine.total })}</p>
    {:else}
      
      <h2 tabindex="-1" bind:this={heading}>{t("result.title")}</h2>
      <p class="muted">{engine.mistakes.length === 0 ? t("result.perfect") : t("result.firstTry", { right: firstRight, total: engine.total })}</p>
    {/if}
    <div class="chips">
      <span class="chip streak"><Icon name="flame" size={18} filled />{tp("result.streak", s.days)}</span>
      <span class="chip">{left === 0 ? t("result.goalDone") : tp("result.goalLeft", left)}</span>
    </div>
  </div>

  {#if engine.mistakes.length > 0}
    <div class="mistakes card">
      <h3>{t("result.mistakes")}</h3>
      <ul>
        {#each engine.mistakes as m (m.card.id)}
          <li>
            <span class="m-prompt">{m.prompt}</span>
            <span class="m-answer">{m.answer}</span>
            {#if m.given}<span class="m-given small">{t("result.yours", { given: m.given })}</span>{/if}
          </li>
        {/each}
      </ul>
      {#if engine.mode === "herhalen"}<p class="small muted">{t("result.tomorrow")}</p>{/if}
    </div>
  {/if}

  <div class="row actions">
    {#if engine.mistakes.length > 0}
      <button type="button" class="btn btn-primary btn-lg" onclick={onmistakes}>{tp("result.practiceMistakes", engine.mistakes.length)}</button>
    {/if}
    {#if engine.mode !== "herhalen"}
      <button type="button" class="btn btn-lg" class:btn-primary={engine.mistakes.length === 0} onclick={onagain}>{t("result.again")}</button>
    {/if}
    <a class="btn btn-lg" href={exitHref}>{exitLabel}</a>
  </div>
</section>

<style>
  .results {
    display: grid;
    gap: 1rem;
  }
  .score {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    padding: 2rem 1.25rem 1.5rem;
    text-align: center;
  }
  .score h2 {
    font-size: var(--fs-title);
    font-weight: 800;
  }
  .cijfer {
    font-size: var(--fs-hero);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.04em;
  }
  .cijfer.pass {
    color: var(--good);
  }
  .cijfer.fail {
    color: var(--bad);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .streak {
    background: var(--surface);
    box-shadow: inset 0 0 0 2px var(--yellow);
  }
  .streak :global(.icon) {
    color: var(--flame);
  }
  .mistakes {
    display: grid;
    gap: 0.75rem;
    padding: 1.25rem;
  }
  .mistakes ul {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .mistakes li {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.125rem 1rem;
    padding: 0.75rem 0;
    border-top: 1px solid var(--line);
    overflow-wrap: anywhere;
  }
  .m-prompt {
    font-weight: 700;
  }
  .m-answer {
    color: var(--good);
    font-weight: 700;
  }
  .m-given {
    grid-column: 2;
    color: var(--bad);
    text-decoration: line-through;
  }
  .actions {
    gap: 0.75rem;
  }
</style>
