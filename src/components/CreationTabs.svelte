<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";

  /** Switch between your lists and your quizzes, like StudyGo's "Creaties" filter. */
  let { current }: { current: "lists" | "quizzes" } = $props();
</script>

<nav class="tabs" aria-label={t("nav.creations")}>
  <a href={href.lists()} aria-current={current === "lists" ? "page" : undefined}>{t("nav.lists")} <span class="n">{app.decks.length}</span></a>
  <a href={href.quizzes()} aria-current={current === "quizzes" ? "page" : undefined}>{t("quiz.title")} <span class="n">{app.quizzes.length}</span></a>
</nav>

<style>
  .tabs {
    display: flex;
    gap: 1.5rem;
    border-bottom: 1px solid var(--line);
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: var(--tap);
    margin-bottom: -1px;
    border-bottom: 3px solid transparent;
    color: var(--ink-2);
    font-weight: 700;
    text-decoration: none;
  }
  a:hover {
    color: var(--ink);
  }
  a[aria-current="page"] {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }
  .n {
    color: var(--ink-2);
    font-weight: 500;
  }
</style>
