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

  const nav: { key: StringKey; icon: IconName; href: string; match: string[] }[] = [
    { key: "nav.today", icon: "home", href: href.today(), match: ["today"] },
    { key: "nav.lists", icon: "lists", href: href.lists(), match: ["lists", "deck", "editor", "new", "import", "photo", "file"] },
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

  const focusMode = $derived(app.route.name === "practice");
</script>

<a class="skip" href="#main" onclick={(e) => { e.preventDefault(); main?.focus(); }}>{t("skip")}</a>

{#if !focusMode}
  <header class="top">
    <div class="wrap top-inner">
      <a class="brand" href={href.today()} aria-label="{APP_NAME}, {t('nav.today')}"><Logo onBand /></a>
      <nav class="nav" aria-label={t("nav.label")}>
        {#each nav as item (item.key)}
          <a href={item.href} aria-current={item.match.includes(app.route.name) ? "page" : undefined}>
            <Icon name={item.icon} size={22} />
            <span>{t(item.key)}</span>
          </a>
        {/each}
      </nav>
    </div>
  </header>
{/if}

<main id="main" class:wrap={!focusMode} class:with-tabbar={!focusMode} class:focus-mode={focusMode} tabindex="-1" bind:this={main}>
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
      {#key app.route.id}
        <Editor id={app.route.id} />
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
    {:else}
      <Today />
    {/if}
  {/if}
</main>

{#if pwa.needRefresh && !focusMode}
  <div class="update card" role="status">
    <p>{t("pwa.update")}</p>
    <button type="button" class="btn btn-primary" onclick={applyUpdate}>{t("pwa.reload")}</button>
  </div>
{/if}

<p class="visually-hidden" aria-live="polite">{app.flash}</p>
{#if app.flash}
  <div class="toast" class:raised={!focusMode} role="presentation">{app.flash}</div>
{/if}

<style>
  :global(.wrap) {
    width: 100%;
    max-width: 1040px;
    margin-inline: auto;
    padding-inline: max(var(--gutter), env(safe-area-inset-left)) max(var(--gutter), env(safe-area-inset-right));
  }

  .skip {
    position: absolute;
    left: 0.5rem;
    top: -4rem;
    z-index: 50;
    padding: 0.75rem 1rem;
    background: var(--accent);
    color: var(--on-accent);
    border-radius: var(--r-sm);
    font-weight: 700;
  }
  .skip:focus {
    top: 0.5rem;
  }

  .top {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--band);
    color: var(--on-band);
    padding-top: env(safe-area-inset-top);
  }
  .top-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 64px;
    gap: 1rem;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap);
    text-decoration: none;
    border-radius: var(--r-sm);
  }
  .brand:focus-visible,
  .nav a:focus-visible {
    outline-color: #ffffff;
  }

  .nav {
    display: flex;
    gap: 0.25rem;
  }
  .nav a {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: var(--tap);
    padding: 0 1rem;
    border-radius: var(--r-pill);
    color: #ffffff;
    text-decoration: none;
    font-weight: 700;
    transition: background-color var(--t-base) var(--ease), color var(--t-base) var(--ease);
  }
  .nav a:hover {
    background: rgb(255 255 255 / 0.14);
    color: #ffffff;
  }
  .nav a[aria-current="page"] {
    background: #ffffff;
    color: var(--on-light-accent);
  }

  main {
    padding-top: 1.75rem;
    padding-bottom: 4rem;
    outline: none;
  }
  main.focus-mode {
    padding: 0;
  }

  /* Phones: the nav becomes a white bottom tab bar. */
  @media (max-width: 719px) {
    .top-inner {
      min-height: 56px;
    }
    .nav {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 20;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0;
      background: var(--surface);
      border-top: 1px solid var(--line);
      padding: 0.25rem 0.25rem env(safe-area-inset-bottom);
    }
    .nav a {
      flex-direction: column;
      justify-content: center;
      gap: 0.125rem;
      min-height: 3.5rem;
      padding: 0.25rem;
      font-size: var(--fs-caption);
      border-radius: var(--r-sm);
      color: var(--ink-2);
    }
    .nav a:hover {
      background: var(--surface-2);
      color: var(--ink);
    }
    .nav a[aria-current="page"] {
      background: transparent;
      color: var(--accent-text);
    }
    .nav a[aria-current="page"] :global(.icon) {
      color: var(--accent);
    }
    .nav a:focus-visible {
      outline-color: var(--accent);
    }
    main.with-tabbar {
      padding-bottom: calc(6rem + env(safe-area-inset-bottom));
    }
  }

  /* A new version is ready: a card above the tab bar, out of the way of the page. */
  .update {
    position: fixed;
    left: 50%;
    bottom: calc(1.5rem + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.75rem 1rem;
    flex-wrap: wrap;
    width: min(32rem, calc(100vw - 2rem));
    padding: 0.75rem 0.75rem 0.75rem 1.25rem;
    font-weight: 700;
  }
  .update p {
    flex: 1;
    min-width: 10rem;
  }
  @media (max-width: 719px) {
    .update {
      bottom: calc(5.5rem + env(safe-area-inset-bottom));
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
    box-shadow: var(--shadow-card);
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
