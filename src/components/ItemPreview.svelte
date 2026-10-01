<script lang="ts">
  import { t, tp } from "../i18n/index.svelte";
  import type { SharedItem } from "../lib/backup";
  import { questionPreview } from "../lib/quiz";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";
  import Icon from "./Icon.svelte";
  import SharedPreview from "./SharedPreview.svelte";
  import SubjectBadge from "./SubjectBadge.svelte";

  /** What arrived through a link or file: a list, a quiz or a whole folder, with a button to add it. */
  let { item, oncancel, onadded }: { item: SharedItem; oncancel: () => void; onadded?: () => Promise<void> | void } = $props();
  let busy = $state(false);

  async function add() {
    busy = true;
    try {
      if (item.kind === "quiz") {
        const quiz = await app.importSharedQuiz(item.data.quiz);
        await onadded?.();
        app.showFlash(t("receive.added", { name: quiz.name }));
        location.replace(href.quiz(quiz.id));
      } else if (item.kind === "folder") {
        await app.importSharedFolder(item.data);
        await onadded?.();
        app.showFlash(t("receive.added", { name: item.data.name }));
        location.replace(href.folder(item.data.name));
      }
    } catch {
      app.showFlash(t("common.saveFailed"));
      busy = false;
    }
  }
</script>

{#if item.kind === "deck"}
  <SharedPreview shared={item.data} {oncancel} {onadded} />
{:else}
  <div class="preview">
    <div class="card card-pad head">
      {#if item.kind === "quiz"}
        {#if item.data.quiz.subject}<SubjectBadge subject={item.data.quiz.subject} size={40} />{:else}<Icon name="quiz" size={32} />{/if}
        <div>
          <h2>{item.data.quiz.name}</h2>
          <p class="small muted">{t("new.quiz")} · {tp("quiz.questionsCount", item.data.quiz.questions.length)}</p>
        </div>
      {:else}
        <span class="fic"><Icon name="folder" size={32} /></span>
        <div>
          <h2>{item.data.name}</h2>
          <p class="small muted">{[item.data.decks.length ? tp("common.decksCount", item.data.decks.length) : "", item.data.quizzes.length ? tp("folder.quizCount", item.data.quizzes.length) : ""].filter(Boolean).join(" · ")}</p>
        </div>
      {/if}
    </div>
    <ul class="rows">
      {#if item.kind === "quiz"}
        {#each item.data.quiz.questions.slice(0, 20) as q, i (i)}
          <li class="row-item"><span class="row-main"><span class="row-sub">{t(`quiz.type.${q.type}`)}</span><span class="row-title">{questionPreview(q)}</span></span></li>
        {/each}
      {:else}
        {#each item.data.decks as d, i (i)}
          <li class="row-item"><SubjectBadge subject={d.deck.subject} lang={d.deck.langFront} /><span class="row-main"><span class="row-title">{d.deck.name}</span><span class="row-sub">{tp("common.wordsCount", d.cards.length)}</span></span></li>
        {/each}
        {#each item.data.quizzes as q, i (i)}
          <li class="row-item"><Icon name="quiz" size={22} /><span class="row-main"><span class="row-title">{q.name}</span><span class="row-sub">{tp("quiz.questionsCount", q.questions.length)}</span></span></li>
        {/each}
      {/if}
    </ul>
    <div class="row">
      <button type="button" class="btn btn-primary btn-lg" disabled={busy} onclick={add}>{t("receive.addThis")}</button>
      <button type="button" class="btn btn-lg" onclick={oncancel}>{t("receive.skip")}</button>
    </div>
  </div>
{/if}

<style>
  .preview {
    display: grid;
    gap: 1rem;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .head h2 {
    overflow-wrap: anywhere;
  }
  .fic {
    color: var(--yellow);
  }
</style>
