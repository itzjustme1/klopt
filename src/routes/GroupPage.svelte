<script lang="ts">
  import { getLang, num, t, tp } from "../i18n/index.svelte";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import Icon from "../components/Icon.svelte";
  import ItemPreview from "../components/ItemPreview.svelte";
  import PageHead from "../components/PageHead.svelte";
  import Sheet from "../components/Sheet.svelte";
  import { account, type Group, type GroupItem, type RankRow } from "../lib/account.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";
  import { folderShareJson, quizShareJson, shareJson } from "../lib/share";

  let { id }: { id: string } = $props();

  let data = $state.raw<{ group: Group; members: { id: string; name: string }[]; items: GroupItem[] } | null | undefined>(undefined);
  let open = $state.raw<GroupItem | null>(null);
  let adding = $state(false);
  let leaving = $state(false);
  let error = $state("");
  let copied = $state(false);

  let rank = $state.raw<RankRow[]>([]);
  let inRank = $state(false);
  let rankBusy = $state(false);

  async function load() {
    try {
      data = await account.group(id);
    } catch {
      error = t("account.offline");
      data = null;
    }
    void loadRanking();
  }
  $effect(() => {
    if (account.user) void load();
  });

  async function loadRanking() {
    try {
      inRank = await account.inRanking();
      if (inRank) await app.pushWeek(true);
      rank = await account.ranking(id, app.weekStats().week);
    } catch {
      rank = [];
    }
  }

  async function joinRanking(on: boolean) {
    rankBusy = true;
    try {
      if (on) await app.pushWeek(true);
      else await account.leaveRanking();
      await loadRanking();
    } catch {
      app.showFlash(t("account.failed"));
    } finally {
      rankBusy = false;
    }
  }

  const isOwner = $derived(!!data && data.group.owner === account.user?.id);
  const fmt = $derived(new Intl.DateTimeFormat(getLang(), { day: "numeric", month: "short" }));
  const icon = (k: GroupItem["kind"]) => (k === "quiz" ? "quiz" : k === "folder" ? "folder" : "lists");

  async function add(kind: GroupItem["kind"], key: string) {
    adding = false;
    try {
      if (kind === "deck") {
        const deck = app.deck(key)!;
        await account.addToGroup(id, "deck", deck.name, shareJson(deck, app.cardsIn(deck.id)));
      } else if (kind === "quiz") {
        const quiz = app.quiz(key)!;
        await account.addToGroup(id, "quiz", quiz.name, quizShareJson(quiz));
      } else {
        const f = app.folders().find((x) => x.name === key)!;
        await account.addToGroup(id, "folder", f.name, folderShareJson(f.name, f.decks, app.cards, f.quizzes));
      }
      app.showFlash(t("groups.added"));
      await load();
    } catch {
      app.showFlash(t("account.failed"));
    }
  }

  async function remove(item: GroupItem) {
    await account.removeFromGroup(item.id);
    await load();
  }

  async function leave() {
    try {
      if (isOwner) await account.deleteGroup(id);
      else await account.leaveGroup(id);
      location.hash = href.groups();
    } catch {
      error = t("account.failed");
    }
  }

  async function copyCode() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.group.code);
      copied = true;
    } catch {
      copied = false;
    }
  }
</script>

{#if data === undefined}
  <PageHead title={t("groups.title")} back={{ href: href.groups(), label: t("groups.title") }} />
  <p class="muted" aria-busy="true">{t("common.loading")}</p>
{:else if data === null}
  <PageHead title={t("groups.notFound")} back={{ href: href.groups(), label: t("groups.title") }} />
  {#if error}<p class="error">{error}</p>{/if}
{:else}
  <section class="group">
    <PageHead title={data.group.name} subtitle={t("groups.memberCount", { n: data.members.length })} back={{ href: href.groups(), label: t("groups.title") }} />

    {#if open?.item}
      <p class="small muted">{t("groups.addedBy", { name: open.by })}</p>
      <ItemPreview item={open.item} oncancel={() => (open = null)} />
    {:else}
      <div class="card card-pad code">
        <div>
          <p class="small muted">{t("groups.codeHelp")}</p>
          <p class="the-code num">{data.group.code}</p>
        </div>
        <button type="button" class="btn" onclick={copyCode}>{copied ? t("share.copied") : t("groups.copyCode")}</button>
      </div>

      <h2 class="section-title">{t("rank.title")}</h2>
      {#if rank.length}
        <ol class="rows rank">
          {#each rank as r, i (r.id)}
            <li class="row-item" class:me={r.me}>
              <span class="pos num" class:top={i === 0 && r.answers > 0}>{i + 1}</span>
              <span class="row-main">
                <span class="row-title">{r.name}{#if r.me}<span class="you">{` · ${t("rank.you")}`}</span>{/if}</span>
                <span class="row-sub">{tp("rank.days", r.days)} · {t("rank.pct", { p: r.answers ? Math.round((r.correct / r.answers) * 100) : 0 })}</span>
              </span>
              <span class="score"><span class="num">{num(r.answers)}</span><span class="caption muted">{` ${tp("rank.answers", r.answers)}`}</span></span>
            </li>
          {/each}
        </ol>
      {/if}
      {#if !inRank}
        <div class="card card-pad join">
          <p class="small">{t("rank.joinHelp")}</p>
          <button type="button" class="btn btn-primary" disabled={rankBusy} onclick={() => joinRanking(true)}>{t("rank.join")}</button>
        </div>
      {:else}
        <p class="small muted">{t("rank.help")} <button type="button" class="link-btn" disabled={rankBusy} onclick={() => joinRanking(false)}>{t("rank.leave")}</button></p>
      {/if}

      <div class="sect-head">
        <h2>{t("groups.items")}</h2>
        <button type="button" class="btn btn-primary" onclick={() => (adding = true)}><Icon name="plus" size={18} />{t("groups.add")}</button>
      </div>
      {#if data.items.length}
        <ul class="rows">
          {#each data.items as item (item.id)}
            <li class="gi">
              <button type="button" class="row-item" disabled={!item.item} onclick={() => (open = item)}>
                <Icon name={icon(item.kind)} />
                <span class="row-main"><span class="row-title">{item.title}</span><span class="row-sub">{item.by} · {fmt.format(new Date(item.created_at))}</span></span>
              </button>
              {#if item.added_by === account.user?.id || isOwner}
                <button type="button" class="icon-btn" aria-label={t("groups.removeItem", { name: item.title })} onclick={() => remove(item)}><Icon name="x" size={18} /></button>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">{t("groups.noItems")}</p>
      {/if}

      <h2 class="section-title">{t("groups.members")}</h2>
      <ul class="rows">
        {#each data.members as m (m.id)}
          <li class="row-item"><span class="row-main"><span class="row-title">{m.name}</span>{#if m.id === data.group.owner}<span class="row-sub">{t("groups.owner")}</span>{/if}</span></li>
        {/each}
      </ul>

      {#if leaving}
        <ConfirmInline message={isOwner ? t("groups.deleteConfirm") : t("groups.leaveConfirm")} confirmLabel={isOwner ? t("groups.delete") : t("groups.leave")} onconfirm={leave} oncancel={() => (leaving = false)} />
      {:else}
        <button type="button" class="btn btn-quiet danger" onclick={() => (leaving = true)}>{isOwner ? t("groups.delete") : t("groups.leave")}</button>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    {/if}
  </section>

  {#if adding}
    <Sheet title={t("groups.add")} onclose={() => (adding = false)}>
      <ul class="drawer-list">
        {#each app.decks as d (d.id)}
          <li><button type="button" class="drawer-item" onclick={() => add("deck", d.id)}><Icon name="lists" />{d.name}</button></li>
        {/each}
        {#each app.quizzes as q (q.id)}
          <li><button type="button" class="drawer-item" onclick={() => add("quiz", q.id)}><Icon name="quiz" />{q.name}</button></li>
        {/each}
        {#each app.folders() as f (f.name)}
          <li><button type="button" class="drawer-item" onclick={() => add("folder", f.name)}><Icon name="folder" />{f.name}</button></li>
        {/each}
      </ul>
    </Sheet>
  {/if}
{/if}

<style>
  .group {
    display: grid;
    gap: 0.75rem;
  }
  .code {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .the-code {
    font-size: var(--fs-title);
    font-weight: 900;
    letter-spacing: 0.12em;
  }
  .gi {
    display: flex;
    align-items: center;
    padding-right: 0.5rem;
  }
  .gi .row-item {
    flex: 1;
    min-width: 0;
  }
  .rank .me {
    background: var(--surface-2);
  }
  .pos {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex: none;
    border-radius: 50%;
    background: var(--surface-3);
    font-weight: 900;
  }
  .pos.top {
    background: var(--yellow);
    color: #2b2100;
  }
  .you {
    color: var(--accent);
  }
  .score {
    display: grid;
    justify-items: end;
    font-weight: 900;
    font-size: var(--fs-section);
    line-height: 1.1;
  }
  .join {
    display: grid;
    gap: 0.75rem;
    justify-items: start;
  }
  .link-btn {
    min-height: var(--tap);
    padding: 0 0.25rem;
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    cursor: pointer;
  }
  .danger {
    justify-self: start;
    color: var(--bad);
  }
</style>
