<script lang="ts">
  import { tick } from "svelte";
  import { APP_NAME } from "./config";
  import { t } from "./i18n/index.svelte";
  import type { StringKey } from "./i18n/types";
  import { app } from "./lib/app.svelte";
  import { href } from "./lib/router";
  import Banners from "./components/Banners.svelte";
  import Today from "./routes/Today.svelte";
  import Review from "./routes/Review.svelte";
  import Decks from "./routes/Decks.svelte";
  import DeckView from "./routes/Deck.svelte";
  import Import from "./routes/Import.svelte";
  import Settings from "./routes/Settings.svelte";
  import ShareReceive from "./routes/ShareReceive.svelte";

  const nav: { key: StringKey; href: string; match: string[] }[] = [
    { key: "nav.today", href: href.today(), match: ["today", "review"] },
    { key: "nav.decks", href: href.decks(), match: ["decks", "deck"] },
    { key: "nav.import", href: href.import(), match: ["import"] },
    { key: "nav.settings", href: href.settings(), match: ["settings"] },
  ];

  const titles: Record<string, StringKey> = {
    today: "nav.today",
    review: "review.title",
    decks: "nav.decks",
    deck: "nav.decks",
    import: "nav.import",
    settings: "nav.settings",
    share: "receive.title",
  };

  let main: HTMLElement | undefined = $state();
  let first = true;

  // On every route change: update the title, scroll up and move focus to the page heading.
  $effect(() => {
    const name = app.route.name;
    const key = titles[name];
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

  const focusMode = $derived(app.route.name === "review");
</script>

<a class="skip" href="#main" onclick={(e) => { e.preventDefault(); main?.focus(); }}>{t("skip")}</a>

<header class="top" class:focus-mode={focusMode}>
  <div class="wrap top-inner">
    <a class="brand" href={href.today()}>{APP_NAME}</a>
    {#if !focusMode}
      <nav class="nav" aria-label={t("nav.label")}>
        {#each nav as item (item.key)}
          <a href={item.href} aria-current={item.match.includes(app.route.name) ? "page" : undefined}>{t(item.key)}</a>
        {/each}
      </nav>
    {/if}
  </div>
</header>

<main id="main" class="wrap" class:with-tabbar={!focusMode} tabindex="-1" bind:this={main}>
  {#if app.failed}
    <div class="panel">
      <p class="error">{t("common.saveFailed")}</p>
    </div>
  {:else if !app.ready}
    <p class="muted" aria-busy="true">{t("common.loading")}</p>
  {:else}
    <Banners />
    {#if app.route.name === "today"}
      <Today />
    {:else if app.route.name === "review"}
      {#key app.route.deckId}
        <Review deckId={app.route.deckId} />
      {/key}
    {:else if app.route.name === "decks"}
      <Decks create={app.route.create ?? false} />
    {:else if app.route.name === "deck"}
      {#key app.route.id}
        <DeckView id={app.route.id} share={app.route.share ?? false} />
      {/key}
    {:else if app.route.name === "import"}
      {#key app.route.deckId}
        <Import deckId={app.route.deckId} />
      {/key}
    {:else if app.route.name === "settings"}
      <Settings />
    {:else if app.route.name === "share"}
      {#key app.route.payload}
        <ShareReceive payload={app.route.payload} />
      {/key}
    {:else}
      <Today />
    {/if}
  {/if}
</main>

<p class="visually-hidden" aria-live="polite">{app.flash}</p>
{#if app.flash}
  <div class="toast" role="presentation">{app.flash}</div>
{/if}

<style>
  :global(.wrap) {
    width: 100%;
    max-width: 44rem;
    margin-inline: auto;
    padding-inline: max(var(--gutter), env(safe-area-inset-left)) max(var(--gutter), env(safe-area-inset-right));
  }

  .skip {
    position: absolute;
    left: 0.5rem;
    top: -4rem;
    z-index: 20;
    padding: 0.75rem 1rem;
    background: var(--ink);
    color: var(--surface);
    border-radius: var(--radius);
  }
  .skip:focus {
    top: 0.5rem;
  }

  .top {
    border-bottom: 1px solid var(--line);
    background: var(--bg);
    padding-top: env(safe-area-inset-top);
  }
  .top-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 3.5rem;
    gap: 1rem;
  }
  .brand {
    font-weight: 700;
    font-size: 1.25rem;
    letter-spacing: -0.02em;
    text-decoration: none;
    min-height: var(--tap);
    display: inline-flex;
    align-items: center;
  }

  .nav {
    display: flex;
    gap: 0.25rem;
  }
  .nav a {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap);
    padding: 0 0.75rem;
    color: var(--ink-2);
    text-decoration: none;
    font-weight: 600;
    border-bottom: 2px solid transparent;
  }
  .nav a:hover {
    color: var(--ink);
  }
  .nav a[aria-current="page"] {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }

  main {
    padding-top: 1.5rem;
    padding-bottom: 3rem;
    outline: none;
  }

  /* Phones: the nav becomes a bottom tab bar. */
  @media (max-width: 639px) {
    .nav {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 10;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0;
      background: var(--surface);
      border-top: 1px solid var(--line);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .nav a {
      justify-content: center;
      min-height: 3.25rem;
      padding: 0 0.25rem;
      font-size: 0.8125rem;
      border-bottom: 0;
      border-top: 2px solid transparent;
    }
    .nav a[aria-current="page"] {
      border-top-color: var(--ink);
    }
    main.with-tabbar {
      padding-bottom: calc(5rem + env(safe-area-inset-bottom));
    }
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(4.5rem + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 30;
    max-width: calc(100vw - 2rem);
    padding: 0.75rem 1rem;
    background: var(--ink);
    color: var(--surface);
    border-radius: var(--radius);
    font-weight: 600;
    animation: toast-in 180ms var(--ease);
  }
  @media (min-width: 640px) {
    .toast {
      bottom: 1.5rem;
    }
  }
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translate(-50%, 6px);
    }
  }
</style>
