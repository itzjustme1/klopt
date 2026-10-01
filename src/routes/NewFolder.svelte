<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";

  /** A folder exists through what is in it, so you pick its lists and quizzes right away. */
  let name = $state("");
  let decks = $state<string[]>([]);
  let quizzes = $state<string[]>([]);
  let error = $state("");
  let input: HTMLInputElement | undefined = $state();
  $effect(() => input?.focus());

  async function create(e: SubmitEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return void (error = t("folder.nameRequired"));
    if (!decks.length && !quizzes.length) return void (error = t("folder.pickSomething"));
    try {
      await app.moveToFolder({ decks, quizzes }, n);
      location.hash = href.folder(n.slice(0, LIMITS.labelChars));
    } catch {
      error = t("common.saveFailed");
    }
  }
</script>

<PageHead title={t("folder.new")} back={{ href: href.folders(), label: t("folder.title") }} />
<form class="newf" onsubmit={create} novalidate>
  <div class="card card-pad field">
    <label for="nf-name">{t("folder.name")}</label>
    <input id="nf-name" type="text" bind:this={input} bind:value={name} maxlength={LIMITS.labelChars} placeholder={t("folder.namePlaceholder")} autocomplete="off" />
  </div>
  {#if app.decks.length}
    <fieldset class="fieldset-wrap">
      <legend>{t("folder.pickLists")}</legend>
      <ul class="rows">
        {#each app.decks as d (d.id)}
          <li><label class="row-item pickrow"><input type="checkbox" value={d.id} bind:group={decks} /><SubjectBadge subject={d.subject} lang={d.langFront} /><span class="row-main"><span class="row-title">{d.name}</span>{#if d.folder}<span class="row-sub"><Icon name="folder" size={14} /> {d.folder}</span>{/if}</span></label></li>
        {/each}
      </ul>
    </fieldset>
  {/if}
  {#if app.quizzes.length}
    <fieldset class="fieldset-wrap">
      <legend>{t("folder.pickQuizzes")}</legend>
      <ul class="rows">
        {#each app.quizzes as q (q.id)}
          <li><label class="row-item pickrow"><input type="checkbox" value={q.id} bind:group={quizzes} /><Icon name="quiz" size={22} /><span class="row-main"><span class="row-title">{q.name}</span></span></label></li>
        {/each}
      </ul>
    </fieldset>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="row">
    <button type="submit" class="btn btn-primary btn-lg">{t("folder.create")}</button>
    <a class="btn" href={href.folders()}>{t("common.cancel")}</a>
  </div>
</form>

<style>
  .newf {
    display: grid;
    gap: 1rem;
  }
  .pickrow {
    cursor: pointer;
  }
  .pickrow input {
    width: 20px;
    height: 20px;
    flex: none;
    accent-color: var(--green);
  }
  .pickrow:has(input:checked) {
    background: var(--accent-soft);
  }
</style>
