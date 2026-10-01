<script lang="ts">
  import { untrack } from "svelte";
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import { app } from "../lib/app.svelte";
  import { newId } from "../lib/db";
  import { blanksOf, QUIZ_LIMITS, questionProblem } from "../lib/quiz";
  import { href } from "../lib/router";
  import { SUBJECTS } from "../lib/subjects";
  import type { QuizQuestion, QuizQuestionType } from "../lib/types";

  let { id }: { id?: string } = $props();

  /** One editable question: every field of every type, so switching type keeps what was typed. */
  type Draft = { key: number; id: string; type: QuizQuestionType; prompt: string; options: string[]; correct: number; answer: string; truth: boolean; text: string };

  const existing = untrack(() => (id ? app.quiz(id) : undefined));
  let nextKey = 0;
  const blank = (type: QuizQuestionType = "mc"): Draft => ({ key: nextKey++, id: newId(), type, prompt: "", options: ["", "", "", ""], correct: 0, answer: "", truth: true, text: "" });
  function toDraft(q: QuizQuestion): Draft {
    const d = blank(q.type);
    d.id = q.id;
    if (q.type === "mc") Object.assign(d, { prompt: q.prompt, options: [...q.options], correct: q.correct });
    if (q.type === "open") Object.assign(d, { prompt: q.prompt, answer: q.answer });
    if (q.type === "tf") Object.assign(d, { prompt: q.prompt, truth: q.answer });
    if (q.type === "cloze") d.text = q.text;
    return d;
  }
  function fromDraft(d: Draft): QuizQuestion {
    switch (d.type) {
      case "mc": {
        // Empty answer fields are dropped; the right one keeps pointing at the same text.
        const kept = d.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
        return { id: d.id, type: "mc", prompt: d.prompt.trim(), options: kept.map((x) => x.o), correct: Math.max(0, kept.findIndex((x) => x.i === d.correct)) };
      }
      case "open":
        return { id: d.id, type: "open", prompt: d.prompt.trim(), answer: d.answer.trim() };
      case "tf":
        return { id: d.id, type: "tf", prompt: d.prompt.trim(), answer: d.truth };
      case "cloze":
        return { id: d.id, type: "cloze", text: d.text.trim() };
    }
  }
  const empty = (d: Draft) => !d.prompt.trim() && !d.text.trim() && !d.answer.trim() && d.options.every((o) => !o.trim());

  let name = $state(existing?.name ?? "");
  let subject = $state(existing?.subject ?? "");
  let drafts = $state<Draft[]>(untrack(() => (existing ? existing.questions.map(toDraft) : [blank()])));
  let errors = $state<string[]>([]);
  let busy = $state(false);
  let nameInput: HTMLInputElement | undefined = $state();
  const TYPES: QuizQuestionType[] = ["mc", "cloze", "open", "tf"];

  $effect(() => {
    if (!existing) nameInput?.focus();
  });

  function addQuestion() {
    drafts.push(blank(drafts.at(-1)?.type ?? "mc"));
    const k = drafts.length;
    queueMicrotask(() => document.getElementById(`q${k}-first`)?.focus());
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    const problems: string[] = [];
    const n = name.trim();
    if (!n) problems.push(t("quiz.nameRequired"));
    const filled = drafts.filter((d) => !empty(d));
    if (!filled.length) problems.push(t("quiz.noQuestions"));
    const questions = filled.map(fromDraft);
    questions.forEach((q, i) => {
      const p = questionProblem(q);
      if (p) problems.push(t(`quiz.problem.${p}`, { n: drafts.indexOf(filled[i]!) + 1 }));
    });
    errors = problems;
    if (problems.length) return;
    busy = true;
    try {
      const saved = await app.saveQuiz({ ...(existing ? { id: existing.id } : {}), name: n.slice(0, LIMITS.deckNameChars), subject: subject.trim().slice(0, LIMITS.labelChars), questions });
      app.showFlash(t("quiz.saved"));
      location.hash = href.quiz(saved.id);
    } catch {
      errors = [t("common.saveFailed")];
    } finally {
      busy = false;
    }
  }
</script>

<PageHead title={existing ? t("quiz.edit") : t("quiz.new")} subtitle={existing?.name} back={{ href: existing ? href.quiz(existing.id) : href.quizzes(), label: t("common.back") }} />
<form class="qeditor" onsubmit={save} novalidate>
  <div class="card card-pad meta">
    <div class="field">
      <label for="quiz-name">{t("quiz.name")}</label>
      <input id="quiz-name" type="text" bind:value={name} bind:this={nameInput} maxlength={LIMITS.deckNameChars} placeholder={t("quiz.namePlaceholder")} autocomplete="off" />
    </div>
    <div class="field">
      <label for="quiz-subject">{t("editor.subject")}</label>
      <input id="quiz-subject" type="text" bind:value={subject} list="quiz-subjects" maxlength={LIMITS.labelChars} autocomplete="off" />
      <datalist id="quiz-subjects">
        {#each SUBJECTS[getLang()] as s (s)}<option value={s}></option>{/each}
      </datalist>
    </div>
  </div>

  <ol class="questions">
    {#each drafts as d, i (d.key)}
      {@const n = i + 1}
      <li class="card card-pad q">
        <div class="q-head">
          <h2>{t("quiz.question", { n })}</h2>
          <button type="button" class="icon-btn" aria-label={t("quiz.removeQuestion", { n })} onclick={() => drafts.splice(i, 1)}><Icon name="trash" size={20} /></button>
        </div>
        <fieldset class="fieldset-wrap">
          <legend class="visually-hidden">{t("quiz.typeLabel")} {n}</legend>
          <div class="segmented types">
            {#each TYPES as type (type)}
              <label><input type="radio" name="type-{d.key}" value={type} bind:group={d.type} />{t(`quiz.type.${type}`)}</label>
            {/each}
          </div>
        </fieldset>

        {#if d.type === "cloze"}
          <div class="field">
            <label for="q{n}-first">{t("quiz.clozeLabel")}</label>
            <textarea id="q{n}-first" rows="3" bind:value={d.text} maxlength={QUIZ_LIMITS.text} placeholder="De Februaristaking was in [1941] in [Amsterdam]."></textarea>
            <span class="small muted">{t("quiz.clozeHelp")} {#if blanksOf(d.text).length}<strong>{tp("quiz.clozeCount", blanksOf(d.text).length)}</strong>{/if}</span>
          </div>
        {:else}
          <div class="field">
            <label for="q{n}-first">{t("quiz.prompt")}</label>
            <textarea id="q{n}-first" rows="2" bind:value={d.prompt} maxlength={QUIZ_LIMITS.text}></textarea>
          </div>
        {/if}

        {#if d.type === "mc"}
          <fieldset class="fieldset-wrap">
            <legend>{t("quiz.modelAnswer")}</legend>
            <ul class="options">
              {#each d.options as _, o (o)}
                <li class="opt">
                  <label class="right" class:on={d.correct === o}>
                    <input type="radio" name="correct-{d.key}" value={o} bind:group={d.correct} />
                    <span class="visually-hidden">{t("quiz.markCorrect", { n: o + 1 })}</span>
                    <span class="circle" aria-hidden="true">{#if d.correct === o}<Icon name="check" size={16} />{/if}</span>
                  </label>
                  <input type="text" aria-label="{t('quiz.question', { n })}, {t('quiz.option', { n: o + 1 })}" placeholder={t("quiz.option", { n: o + 1 })} bind:value={d.options[o]} maxlength={QUIZ_LIMITS.text} autocomplete="off" />
                  {#if d.options.length > 2}
                    <button type="button" class="icon-btn" aria-label={t("quiz.removeOption", { n: o + 1 })} onclick={() => { d.options.splice(o, 1); if (d.correct >= d.options.length || d.correct === o) d.correct = 0; else if (d.correct > o) d.correct--; }}><Icon name="x" size={18} /></button>
                  {/if}
                </li>
              {/each}
            </ul>
            {#if d.options.length < QUIZ_LIMITS.options}
              <button type="button" class="btn btn-quiet add-opt" onclick={() => d.options.push("")}><Icon name="plus" size={18} />{t("quiz.addOption")}</button>
            {/if}
          </fieldset>
        {:else if d.type === "open"}
          <div class="field">
            <label for="q{n}-answer">{t("quiz.modelAnswer")}</label>
            <textarea id="q{n}-answer" rows="2" bind:value={d.answer} maxlength={QUIZ_LIMITS.text}></textarea>
          </div>
        {:else if d.type === "tf"}
          <fieldset class="fieldset-wrap">
            <legend>{t("quiz.modelAnswer")}</legend>
            <div class="segmented">
              <label><input type="radio" name="truth-{d.key}" value={true} bind:group={d.truth} />{t("quiz.true")}</label>
              <label><input type="radio" name="truth-{d.key}" value={false} bind:group={d.truth} />{t("quiz.false")}</label>
            </div>
          </fieldset>
        {/if}
      </li>
    {/each}
  </ol>

  {#if drafts.length < QUIZ_LIMITS.questions}
    <button type="button" class="btn add-q" onclick={addQuestion}><Icon name="plus" size={20} />{t("quiz.addQuestion")}</button>
  {/if}

  {#if errors.length}
    <ul class="errors" role="alert">
      {#each errors as err, i (i)}<li class="error">{err}</li>{/each}
    </ul>
  {/if}

  <div class="savebar row">
    <button type="submit" class="btn btn-primary btn-lg" disabled={busy}>{t("quiz.save")}</button>
    <a class="btn" href={existing ? href.quiz(existing.id) : href.quizzes()}>{t("common.cancel")}</a>
  </div>
</form>

<style>
  .qeditor {
    display: grid;
    gap: 1rem;
  }
  .meta,
  .q {
    display: grid;
    gap: 1rem;
  }
  .questions {
    display: grid;
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .q-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: -0.25rem -0.5rem -0.25rem 0;
  }
  .types label {
    padding-inline: 0.75rem;
  }
  .options {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .right {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--tap);
    height: var(--tap);
    flex: none;
    cursor: pointer;
  }
  .right input {
    position: absolute;
    inset: 0;
    opacity: 0;
  }
  .circle {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px var(--line-strong);
    color: var(--on-green);
  }
  .right.on .circle {
    background: var(--green);
    box-shadow: none;
  }
  .right:has(input:focus-visible) .circle {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .add-opt,
  .add-q {
    justify-self: start;
  }
  .errors {
    margin: 0;
    padding-left: 1.25rem;
    display: grid;
    gap: 0.25rem;
  }
  .savebar {
    position: sticky;
    bottom: 0;
    z-index: 5;
    padding: 0.75rem 0 calc(0.75rem + env(safe-area-inset-bottom));
    background: var(--bg);
  }
</style>
