<script lang="ts">
  import { tick, untrack } from "svelte";
  import { t, tp } from "../i18n/index.svelte";
  import AccentBar from "../components/AccentBar.svelte";
  import Icon from "../components/Icon.svelte";
  import Results from "../components/Results.svelte";
  import { insertAtCaret } from "../lib/accents";
  import { checkAnswer, hintText, type Verdict } from "../lib/answer";
  import { app } from "../lib/app.svelte";
  import { Practice, type Direction, type PracticeCard } from "../lib/practice";
  import { href, type Count, type Which } from "../lib/router";
  import { playRight, playWrong } from "../lib/sounds";
  import { canSpeak, loadVoices, speak, stopSpeaking } from "../lib/speech";
  import type { ContentLang, Grade, Mode } from "../lib/types";

  let { scope, mode, dir, which, count = "all" }: { scope: string; mode: Mode; dir: Direction; which: Which; count?: Count } = $props();

  type Feedback = { verdict: Verdict; grade: Grade; note?: "accents" | "typo"; given?: string; chosen?: number };

  let engine = $state.raw<Practice | null>(null);
  let version = $state(0);
  let given = $state("");
  let hint = $state(0);
  let flipped = $state(false);
  let feedback = $state<Feedback | null>(null);
  let voices = $state(false);
  let inputEl: HTMLInputElement | undefined = $state();
  let nextBtn: HTMLButtonElement | undefined = $state();
  let cardBtn: HTMLElement | undefined = $state();
  let optionsEl: HTMLElement | undefined = $state();

  const exitHref = $derived(scope === "alles" ? href.today() : href.deck(scope));
  const exitLabel = $derived(scope === "alles" ? t("practice.backHome") : t("practice.backToList"));
  const q = $derived.by(() => {
    void version;
    return engine?.current ?? null;
  });
  const isTest = $derived(mode === "toets");
  /** The engine is plain TypeScript; `version` is bumped after every answer so these re-read it. */
  const stats = $derived.by(() => {
    void version;
    const e = engine;
    return e ? { done: e.done, total: e.total, right: e.right, wrong: e.wrong, remaining: e.remaining } : { done: 0, total: 0, right: 0, wrong: 0, remaining: 0 };
  });
  const progress = $derived(stats.total ? (stats.done / stats.total) * 100 : 0);

  function start(cards: PracticeCard[]) {
    engine = new Practice(cards, { mode, direction: dir, canSpeak, keepOrder: mode === "herhalen" });
    version++;
    void prepareQuestion();
  }

  // Build the session once, after the voices are known (dictee needs them).
  $effect(() => {
    untrack(() => {
      void loadVoices().then(() => {
        voices = true;
        start(app.practiceCards(scope, which, count));
      });
    });
    return () => stopSpeaking();
  });

  async function prepareQuestion() {
    given = "";
    hint = 0;
    flipped = false;
    feedback = null;
    await tick();
    const cur = engine?.current;
    if (!cur) return;
    if (cur.kind === "dictee") speak(cur.prompt, cur.promptLang);
    else if (app.settings.autoSpeak && cur.promptLang !== "xx") speak(cur.prompt, cur.promptLang);
    if (cur.kind === "type" || cur.kind === "dictee") inputEl?.focus();
    else if (cur.kind === "flash") cardBtn?.focus();
    else optionsEl?.querySelector<HTMLButtonElement>("button")?.focus();
  }

  function sound(right: boolean) {
    if (!app.settings.sounds || isTest) return;
    if (right) playRight();
    else playWrong();
  }

  /** Saves the answer and moves to the next question. */
  async function commit(grade: Grade, typed?: string) {
    const cur = engine?.current;
    if (!engine || !cur) return;
    drag = 0;
    engine.answer(grade, typed);
    version++;
    app.grade(cur.card.id, grade, mode).catch(() => app.showFlash(t("common.saveFailed")));
    await prepareQuestion();
  }

  async function showFeedback(f: Feedback) {
    feedback = f;
    sound(f.verdict === "correct");
    const cur = q;
    if (cur && app.settings.autoSpeak && cur.answerLang !== "xx" && f.verdict !== "correct") speak(cur.answer, cur.answerLang);
    await tick();
    nextBtn?.focus();
  }

  function check(e?: SubmitEvent) {
    e?.preventDefault();
    const cur = q;
    if (!cur) return;
    // A second Enter while the answer sheet is showing moves on, even before focus reaches "Next".
    if (feedback) {
      next();
      return;
    }
    const typed = given.trim();
    if (!typed) {
      inputEl?.focus();
      return;
    }
    const res = checkAnswer(typed, cur.answer, { lenientAccents: app.settings.lenientAccents, lenientTypos: app.settings.lenientTypos });
    let grade: Grade = res.verdict === "correct" ? "goed" : res.verdict === "close" ? "twijfel" : "fout";
    if (grade === "goed" && hint > 0) grade = "twijfel";
    if (isTest) {
      void commit(grade, typed);
      return;
    }
    void showFeedback({ verdict: res.verdict, grade, ...(res.note ? { note: res.note } : {}), given: typed });
  }

  function dontKnow() {
    if (!q || feedback) return;
    if (isTest) {
      void commit("fout");
      return;
    }
    void showFeedback({ verdict: "wrong", grade: "fout" });
  }

  function choose(i: number) {
    const cur = q;
    if (!cur?.options || feedback) return;
    const right = cur.options[i] === cur.answer;
    const grade: Grade = right ? "goed" : "fout";
    if (isTest) {
      void commit(grade, cur.options[i]);
      return;
    }
    void showFeedback({ verdict: right ? "correct" : "wrong", grade, chosen: i, ...(right ? {} : { given: cur.options[i]! }) });
  }

  function next() {
    if (!feedback) return;
    void commit(feedback.grade, feedback.given);
  }

  function overrule() {
    if (!feedback) return;
    void commit("goed", feedback.given);
  }

  function selfGrade(grade: Grade) {
    if (grade !== "twijfel") sound(grade === "goed");
    void commit(grade);
  }

  function flip() {
    if (!q || q.kind !== "flash" || flipped) return;
    flipped = true;
    if (app.settings.autoSpeak && q.answerLang !== "xx") speak(q.answer, q.answerLang);
  }

  function useHint() {
    if (!q) return;
    hint = Math.min(hint + 1, q.answer.length);
    inputEl?.focus();
  }

  function insertChar(ch: string) {
    if (!inputEl) return;
    given = insertAtCaret(inputEl, ch);
    inputEl.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !q) return;
    const el = e.target as HTMLElement | null;
    const typing = !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    if (typing) return;
    if (q.kind === "flash") {
      if ((e.key === " " || e.key === "Enter") && !flipped && el?.tagName !== "BUTTON" && el?.tagName !== "A") {
        e.preventDefault();
        flip();
        return;
      }
      if (flipped) {
        const grades: Grade[] = mode === "herhalen" ? ["fout", "twijfel", "goed"] : ["fout", "goed"];
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < grades.length) {
          e.preventDefault();
          selfGrade(grades[idx]!);
        }
      }
    } else if (q.kind === "mc" && !feedback) {
      const idx = Number(e.key) - 1;
      if (q.options && idx >= 0 && idx < q.options.length) {
        e.preventDefault();
        choose(idx);
      }
    }
  }

  function langName(l: ContentLang): string {
    return t(`lang.${l}`);
  }

  function restartAll() {
    start(app.practiceCards(scope, which, count));
  }

  // Marking the current word.
  const starredNow = $derived(q ? !!app.cards.find((c) => c.id === q.card.id)?.starred : false);
  function toggleStar() {
    if (q) void app.setStarred(q.card.id, !starredNow);
  }

  // Swiping a flipped flashcard: right = knew it, left = didn't.
  const SWIPE = 90;
  let drag = $state(0);
  let dragging = false;
  let startX = 0;
  function onpointerdown(e: PointerEvent) {
    if (!flipped || e.pointerType === "mouse") return;
    dragging = true;
    startX = e.clientX;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Pointer already released; the swipe still works without capture.
    }
  }
  function onpointermove(e: PointerEvent) {
    if (dragging) drag = e.clientX - startX;
  }
  function onpointerup() {
    if (!dragging) return;
    dragging = false;
    if (Math.abs(drag) >= SWIPE) {
      const knew = drag > 0;
      sound(knew);
      void commit(knew ? "goed" : "fout");
    } else drag = 0;
  }

  function restartMistakes() {
    if (!engine) return;
    const ids = new Set(engine.mistakes.map((m) => m.card.id));
    start(app.practiceCards(scope, "all").filter((c) => ids.has(c.id)));
  }
</script>

<svelte:window {onkeydown} />

<div class="practice">
  <header class="p-top">
    <a class="icon-btn close" href={exitHref} aria-label={t("practice.stop")}><Icon name="x" /></a>
    <div class="bar p-bar" aria-hidden="true"><span style:width="{progress}%"></span></div>
    {#if engine && q}
      {#if isTest}
        <span class="counts caption num">{t("practice.questionOf", { i: stats.done + 1, n: stats.total })}</span>
      {:else}
        <span class="counts caption num">
          <span class="c-left">{t("practice.remaining", { n: stats.remaining })}</span>
          <span class="c-right" aria-label={tp("practice.rightCount", stats.right)}><Icon name="check" size={14} />{stats.right}</span>
          <span class="c-wrong" aria-label={tp("practice.wrongCount", stats.wrong)}><Icon name="x" size={14} />{stats.wrong}</span>
        </span>
      {/if}
    {/if}
  </header>

  <div class="p-body">
    <h1 class="visually-hidden">{t(`mode.${mode}`)}</h1>
    {#if !engine}
      {#if voices}<p class="muted">{t("common.loading")}</p>{/if}
    {:else if engine.total === 0}
      <div class="card card-pad empty">
        <p>{mode === "dictee" ? t("practice.nothingDictee") : t("practice.nothing")}</p>
        <a class="btn btn-primary" href={exitHref}>{exitLabel}</a>
      </div>
    {:else if !q}
      <Results {engine} {exitHref} {exitLabel} onagain={restartAll} onmistakes={restartMistakes} />
    {:else}
      {#key q.key}
        <div
          class="qcard card"
          class:has-feedback={!!feedback}
          class:swipe-right={drag >= SWIPE / 2}
          class:swipe-left={drag <= -SWIPE / 2}
          style:transform={drag ? `translateX(${drag}px) rotate(${drag / 24}deg)` : undefined}
        >
          {#if !isTest}
            <button type="button" class="icon-btn qstar" class:on={starredNow} aria-pressed={starredNow} aria-label={starredNow ? t("practice.unstar") : t("practice.star")} title={starredNow ? t("practice.unstar") : t("practice.star")} onclick={toggleStar}>
              <Icon name="star" size={22} filled={starredNow} />
            </button>
          {/if}
          {#if q.kind === "flash"}
            <!-- It is a button until flipped, then a plain focus target. -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <div
              class="flip"
              class:flipped
              role={flipped ? undefined : "button"}
              tabindex={flipped ? -1 : 0}
              aria-label={flipped ? undefined : `${q.prompt}. ${t("practice.show")}`}
              bind:this={cardBtn}
              {onpointerdown}
              {onpointermove}
              {onpointerup}
              onpointercancel={() => {
                dragging = false;
                drag = 0;
              }}
              onclick={flip}
              onkeydown={(e) => {
                if (!flipped && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  flip();
                }
              }}
            >
              <div class="face front">
                <span class="lang-label caption">{langName(q.promptLang)}</span>
                <p class="prompt" lang={q.promptLang === "xx" ? undefined : q.promptLang}>{q.prompt}</p>
                <span class="small muted">{t("practice.flipHint")}</span>
              </div>
              <div class="face back">
                <span class="lang-label caption">{langName(q.answerLang)}</span>
                <p class="prompt answer" lang={q.answerLang === "xx" ? undefined : q.answerLang}>{q.answer}</p>
                <span class="small muted">{q.prompt}</span>
              </div>
            </div>
            <p class="visually-hidden" aria-live="polite">{#if flipped}{q.answer}{/if}</p>
            {#if flipped}<p class="swipe-hint small muted">{t("practice.swipeHint")}</p>{/if}
          {:else}
            <div class="ask">
              {#if q.kind === "dictee"}
                <p class="prompt-sm">{t("practice.listen")}</p>
                <button type="button" class="play" aria-label={t("practice.playAgain")} onclick={() => speak(q.prompt, q.promptLang)}>
                  <Icon name="speaker" size={34} />
                </button>
              {:else}
                <span class="lang-label caption">{langName(q.promptLang)}</span>
                <div class="prompt-row">
                  <p class="prompt" id="prompt-{q.key}" lang={q.promptLang === "xx" ? undefined : q.promptLang}>{q.prompt}</p>
                  {#if q.promptLang !== "xx" && canSpeak(q.promptLang)}
                    <button type="button" class="icon-btn speak" aria-label={t("common.speak")} onclick={() => speak(q.prompt, q.promptLang)}><Icon name="speaker" /></button>
                  {/if}
                </div>
              {/if}
            </div>

            {#if q.kind === "type" || q.kind === "dictee"}
              <form class="answer-form" onsubmit={check}>
                <label class="caption muted" for="answer-{q.key}">
                  {q.answerLang === "xx" ? t("practice.typeHere") : t("practice.answerIn", { lang: langName(q.answerLang) })}
                </label>
                <input
                  id="answer-{q.key}"
                  class="answer-input"
                  class:ok={feedback?.verdict === "correct"}
                  class:near={feedback?.verdict === "close"}
                  class:bad={feedback?.verdict === "wrong"}
                  type="text"
                  bind:value={given}
                  bind:this={inputEl}
                  readonly={!!feedback}
                  autocomplete="off"
                  autocapitalize="off"
                  autocorrect="off"
                  spellcheck="false"
                  enterkeyhint="done"
                  lang={q.answerLang === "xx" ? undefined : q.answerLang}
                  aria-describedby={q.kind === "type" ? `prompt-${q.key}` : undefined}
                  placeholder={t("practice.typeHere")}
                />
                {#if hint > 0 && !feedback}
                  <p class="hint small" aria-live="polite">{t("practice.hintLabel", { hint: hintText(q.answer, hint) })}</p>
                {/if}
                {#if !feedback}
                  <AccentBar lang={q.answerLang} oninsert={insertChar} />
                {/if}
                <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
              </form>
            {:else if q.kind === "mc" && q.options}
              <p class="caption muted">{t("practice.chooseAnswer")}</p>
              <div class="options" role="group" aria-labelledby="prompt-{q.key}" bind:this={optionsEl}>
                {#each q.options as opt, i (i)}
                  <button
                    type="button"
                    class="option"
                    class:right={!!feedback && opt === q.answer}
                    class:wrong={feedback?.chosen === i && opt !== q.answer}
                    disabled={!!feedback && opt !== q.answer && feedback.chosen !== i}
                    aria-keyshortcuts={String(i + 1)}
                    onclick={() => choose(i)}
                    lang={q.answerLang === "xx" ? undefined : q.answerLang}
                  >
                    <span class="key caption num" aria-hidden="true">{i + 1}</span>
                    <span class="opt-text">{opt}</span>
                  </button>
                {/each}
              </div>
            {/if}
          {/if}

          {#if feedback}
            <div class="sheet {feedback.verdict}" role="status">
              <div class="sheet-head">
                <span class="sheet-ic" aria-hidden="true"><Icon name={feedback.verdict === "correct" ? "check" : "x"} size={22} /></span>
                <p class="sheet-title">{feedback.verdict === "correct" ? t("practice.correct") : feedback.verdict === "close" ? t("practice.close") : t("practice.wrong")}</p>
              </div>
              {#if feedback.note}
                <p class="small">{feedback.note === "accents" ? t("practice.noteAccents") : t("practice.noteTypo")}</p>
              {/if}
              {#if feedback.verdict !== "correct"}
                <div class="sheet-answer-row">
                  <p class="sheet-answer">{t("practice.theAnswer", { answer: q.answer })}</p>
                  {#if q.answerLang !== "xx" && canSpeak(q.answerLang)}
                    <button type="button" class="icon-btn sheet-speak" aria-label="{t('common.speak')}: {q.answer}" onclick={() => speak(q.answer, q.answerLang)}><Icon name="speaker" size={20} /></button>
                  {/if}
                </div>
                {#if feedback.given && q.kind !== "mc"}<p class="small">{t("practice.youTyped", { given: feedback.given })}</p>{/if}
              {/if}
            </div>
          {/if}
        </div>
      {/key}

      <div class="actions">
        {#if q.kind === "flash"}
          {#if !flipped}
            <button type="button" class="btn btn-primary btn-lg btn-block" onclick={flip}>{t("practice.show")}</button>
          {:else if mode === "herhalen"}
            <div class="grades three">
              <button type="button" class="btn btn-lg g-bad" onclick={() => selfGrade("fout")}><kbd>1</kbd>{t("grade.fout")}</button>
              <button type="button" class="btn btn-lg" onclick={() => selfGrade("twijfel")}><kbd>2</kbd>{t("grade.twijfel")}</button>
              <button type="button" class="btn btn-lg btn-good" onclick={() => selfGrade("goed")}><kbd>3</kbd>{t("grade.goed")}</button>
            </div>
          {:else}
            <div class="grades two">
              <button type="button" class="btn btn-lg g-bad" onclick={() => selfGrade("fout")}><kbd>1</kbd>{t("practice.didntKnow")}</button>
              <button type="button" class="btn btn-lg btn-good" onclick={() => selfGrade("goed")}><kbd>2</kbd>{t("practice.knewIt")}</button>
            </div>
          {/if}
        {:else if feedback}
          <div class="grades" class:two={feedback.verdict !== "correct" && q.kind !== "mc"}>
            {#if feedback.verdict !== "correct" && q.kind !== "mc"}
              <button type="button" class="btn btn-lg" onclick={overrule}>{t("practice.overrule")}</button>
            {/if}
            <button
              type="button"
              class="btn btn-lg"
              class:btn-good={feedback.verdict === "correct"}
              class:btn-primary={feedback.verdict !== "correct"}
              bind:this={nextBtn}
              onclick={next}>{t("practice.next")}</button
            >
          </div>
        {:else if q.kind === "type" || q.kind === "dictee"}
          <div class="grades two">
            {#if !isTest && q.kind === "type" && (mode === "typen" || mode === "leren")}
              <button type="button" class="btn btn-lg" onclick={useHint}><Icon name="hint" size={20} />{t("practice.hint")}</button>
            {:else}
              <button type="button" class="btn btn-lg" onclick={dontKnow}>{t("practice.dontKnow")}</button>
            {/if}
            <button type="button" class="btn btn-primary btn-lg" onclick={() => check()}>{isTest ? t("practice.next") : t("practice.check")}</button>
          </div>
          {#if !isTest && q.kind === "type" && (mode === "typen" || mode === "leren")}
            <button type="button" class="btn btn-quiet dont" onclick={dontKnow}>{t("practice.dontKnow")}</button>
          {/if}
        {:else if q.kind === "mc"}
          <p class="small muted center">{t("practice.keysMc")}</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .practice {
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
    padding: calc(0.5rem + env(safe-area-inset-top)) max(var(--gutter), env(safe-area-inset-right)) 0.5rem max(var(--gutter), env(safe-area-inset-left));
    background: var(--bg);
    max-width: 720px;
    width: 100%;
    margin-inline: auto;
  }
  .p-bar {
    height: 14px;
  }
  .counts {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--ink-2);
  }
  .c-right,
  .c-wrong {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
  }
  .c-right {
    color: var(--good);
  }
  .c-wrong {
    color: var(--bad);
  }
  @media (max-width: 420px) {
    .c-left {
      display: none;
    }
  }

  .p-body {
    display: grid;
    align-content: start;
    gap: 1rem;
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
    padding: 1rem max(var(--gutter), env(safe-area-inset-right)) calc(2rem + env(safe-area-inset-bottom)) max(var(--gutter), env(safe-area-inset-left));
  }
  .empty {
    display: grid;
    gap: 1rem;
    justify-items: start;
  }

  .qcard {
    position: relative;
    border-width: 2px;
    transition: border-color var(--t-base) var(--ease);
    display: grid;
    gap: 1.25rem;
    padding: 1.5rem 1.25rem;
    overflow: hidden;
  }
  .ask {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    text-align: center;
    padding: 0.75rem 0 0.25rem;
  }
  .lang-label {
    color: var(--ink-2);
  }
  .prompt-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
  }
  .prompt {
    font-size: clamp(1.75rem, 7vw, var(--fs-display));
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .prompt-sm {
    font-size: var(--fs-h2);
    font-weight: 800;
  }
  .play {
    display: grid;
    place-items: center;
    width: 84px;
    height: 84px;
    border: 0;
    border-radius: 50%;
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: 0 var(--edge) 0 var(--accent-edge);
    cursor: pointer;
    transition: transform var(--t-press) var(--ease), box-shadow var(--t-press) var(--ease);
  }
  .play:active {
    transform: translateY(var(--edge));
    box-shadow: 0 0 0 var(--accent-edge);
  }

  .answer-form {
    display: grid;
    gap: 0.5rem;
  }
  .answer-input {
    min-height: 3.5rem;
    border-width: 0 0 3px;
    border-radius: 0;
    padding-inline: 0.25rem;
    background: transparent;
    font-size: var(--fs-h2);
    font-weight: 700;
  }
  .answer-input:focus-visible {
    border-color: var(--accent);
  }
  .answer-input.ok {
    border-color: var(--good-fill);
  }
  .answer-input.near {
    border-color: var(--warn);
  }
  .answer-input.bad {
    border-color: var(--bad-fill);
  }
  .hint {
    color: var(--accent-text);
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .options {
    display: grid;
    gap: 0.75rem;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 3.5rem;
    padding: 0.75rem 1rem;
    border: 2px solid var(--line);
    border-radius: var(--r-sm);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    font-size: var(--fs-lead);
    text-align: left;
    cursor: pointer;
    box-shadow: 0 var(--edge-2) 0 var(--line-strong);
    margin-bottom: var(--edge-2);
    transition: border-color var(--t-base) var(--ease), background-color var(--t-base) var(--ease), transform var(--t-press) var(--ease), box-shadow var(--t-press) var(--ease);
  }
  .option:hover:not([disabled]) {
    border-color: var(--accent);
  }
  .option:active:not([disabled]) {
    transform: translateY(var(--edge-2));
    box-shadow: 0 0 0 var(--line-strong);
  }
  .option[disabled] {
    opacity: 0.5;
    cursor: default;
  }
  .option.right {
    border-color: var(--good-fill);
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
  .opt-text {
    overflow-wrap: anywhere;
  }

  /* Flashcard: both faces share one grid cell so the card is as tall as its tallest side. */
  .flip {
    display: grid;
    perspective: 1400px;
    cursor: pointer;
    border-radius: var(--r-lg);
    touch-action: pan-y;
  }
  .qcard.swipe-right {
    border-color: var(--good-fill);
  }
  .qcard.swipe-left {
    border-color: var(--bad-fill);
  }
  .swipe-hint {
    text-align: center;
  }
  @media (hover: hover) and (pointer: fine) {
    .swipe-hint {
      display: none;
    }
  }
  .qstar {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 1;
  }
  .qstar.on {
    color: #f5a524;
  }
  .flip.flipped {
    cursor: default;
  }
  .face {
    grid-area: 1 / 1;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 0.75rem;
    min-height: 16rem;
    padding: 1rem;
    text-align: center;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    transition: transform 420ms var(--ease);
  }
  .front {
    transform: rotateY(0deg);
  }
  .back {
    transform: rotateY(180deg);
  }
  .flipped .front {
    transform: rotateY(-180deg);
  }
  .flipped .back {
    transform: rotateY(0deg);
  }
  .answer {
    color: var(--accent-text);
  }
  @media (prefers-reduced-motion: reduce) {
    .face {
      transform: none !important;
    }
    .flipped .front,
    .flip:not(.flipped) .back {
      visibility: hidden;
    }
  }

  /* The signature moment: the answer sheet slides up from the bottom of the card. */
  .sheet {
    display: grid;
    gap: 0.5rem;
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
  .sheet-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .sheet-ic {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: currentColor;
  }
  .sheet-ic :global(.icon) {
    color: var(--surface);
  }
  .sheet-title {
    font-size: var(--fs-h2);
    font-weight: 800;
  }
  .sheet-answer-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .sheet-speak {
    color: inherit;
  }
  .sheet-answer {
    font-weight: 700;
    color: var(--ink);
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
  @media (max-width: 719px) {
    .actions {
      position: sticky;
      bottom: 0;
      padding: 0.75rem 0 calc(0.5rem + env(safe-area-inset-bottom));
      background: var(--bg);
    }
  }
  .grades {
    display: grid;
    gap: 0.75rem;
  }
  .grades.two {
    grid-template-columns: 1fr 1fr;
  }
  .grades.three {
    grid-template-columns: repeat(3, 1fr);
  }
  .grades kbd {
    display: none;
    font: inherit;
    font-size: var(--fs-caption);
    padding: 0 0.5rem;
    border-radius: var(--r-xs);
    border: 1px solid currentColor;
    opacity: 0.7;
  }
  @media (hover: hover) and (pointer: fine) {
    .grades kbd {
      display: inline-block;
    }
  }
  .g-bad {
    --text: var(--bad);
  }
  .dont {
    justify-self: center;
  }
  .center {
    text-align: center;
  }
</style>
