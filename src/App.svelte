<script lang="ts">
  import { tick } from "svelte";
  import { APP_NAME } from "./config";
  import { t } from "./i18n/index.svelte";
  import type { StringKey } from "./i18n/types";
  import { app } from "./lib/app.svelte";
  import { applyUpdate, pwa } from "./lib/pwa.svelte";
  import { account } from "./lib/account.svelte";
  import Forms from "./routes/Forms.svelte";
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
  import OpenFile from "./routes/OpenFile.svelte";
  import Progress from "./routes/Progress.svelte";
  import Settings from "./routes/Settings.svelte";
  import ShareReceive from "./routes/ShareReceive.svelte";
  import Quizzes from "./routes/Quizzes.svelte";
  import QuizView from "./routes/QuizView.svelte";
  import QuizPlay from "./routes/QuizPlay.svelte";
  import Folders from "./routes/Folders.svelte";
  import Folder from "./routes/Folder.svelte";
  import NewFolder from "./routes/NewFolder.svelte";

  const nav: { key: StringKey; icon: IconName; href: string; match: string[] }[] = [
    { key: "nav.today", icon: "home", href: href.today(), match: ["today", "planner"] },
    { key: "nav.lists", icon: "lists", href: href.lists(), match: ["lists", "deck", "editor", "new", "import", "photo", "diagram", "file", "quizzes", "quiz", "quizEditor", "folders", "folder", "newFolder", "verbs"] },
    { key: "nav.progress", icon: "progress", href: href.progress(), match: ["progress"] },
    { key: "nav.settings", icon: "settings", href: href.settings(), match: ["settings", "help", "account", "inbox", "groups", "group"] },
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
    diagram: "diagram.title",
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
    account: "account.title",
    verbs: "verbs.title",
    planner: "planner.title",
    inbox: "inbox.title",
    groups: "groups.title",
    group: "groups.title",
  };

  let main: HTMLElement | undefined = $state();
  let first = true;

  // On every route change: update the title, scroll up and move focus to the page heading.
  $effect(() => {
    const route = app.route;
    const key = route.name === "quizEditor" && !route.id ? "quiz.new" : titles[route.name];
    document.title = key ? `${t(key)} · ${APP_NAME}` : APP_NAME;
    if (!app.ready) return;
    if (first) {
      first = false;
      return;
    }
    void tick().then(async () => {
      window.scrollTo(0, 0);
      // A screen that loads on demand needs a moment before its heading exists.
      let h = main?.querySelector<HTMLElement>("h1");
      for (let i = 0; !h && i < 20; i++) {
        await new Promise((r) => setTimeout(r, 25));
        h = main?.querySelector<HTMLElement>("h1");
      }
      if (h) {
        h.tabIndex = -1;
        h.focus({ preventScroll: true });
      }
    });
  });

  const focusMode = $derived(app.route.name === "practice" || app.route.name === "quizPlay");
  /** Making a list has its own save bar at the bottom, so the tab bar steps aside (as in StudyGo). */
  const hideNav = $derived(focusMode || app.route.name === "editor" || app.route.name === "quizEditor");
  // Read the action before clearing the message: clearing it also clears the action.
  function runFlashAction() {
    const action = app.flashAction;
    app.flash = "";
    app.flashAction = null;
    action?.run();
  }

  let newOpen = $state(false);
  let keysOpen = $state(false);

  /** Laptop shortcuts, outside practice: N new, / search, [ fold the sidebar, ? this list. */
  function onGlobalKey(e: KeyboardEvent) {
    // Not while practising or editing: a stray N must never take you away from a half-made list.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || hideNav || newOpen || keysOpen) return;
    const el = e.target as HTMLElement | null;
    if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
    if (document.querySelector("[role=dialog]")) return;
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      newOpen = true;
    } else if (e.key === "/") {
      e.preventDefault();
      if (app.route.name !== "lists") location.hash = href.lists();
      void tick().then(() => setTimeout(() => document.getElementById("list-search")?.focus(), 30));
    } else if (e.key === "[" && wide && !hideNav) {
      e.preventDefault();
      toggleSidebar();
    } else if (e.key === "?") {
      e.preventDefault();
      keysOpen = true;
    }
  }

  // Signed in: sync a few seconds after something changes here, and when the connection comes back.
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    void app.decks;
    void app.cards;
    void app.quizzes;
    if (!account.user) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => void app.syncAccount(), 4000);
    return () => clearTimeout(syncTimer);
  });
  $effect(() => {
    const online = () => void app.syncAccount();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  });
  // Phones: Vandaag, Lijsten, [Nieuw], Voortgang, Instellingen.
  const navStart = nav.slice(0, 2);
  const navEnd = nav.slice(2);
  // Laptops have room for a few shortcuts more in the sidebar.
  const extras = $derived([
    { key: "planner.title" as StringKey, icon: "calendar" as IconName, href: href.planner(), match: ["planner"] },
    { key: "quiz.title" as StringKey, icon: "quiz" as IconName, href: href.quizzes(), match: ["quizzes", "quiz", "quizEditor"] },
    ...(account.user ? [{ key: "groups.title" as StringKey, icon: "lists" as IconName, href: href.groups(), match: ["groups", "group"] }] : []),
  ]);
  let wide = $state(typeof matchMedia === "function" && matchMedia("(min-width: 720px)").matches);
  $effect(() => {
    const mq = matchMedia("(min-width: 720px)");
    const on = () => (wide = mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  });
  // The sidebar can be folded to icons; remembered on this device.
  const SIDEBAR_KEY = "klopt-sidebar";
  let collapsed = $state(readCollapsed());
  function readCollapsed(): boolean {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
    } catch {
      return false;
    }
  }
  function toggleSidebar() {
    collapsed = !collapsed;
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "open");
    } catch {
      // Private mode: it just isn't remembered.
    }
  }
  $effect(() => {
    document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "open";
  });

  /** On a laptop a shortcut in the sidebar is the current page instead of the item it belongs under. */
  function current(item: { match: string[] }, extra = false): boolean {
    if (!item.match.includes(app.route.name)) return false;
    return extra || !wide || !extras.some((x) => x.match.includes(app.route.name));
  }
</script>

<a class="skip" href="#main" onclick={(e) => { e.preventDefault(); main?.focus(); }}>{t("skip")}</a>

{#if !hideNav}
  <nav class="tabbar" class:collapsed id="sidebar" aria-label={t("nav.label")}>
    <a class="brand" href={href.today()} aria-label="{APP_NAME}, {t('nav.today')}"><Logo /></a>
    {#snippet tab(item: (typeof nav)[number])}
      <a class="tab" href={item.href} aria-current={current(item) ? "page" : undefined} title={collapsed && wide ? t(item.key) : undefined}>
        <Icon name={item.icon} size={22} />
        <span class="tab-label">{t(item.key)}</span>
      </a>
    {/snippet}
    {#each navStart as item (item.key)}{@render tab(item)}{/each}
    <button type="button" class="tab tab-new" aria-haspopup="dialog" title={collapsed && wide ? t("nav.new") : undefined} onclick={() => (newOpen = true)}>
      <span class="plus"><Icon name="plus" size={20} /></span>
      <span class="tab-label">{t("nav.new")}</span>
    </button>
    {#each navEnd as item (item.key)}{@render tab(item)}{/each}
    <div class="extras">
      {#each extras as item (item.key)}
        <a class="tab" href={item.href} aria-current={current(item, true) ? "page" : undefined} title={collapsed && wide ? t(item.key) : undefined}>
          <Icon name={item.icon} size={22} />
          <span class="tab-label">{t(item.key)}</span>
        </a>
      {/each}
    </div>
    <button type="button" class="tab fold" aria-expanded={!collapsed} aria-controls="sidebar" title={collapsed ? t("nav.expand") : undefined} onclick={toggleSidebar}>
      <Icon name="panel" size={22} />
      <span class="tab-label">{collapsed ? t("nav.expand") : t("nav.collapse")}</span>
    </button>
  </nav>
{/if}

<main id="main" class:wide={app.route.name === "today" && app.decks.length > 0} class:wrap={!focusMode} class:with-nav={!hideNav} class:focus-mode={focusMode} tabindex="-1" bind:this={main}>
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
        {:else if r.mode === "vervoegen"}
          <Forms scope={r.scope} which={r.which} count={r.count} />
        {:else}
          <Practice scope={r.scope} mode={r.mode} dir={r.dir} which={r.which} count={r.count} />
        {/if}
      {/key}
    {:else if app.route.name === "import"}
      {#key app.route.deckId}
        <Import deckId={app.route.deckId} />
      {/key}
    {:else if app.route.name === "diagram"}
      {#key app.route.deckId}{#await import("./routes/Diagram.svelte") then { default: Diagram }}<Diagram deckId={app.route.deckId} />{/await}{/key}
    {:else if app.route.name === "photo"}
      {#key app.route.deckId}
        {#await import("./routes/Photo.svelte") then { default: Photo }}<Photo deckId={app.route.deckId} />{/await}
      {/key}
    {:else if app.route.name === "file"}
      <OpenFile />
    {:else if app.route.name === "progress"}
      <Progress />
    {:else if app.route.name === "settings"}
      <Settings />
    {:else if app.route.name === "help"}
      {#await import("./routes/Help.svelte") then { default: Help }}<Help />{/await}
    {:else if app.route.name === "share"}
      {#key app.route.payload}
        <ShareReceive payload={app.route.payload} />
      {/key}
    {:else if app.route.name === "quizzes"}
      <Quizzes />
    {:else if app.route.name === "quiz"}
      {#key app.route.id}<QuizView id={app.route.id} share={app.route.share ?? false} />{/key}
    {:else if app.route.name === "quizEditor"}
      {#key app.route.id}{#await import("./routes/QuizEditor.svelte") then { default: QuizEditor }}<QuizEditor id={app.route.id} />{/await}{/key}
    {:else if app.route.name === "planner"}
      {#await import("./routes/Planner.svelte") then { default: Planner }}<Planner />{/await}
    {:else if app.route.name === "verbs"}
      {#await import("./routes/VerbSets.svelte") then { default: VerbSets }}<VerbSets />{/await}
    {:else if app.route.name === "account"}
      {#await import("./routes/Account.svelte") then { default: Account }}<Account />{/await}
    {:else if app.route.name === "inbox"}
      {#await import("./routes/Inbox.svelte") then { default: Inbox }}<Inbox />{/await}
    {:else if app.route.name === "groups"}
      {#await import("./routes/Groups.svelte") then { default: Groups }}<Groups />{/await}
    {:else if app.route.name === "group"}
      {#key app.route.id}{#await import("./routes/GroupPage.svelte") then { default: GroupPage }}<GroupPage id={app.route.id} />{/await}{/key}
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

<svelte:window onkeydown={onGlobalKey} />

{#if keysOpen}
  <Sheet title={t("shortcuts.title")} onclose={() => (keysOpen = false)}>
    <dl class="keys">
      {#each [["N", "keys.new"], ["/", "keys.search"], ["[", "keys.sidebar"], ["?", "keys.help"], ["Enter", "keys.check"], ["1–4", "keys.choose"], ["Spatie", "keys.flip"], ["Esc", "keys.close"]] as [k, label] (k)}
        <div class="key-row"><dt><kbd>{k === "Spatie" ? t("keys.space") : k}</kbd></dt><dd>{t(label as StringKey)}</dd></div>
      {/each}
    </dl>
  </Sheet>
{/if}

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
  <div class="toast" class:raised={!hideNav} class:with-action={!!app.flashAction}>
    <span>{app.flash}</span>
    {#if app.flashAction}
      <button type="button" class="toast-btn" onclick={runFlashAction}>{app.flashAction.label}</button>
    {/if}
  </div>
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

  .keys {
    display: grid;
    margin: 0;
    padding: 0.5rem 1.25rem 0.75rem;
  }
  .key-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-height: 2.75rem;
  }
  .key-row + .key-row {
    border-top: 1px solid var(--line);
  }
  .keys dt {
    width: 4.5rem;
    flex: none;
  }
  .keys dd {
    margin: 0;
  }
  kbd {
    display: inline-block;
    min-width: 2rem;
    padding: 0.125rem 0.5rem;
    border-radius: var(--r-xs);
    background: var(--surface-3);
    font: inherit;
    font-weight: 800;
    text-align: center;
    box-shadow: 0 2px 0 var(--line-strong);
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
  .brand,
  .extras,
  .tab.fold {
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
    :global(:root) {
      --side: 232px;
      --content: 712px;
    }
    :global(:root[data-sidebar="collapsed"]) {
      --side: 76px;
    }
    .tabbar {
      inset: 0 auto 0 0;
      width: var(--side);
      overflow-y: auto;
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
    .extras {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--line);
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
    .tab.fold {
      display: flex;
      margin-top: auto;
    }
    /* Folded: icons only, the names stay for screen readers and show as a tooltip. */
    .tabbar.collapsed .tab {
      justify-content: center;
      padding: 0;
    }
    .tabbar.collapsed .tab-label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .tabbar.collapsed .brand {
      justify-content: center;
      margin-inline: 0;
    }
    .tabbar.collapsed .brand :global(.name) {
      display: none;
    }
    .tabbar.collapsed .tab-new {
      width: var(--tap);
      align-self: center;
      padding: 0;
    }
    /* The page sits next to the sidebar, centred in the space that is left, never against it. */
    main.with-nav {
      margin-left: var(--side);
      container-type: inline-size;
      padding-top: 2rem;
      padding-bottom: 4rem;
    }
    main.with-nav:global(.wrap) {
      width: auto;
      max-width: none;
      padding-inline: max(28px, calc((100vw - var(--side) - var(--content)) / 2));
    }
    main.with-nav.wide {
      --content: 1072px;
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
  .toast.with-action {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-right: 0.5rem;
  }
  .toast-btn {
    min-height: var(--tap);
    padding: 0 0.875rem;
    border: 0;
    border-radius: var(--r-xs);
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 800;
    text-decoration: underline;
    text-underline-offset: 3px;
    white-space: nowrap;
    cursor: pointer;
  }
  .toast-btn:hover {
    background: color-mix(in srgb, var(--bg) 10%, transparent);
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
