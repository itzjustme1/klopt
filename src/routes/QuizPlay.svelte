<script lang="ts">
  import { tick, untrack } from "svelte";
  import { getLang, t } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import { app } from "../lib/app.svelte";
  import { blanksOf, clozeParts, mark, quizGrade, type Marked, type Response } from "../lib/quiz";
  import { href } from "../lib/router";
  import { playRight, playWrong } from "../lib/sounds";
  import { canSpeak, loadVoices, speak, stopSpeaking } from "../lib/speech";
  import type { QuizQuestion } from "../lib/types";

  let { id }: { id: string } = $props();

  const quiz = $derived(app.quiz(id));
  const questions = $derived(quiz?.questions ?? []);
  let index = $state(0);
  let results = $state<{ q: QuizQuestion; marked: Marked; response: Response }[]>([]);
  /** The marked answer to the current question while its feedback shows. */
  let feedback = $state<{ marked: Marked; response: Response } | null>(null);
  let given = $state<string[]>([]);
  let openText = $state("");
  let dicteeText = $state("");
  /** Dictee questions this device cannot read aloud; they are left out of the score. */
  let skipped = $state(0);
  let voicesReady = $state(false);
  let revealed = $state(false);
  let finished = $state(false);
  let box: HTMLElement | undefined = $state();

  const q = $derived(questions[index]);
  const points = $derived(results.reduce((s, r) => s + r.marked.points, 0));
  const fmt = $derived(new Intl.NumberFormat(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const fmtPoints = $derived(new Intl.NumberFormat(getLang(), { maximumFractionDigits: 1 }));
  const total = $derived(questions.length - skipped);
  const grade = $derived(quizGrade(points, total));
  const spoken = $derived(q?.type === "dictee" && voicesReady && canSpeak(q.lang));
  const progress = $derived(questions.length ? ((index + (feedback ? 1 : 0)) / questions.length) * 100 : 0);
  const opts = $derived({ lenientAccents: app.settings.lenientAccents, lenientTypos: app.settings.lenientTypos });

  async function focusFirst() {
    await tick();
    box?.querySelector<HTMLElement>("input, textarea, .choice")?.focus();
  }
  $effect(() => {
    void index;
    void focusFirst();
  });
  $effect(() => {
    void loadVoices().then(() => (voicesReady = true));
    return stopSpeaking;
  });
  // A dictee question is read out as soon as it shows.
  $effect(() => {
    const cur = q;
    if (cur?.type === "dictee" && spoken && !finished) untrack(() => speak(cur.text, cur.lang));
  });

  function answer(response: Response) {
    if (!q || feedback) return;
    const marked = mark(q, response, opts);
    feedback = { marked, response };
    if (app.settings.sounds) {
      if (marked.points >= 1) playRight();
      else playWrong();
    }
    void tick().then(() => box?.querySelector<HTMLElement>(".next")?.focus());
  }

  function checkCloze(e?: SubmitEvent) {
    e?.preventDefault();
    if (feedback) return next();
    answer({ type: "cloze", given: [...given] });
  }

  function checkDictee(e?: SubmitEvent) {
    e?.preventDefault();
    if (feedback) return next();
    if (!dicteeText.trim()) return;
    answer({ type: "dictee", given: dicteeText });
  }

  function skip() {
    if (!q || feedback) return;
    skipped++;
    advance();
  }

  function selfGrade(right: boolean) {
    if (!q || feedback) return;
    // An open answer is graded by the student; no feedback sheet needed after that.
    const response: Response = { type: "open", selfGrade: right ? "goed" : "fout" };
    results.push({ q, marked: mark(q, response), response });
    advance();
  }

  function next() {
    if (!q || !feedback) return;
    results.push({ q, ...feedback });
    advance();
  }

  function advance() {
    feedback = null;
    given = [];
    openText = "";
    dicteeText = "";
    revealed = false;
    if (index + 1 >= questions.length) {
      finished = true;
      if (total > 0) void app.recordQuizResult(id, points, total).catch(() => app.showFlash(t("common.saveFailed")));
      return;
    }
    index++;
  }

  function again() {
    index = 0;
    results = [];
    skipped = 0;
    dicteeText = "";
    finished = false;
    feedback = null;
    given = [];
    openText = "";
    revealed = false;
    void focusFirst();
  }

  function rightAnswer(question: QuizQuestion): string {
    switch (question.type) {
      case "mc":
        return question.options[question.correct]!;
      case "tf":
        return question.answer ? t("quiz.true") : t("quiz.false");
      case "open":
        return question.answer;
      case "cloze":
        return question.text.replace(/\[([^\]\n]+)\]/g, "$1");
      case "dictee":
        return question.text;
    }
  }
  function promptOf(question: QuizQuestion): string {
    if (question.type === "cloze") return question.text.replace(/\[[^\]\n]+\]/g, "…");
    if (question.type === "dictee") return t("quiz.dicteeIn", { lang: t(`lang.${question.lang}`) });
    return question.prompt;
  }

  function onkeydown(e: KeyboardEvent) {
    if (!q || finished || e.altKey || e.ctrlKey || e.metaKey) return;
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (feedback && e.key === "Enter" && !typing) {
      e.preventDefault();
      next();
      return;
    }
    if (typing || feedback) return;
    const n = Number(e.key);
    if (q.type === "mc" && n >= 1 && n <= q.options.length) answer({ type: "mc", chosen: n - 1 });
    if (q.type === "tf" && (n === 1 || n === 2)) answer({ type: "tf", chosen: n === 1 });
  }
</script>

<svelte:window {onkeydown} />

<div class="play">
  <header class="p-top">
    <a class="icon-btn" href={href.quiz(id)} aria-label={t("quiz.stop")}><Icon name="x" /></a>
    <div class="bar" aria-hidden="true"><span style:width="{finished ? 100 : progress}%"></span></div>
    {#if !finished && q}<span class="caption num muted">{t("quiz.of", { i: index + 1, n: questions.length })}</span>{/if}
  </header>

  <div class="p-body" bind:this={box}>
    {#if !quiz}
      <p>{t("quiz.notFound")}</p>
    {:else if finished}
      <section class="done card card-pad">
        <h1 tabindex="-1">{t("quiz.result")}</h1>
        <p class="grade num" class:pass={total > 0 && grade >= 5.5} class:fail={total > 0 && grade < 5.5}>{total > 0 ? fmt.format(grade) : "–"}</p>
        <p class="muted">{t("quiz.score", { points: fmtPoints.format(points), total })}</p>
        <div class="row actions-row">
          <button type="button" class="btn btn-primary btn-lg" onclick={again}>{t("quiz.again")}</button>
          <a class="btn btn-lg" href={href.quiz(id)}>{t("quiz.backToQuiz")}</a>
        </div>
      </section>
      {#if results.some((r) => r.marked.points < 1)}
        <h2>{t("quiz.mistakes")}</h2>
        <ul class="rows">
          {#each results.filter((r) => r.marked.points < 1) as r (r.q.id)}
            <li class="mistake">
              <span class="m-q">{promptOf(r.q)}</span>
              <span class="m-a">{rightAnswer(r.q)}</span>
            </li>
          {/each}
        </ul>
      {/if}
    {:else if q}
      <h1 class="visually-hidden">{quiz.name}</h1>
      <div class="qcard card">
        <span class="q-type caption muted"><Icon name="quiz" size={18} />{t(`quiz.type.${q.type}`)}</span>

        {#if q.type === "cloze"}
          <form class="cloze" onsubmit={checkCloze} id="cloze-form">
            <p class="cloze-text">
              {#each clozeParts(q.text) as part, p (p)}
                {#if "blank" in part}
                  {@const b = clozeParts(q.text).slice(0, p).filter((x) => "blank" in x).length}
                  {@const ok = feedback?.marked.blanks?.[b]}
                  <input
                    type="text"
                    class="blank"
                    class:ok={feedback && ok}
                    class:bad={feedback && !ok}
                    aria-label={t("quiz.blank", { n: b + 1 })}
                    size={Math.max(4, part.blank.length + 1)}
                    bind:value={given[b]}
                    readonly={!!feedback}
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                  />
                {:else}<span>{part.text}</span>{/if}
              {/each}
            </p>
            <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
          </form>
        {:else if q.type === "dictee"}
          <form class="dictee" onsubmit={checkDictee} id="dictee-form">
            {#if voicesReady && !spoken}
              <p class="notice small" role="status">{t("quiz.noVoice", { lang: t(`lang.${q.lang}`) })}</p>
            {:else}
              <p class="prompt">{t("quiz.listen")}</p>
              <button type="button" class="speak-btn" aria-label={t("practice.playAgain")} disabled={!spoken} onclick={() => speak(q.text, q.lang)}>
                <Icon name="speaker" size={30} />
              </button>
              <div class="field">
                <label for="dictee-{index}" class="small muted">{t("quiz.writeHere", { lang: t(`lang.${q.lang}`) })}</label>
                <input
                  id="dictee-{index}"
                  type="text"
                  class="dictee-input"
                  class:ok={feedback && feedback.marked.points >= 1}
                  class:bad={feedback && feedback.marked.points < 1}
                  bind:value={dicteeText}
                  readonly={!!feedback}
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  lang={q.lang}
                />
              </div>
            {/if}
            <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
          </form>
        {:else}
          {@const [first, ...rest] = q.prompt.split("\n")}
          {#if rest.join("").trim()}
            <!-- A question with a source text under it ("Welk begrip past bij deze uitleg?"). -->
            <p class="prompt">{first}</p>
            <blockquote class="context">{rest.join("\n").trim()}</blockquote>
          {:else}
            <p class="prompt" class:long={q.prompt.length > 80}>{q.prompt}</p>
          {/if}
        {/if}

        {#if q.type === "mc"}
          <div class="options" role="group" aria-label={q.prompt}>
            {#each q.options as opt, o (o)}
              {@const r = feedback?.response.type === "mc" ? feedback.response.chosen : -1}
              <button
                type="button"
                class="choice option"
                class:right={!!feedback && o === q.correct}
                class:wrong={!!feedback && r === o && o !== q.correct}
                disabled={!!feedback && o !== q.correct && r !== o}
                aria-keyshortcuts={String(o + 1)}
                onclick={() => answer({ type: "mc", chosen: o })}
              >
                <span class="key caption num" aria-hidden="true">{o + 1}</span><span>{opt}</span>
              </button>
            {/each}
          </div>
        {:else if q.type === "tf"}
          <div class="tf">
            {#each [true, false] as v, o (o)}
              {@const r = feedback?.response.type === "tf" ? feedback.response.chosen : null}
              <button
                type="button"
                class="choice option"
                class:right={!!feedback && v === q.answer}
                class:wrong={!!feedback && r === v && v !== q.answer}
                disabled={!!feedback && v !== q.answer && r !== v}
                aria-keyshortcuts={String(o + 1)}
                onclick={() => answer({ type: "tf", chosen: v })}
              >
                <span class="key caption num" aria-hidden="true">{o + 1}</span><span>{v ? t("quiz.true") : t("quiz.false")}</span>
              </button>
            {/each}
          </div>
        {:else if q.type === "open"}
          <div class="field">
            <label for="open-{index}" class="small muted">{t("quiz.yourAnswer")}</label>
            <textarea id="open-{index}" rows="3" bind:value={openText} readonly={revealed}></textarea>
          </div>
          {#if revealed}
            <div class="model" role="status">
              <span class="caption muted">{t("quiz.modelAnswer")}</span>
              <p>{q.answer}</p>
            </div>
          {/if}
        {/if}

        {#if feedback}
          {@const v = feedback.marked.points >= 1 ? "correct" : feedback.marked.points > 0 ? "close" : "wrong"}
          <div class="sheet {v}" role="status">
            <p class="sheet-title">{v === "correct" ? t("quiz.correct") : v === "close" ? t("quiz.partly") : t("quiz.wrong")}</p>
            {#if v !== "correct"}<p class="sheet-answer">{t("quiz.answerWas", { answer: rightAnswer(q) })}</p>{/if}
          </div>
        {/if}
      </div>

      <div class="actions">
        {#if feedback}
          <button type="button" class="btn btn-primary btn-lg btn-block next" onclick={next}>{index + 1 >= questions.length ? t("quiz.finish") : t("quiz.next")}</button>
        {:else if q.type === "dictee"}
          {#if voicesReady && !spoken}
            <button type="button" class="btn btn-primary btn-lg btn-block" onclick={skip}>{t("quiz.skip")}</button>
          {:else}
            <button type="submit" form="dictee-form" class="btn btn-primary btn-lg btn-block" disabled={!dicteeText.trim()}>{t("quiz.check")}</button>
          {/if}
        {:else if q.type === "cloze"}
          <button type="submit" form="cloze-form" class="btn btn-primary btn-lg btn-block" disabled={blanksOf(q.text).some((_, b) => !(given[b] ?? "").trim())}>{t("quiz.check")}</button>
        {:else if q.type === "open"}
          {#if !revealed}
            <button type="button" class="btn btn-primary btn-lg btn-block" onclick={() => (revealed = true)}>{t("quiz.showAnswer")}</button>
          {:else}
            <p class="small muted center">{t("quiz.gradeSelf")}</p>
            <div class="grades">
              <button type="button" class="btn btn-lg g-bad" onclick={() => selfGrade(false)}>{t("quiz.selfWrong")}</button>
              <button type="button" class="btn btn-lg btn-good" onclick={() => selfGrade(true)}>{t("quiz.selfRight")}</button>
            </div>
          {/if}
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
    gap: 1.25rem;
    padding: 1rem 1.25rem 1.5rem;
    overflow: hidden;
  }
  .q-type {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
  .prompt {
    font-size: var(--fs-section);
    font-weight: 900;
    line-height: 1.3;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .context {
    margin: 0;
    padding: 0.875rem 1rem;
    border-left: 4px solid var(--accent);
    border-radius: var(--r-xs);
    background: var(--surface-2);
    font-size: var(--fs-lead);
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .prompt.long {
    font-size: var(--fs-lead);
    font-weight: 700;
  }
  .cloze-text {
    font-size: var(--fs-lead);
    font-weight: 700;
    line-height: 2.4;
    overflow-wrap: anywhere;
  }
  .blank {
    width: auto;
    max-width: 100%;
    min-height: 40px;
    margin: 0 0.25rem;
    padding: 0.25rem 0.5rem;
    border-width: 0 0 3px;
    border-radius: var(--r-xs) var(--r-xs) 0 0;
    border-color: var(--line-strong);
    font-weight: 700;
    vertical-align: baseline;
  }
  .dictee {
    display: grid;
    justify-items: center;
    gap: 1rem;
  }
  .dictee .field {
    width: 100%;
  }
  .speak-btn {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border: 0;
    border-radius: 50%;
    background: var(--brand);
    color: var(--on-brand);
    box-shadow: 0 var(--edge) 0 rgb(0 0 0 / 0.25);
    cursor: pointer;
    transition: transform var(--t-press) var(--ease), box-shadow var(--t-press) var(--ease);
  }
  .speak-btn:active:not([disabled]) {
    transform: translateY(var(--edge));
    box-shadow: 0 0 0 rgb(0 0 0 / 0.25);
  }
  .speak-btn[disabled] {
    opacity: 0.5;
  }
  .dictee-input {
    min-height: 3.25rem;
    font-size: var(--fs-lead);
    font-weight: 700;
  }
  .dictee-input.ok {
    border-color: var(--green);
    color: var(--good);
  }
  .dictee-input.bad {
    border-color: var(--bad-fill);
    color: var(--bad);
  }
  .notice {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: var(--r-sm);
    background: var(--surface-2);
  }
  .blank.ok {
    border-color: var(--green);
    color: var(--good);
  }
  .blank.bad {
    border-color: var(--bad-fill);
    color: var(--bad);
  }
  .options,
  .tf {
    display: grid;
    gap: 0.75rem;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 3.5rem;
    padding: 0.75rem 1rem;
    border: 2px solid var(--line-strong);
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--ink);
    font-weight: 700;
    font-size: var(--fs-lead);
    text-align: left;
    cursor: pointer;
    transition: border-color var(--t-base) var(--ease), background-color var(--t-base) var(--ease);
  }
  .option:hover:not([disabled], .right, .wrong) {
    border-color: var(--accent);
  }
  .option[disabled] {
    opacity: 0.5;
    cursor: default;
  }
  .option.right {
    border-color: var(--green);
    background: var(--good-soft);
    color: var(--good);
    opacity: 1;
  }
  .option.wrong {
    border-color: var(--bad-fill);
    background: var(--bad-soft);
    color: var(--bad);
    opacity: 1;
  }
  .key {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: var(--r-xs);
    background: var(--surface-2);
    color: var(--ink-2);
    flex: none;
  }
  .model {
    display: grid;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    border-radius: var(--r-sm);
    background: var(--surface-2);
    font-weight: 700;
    white-space: pre-wrap;
  }
  .sheet {
    display: grid;
    gap: 0.375rem;
    margin: 0 -1.25rem -1.5rem;
    padding: 1rem 1.25rem 1.25rem;
    animation: sheet-in var(--t-signature) var(--ease);
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
  .sheet-answer {
    color: var(--ink);
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  @keyframes sheet-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }
  .actions {
    display: grid;
    gap: 0.5rem;
  }
  .grades {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .g-bad {
    --text: var(--bad);
  }
  .center {
    text-align: center;
  }
  .done {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    text-align: center;
  }
  .grade {
    font-size: var(--fs-hero);
    font-weight: 900;
    line-height: 1;
  }
  .grade.pass {
    color: var(--good);
  }
  .grade.fail {
    color: var(--bad);
  }
  .actions-row {
    justify-content: center;
    margin-top: 0.75rem;
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
    font-weight: 700;
  }
</style>
