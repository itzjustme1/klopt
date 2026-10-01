<script lang="ts">
  import { tick } from "svelte";
  import { APP_NAME } from "./config";
  import { t } from "./i18n/index.svelte";
  import type { StringKey } from "./i18n/types";
  import { app } from "./lib/app.svelte";
  import { applyUpdate, pwa } from "./lib/pwa.svelte";
  import { href } from "./lib/router";
  import Icon, { type IconName } from "./components/Icon.svelte";
  import Logo from "./components/Logo.svelte";
  import NewMenu from "./components/NewMenu.svelte";
  import Sheet from "./components/Sheet.svelte";
  import Today from "./routes/Today.svelte";
  import Lists from "./routes/Lists.svelte";
  import NewList from "./routes/NewList.svelte";
  import DeckView from "./routes/Deck.svelte";
  import Editor from "./routes/Editor.svelte";
  import Practice from "./routes/Practice.svelte";
  import Match from "./routes/Match.svelte";
  import Import from "./routes/Import.svelte";
  import Photo from "./routes/Photo.svelte";
  import OpenFile from "./routes/OpenFile.svelte";
  import Progress from "./routes/Progress.svelte";
  import Settings from "./routes/Settings.svelte";
  import Help from "./routes/Help.svelte";
  import ShareReceive from "./routes/ShareReceive.svelte";
  import Quizzes from "./routes/Quizzes.svelte";
  import QuizView from "./routes/QuizView.svelte";
  import QuizEditor from "./routes/QuizEditor.svelte";
  import QuizPlay from "./routes/QuizPlay.svelte";
  import Folders from "./routes/Folders.svelte";
  import Folder from "./routes/Folder.svelte";
  import NewFolder from "./routes/NewFolder.svelte";

  const nav: { key: StringKey; icon: IconName; href: string; match: string[] }[] = [
    { key: "nav.today", icon: "home", href: href.today(), match: ["today"] },
    { key: "nav.lists", icon: "lists", href: href.lists(), match: ["lists", "deck", "editor", "new", "import", "photo", "file", "quizzes", "quiz", "quizEditor", "folders", "folder", "newFolder"] },
    { key: "nav.progress", icon: "progress", href: href.progress(), match: ["progress"] },
    { key: "nav.settings", icon: "settings", href: href.settings(), match: ["settings", "help"] },
  ];

  const titles: Record<string, StringKey> = {
    today: "nav.today",
    lists: "nav.lists",
    new: "new.title",
    editor: "editor.editTitle",
    deck: "nav.lists",
    practice: "deck.practice",
    import: "import.title",
    photo: "photo.title",
    file: "new.file",
    progress: "nav.progress",
    settings: "nav.settings",
    help: "help.title",
    share: "receive.title",
    quizzes: "quiz.title",
    quiz: "quiz.title",
    quizEditor: "quiz.edit",
    quizPlay: "quiz.title",
    folders: "folder.title",
    folder: "folder.title",
    newFolder: "folder.new",
  };

  let main: HTMLElement | undefined = $state();
  let first = true;

  // On every route change: update the title, scroll up and move focus to the page heading.
  $effect(() => {
    const route = app.route;
    const key = titles[route.name];
    document.title = key ? `${t(key)} · ${APP_NAME}` : APP_NAME;
    if (!app.ready) return;
    if (first) {
      first = false;
      return;
    }
    void tick().then(() => {
      window.scrollTo(0, 0);
      const h = main?.querySelector<HTMLElement>("h1");
      if (h) {
        h.tabIndex = -1;
        h.focus({ preventScroll: true });
      }
    });
  });

  const focusMode = $derived(app.route.name === "practice" || app.route.name === "quizPlay");
  /** Making a list has its own save bar at the bottom, so the tab bar steps aside (as in StudyGo). */
  const hideNav = $derived(focusMode || app.route.name === "editor" || app.route.name === "quizEditor");
  let newOpen = $state(false);
  // Phones: Vandaag, Lijsten, [Nieuw], Voortgang, Instellingen.
  const navStart = nav.slice(0, 2);
  const navEnd = nav.slice(2);
</script>

<a class="skip" href="#main" onclick={(e) => { e.preventDefault(); main?.focus(); }}>{t("skip")}</a>

{#if !hideNav}
  <nav class="tabbar" aria-label={t("nav.label")}>
    <a class="brand" href={href.today()} aria-label="{APP_NAME}, {t('nav.today')}"><Logo /></a>
    {#snippet tab(item: (typeof nav)[number])}
      <a class="tab" href={item.href} aria-current={item.match.includes(app.route.name) ? "page" : undefined}>
        <Icon name={item.icon} size={22} />
        <span>{t(item.key)}</span>
      </a>
    {/snippet}
    {#each navStart as item (item.key)}{@render tab(item)}{/each}
    <button type="button" class="tab tab-new" aria-haspopup="dialog" onclick={() => (newOpen = true)}>
      <span class="plus"><Icon name="plus" size={20} /></span>
      <span>{t("nav.new")}</span>
    </button>
    {#each navEnd as item (item.key)}{@render tab(item)}{/each}
  </nav>
{/if}

<main id="main" class:wrap={!focusMode} class:with-nav={!hideNav} class:focus-mode={focusMode} tabindex="-1" bind:this={main}>
  {#if app.failed}
    <div class="card card-pad">
      <p class="error">{t("common.saveFailed")}</p>
    </div>
  {:else if !app.ready}
    <p class="muted" aria-busy="true">{t("common.loading")}</p>
  {:else}
    {#if app.route.name === "today"}
      <Today />
    {:else if app.route.name === "lists"}
      {#key app.route.subject}
        <Lists subject={app.route.subject} />
      {/key}
    {:else if app.route.name === "new"}
      <NewList />
    {:else if app.route.name === "editor"}
      {#key `${app.route.id}/${app.route.terms}`}
        <Editor id={app.route.id} terms={app.route.terms ?? false} />
      {/key}
    {:else if app.route.name === "deck"}
      {#key app.route.id}
        <DeckView id={app.route.id} share={app.route.share ?? false} />
      {/key}
    {:else if app.route.name === "practice"}
      {@const r = app.route}
      {#key `${r.scope}/${r.mode}/${r.dir}/${r.which}/${r.count}`}
        {#if r.mode === "koppelen"}
          <Match scope={r.scope} which={r.which} count={r.count} />
        {:else}
          <Practice scope={r.scope} mode={r.mode} dir={r.dir} which={r.which} count={r.count} />
        {/if}
      {/key}
    {:else if app.route.name === "import"}
      {#key app.route.deckId}
        <Import deckId={app.route.deckId} />
      {/key}
    {:else if app.route.name === "photo"}
      {#key app.route.deckId}
        <Photo deckId={app.route.deckId} />
      {/key}
    {:else if app.route.name === "file"}
      <OpenFile />
    {:else if app.route.name === "progress"}
      <Progress />
    {:else if app.route.name === "settings"}
      <Settings />
    {:else if app.route.name === "help"}
      <Help />
    {:else if app.route.name === "share"}
      {#key app.route.payload}
        <ShareReceive payload={app.route.payload} />
      {/key}
    {:else if app.route.name === "quizzes"}
      <Quizzes />
    {:else if app.route.name === "quiz"}
      {#key app.route.id}<QuizView id={app.route.id} />{/key}
    {:else if app.route.name === "quizEditor"}
      {#key app.route.id}<QuizEditor id={app.route.id} />{/key}
    {:else if app.route.name === "folders"}
      <Folders />
    {:else if app.route.name === "folder"}
      {#key app.route.folder}<Folder name={app.route.folder} />{/key}
    {:else if app.route.name === "newFolder"}
      <NewFolder />
    {:else if app.route.name === "quizPlay"}
      {#key app.route.id}<QuizPlay id={app.route.id} />{/key}
    {:else}
      <Today />
    {/if}
  {/if}
</main>

{#if newOpen}
  <Sheet title={t("new.title")} onclose={() => (newOpen = false)}>
    <NewMenu onpick={() => (newOpen = false)} />
  </Sheet>
{/if}

{#if pwa.needRefresh && !focusMode}
  <div class="update card" role="status">
    <p>{t("pwa.update")}</p>
    <button type="button" class="btn btn-primary" onclick={applyUpdate}>{t("pwa.reload")}</button>
  </div>
{/if}

<p class="visually-hidden" aria-live="polite">{app.flash}</p>
{#if app.flash}
  <div class="toast" class:raised={!hideNav} role="presentation">{app.flash}</div>
{/if}

<style>
  :global(.wrap) {
    width: 100%;
    max-width: 760px;
    margin-inline: auto;
    padding-inline: max(var(--gutter), env(safe-area-inset-left)) max(var(--gutter), env(safe-area-inset-right));
  }

  .skip {
    position: absolute;
    left: 0.5rem;
    top: -4rem;
    z-index: 50;
    padding: 0.75rem 1rem;
    background: var(--green);
    color: var(--on-green);
    border-radius: var(--r-sm);
    font-weight: 700;
  }
  .skip:focus {
    top: 0.5rem;
  }

  /* Phones: a tab bar at the bottom. */
  .tabbar {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 20;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    padding: 0.25rem 0.25rem env(safe-area-inset-bottom);
    background: var(--surface);
    border-top: 1px solid var(--line);
  }
  .brand {
    display: none;
  }
  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    min-height: 3.5rem;
    padding: 0.25rem;
    border: 0;
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--ink-2);
    font: inherit;
    font-size: var(--fs-nav);
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition: color var(--t-base) var(--ease), background-color var(--t-base) var(--ease);
  }
  .tab:hover {
    color: var(--ink);
  }
  .tab[aria-current="page"] {
    color: var(--ink);
  }
  .tab[aria-current="page"] :global(.icon) {
    color: var(--accent);
  }
  .plus {
    display: grid;
    place-items: center;
    width: 28px;
    height: 24px;
    border-radius: var(--r-xs);
    background: var(--green);
    color: var(--on-green);
  }

  main {
    padding-top: calc(0.75rem + env(safe-area-inset-top));
    padding-bottom: 3rem;
    outline: none;
  }
  main.with-nav {
    padding-bottom: calc(6rem + env(safe-area-inset-bottom));
  }
  main.focus-mode {
    padding: 0;
  }

  /* Laptops: the same items in a sidebar on the left. */
  @media (min-width: 720px) {
    .tabbar {
      inset: 0 auto 0 0;
      width: 232px;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1.25rem 0.75rem;
      border-top: 0;
      border-right: 1px solid var(--line);
    }
    .brand {
      order: -2;
      display: flex;
      align-items: center;
      min-height: var(--tap);
      margin: 0 0.5rem 1rem;
      text-decoration: none;
      border-radius: var(--r-sm);
    }
    .tab {
      flex-direction: row;
      justify-content: flex-start;
      gap: 0.75rem;
      min-height: var(--tap);
      padding: 0 0.75rem;
      font-size: var(--fs-body);
    }
    .tab[aria-current="page"] {
      background: var(--surface-2);
    }
    .tab-new {
      order: -1;
      margin-bottom: 0.75rem;
      background: var(--green);
      color: var(--on-green);
      border-radius: var(--r-pill);
      box-shadow: 0 var(--edge) 0 var(--green-edge);
    }
    .tab-new:hover {
      color: var(--on-green);
      background: var(--green-hover);
    }
    .tab-new .plus {
      width: auto;
      background: none;
    }
    main.with-nav {
      padding-left: 232px;
      padding-top: 2rem;
      padding-bottom: 4rem;
    }
    main.with-nav:global(.wrap) {
      max-width: calc(760px + 232px);
    }
  }

  /* A new version is ready: a card above the tab bar, out of the way of the page. */
  .update {
    position: fixed;
    left: 50%;
    bottom: calc(5.5rem + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.75rem 1rem;
    flex-wrap: wrap;
    width: min(32rem, calc(100vw - 2rem));
    padding: 0.75rem 0.75rem 0.75rem 1.25rem;
    font-weight: 700;
    background: var(--surface-2);
  }
  .update p {
    flex: 1;
    min-width: 10rem;
  }
  @media (min-width: 720px) {
    .update {
      bottom: 1.5rem;
    }
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(1.5rem + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 60;
    max-width: calc(100vw - 2rem);
    padding: 0.75rem 1.25rem;
    background: var(--ink);
    color: var(--bg);
    border-radius: var(--r-sm);
    font-weight: 700;
    animation: toast-in var(--t-base) var(--ease);
  }
  @media (max-width: 719px) {
    .toast.raised {
      bottom: calc(5.5rem + env(safe-area-inset-bottom));
    }
  }
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
  }
</style>
