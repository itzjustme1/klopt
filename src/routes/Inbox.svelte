<script lang="ts">
  import { getLang, t } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import ItemPreview from "../components/ItemPreview.svelte";
  import PageHead from "../components/PageHead.svelte";
  import { account, type InboxItem } from "../lib/account.svelte";
  import { href } from "../lib/router";

  let items = $state.raw<InboxItem[] | null>(null);
  let open = $state.raw<InboxItem | null>(null);
  let error = $state("");

  async function load() {
    try {
      items = await account.inbox();
    } catch {
      error = t("account.offline");
      items = [];
    }
  }
  $effect(() => {
    if (account.user) void load();
  });

  async function dismiss(item: InboxItem) {
    await account.dismiss(item.id);
    items = (items ?? []).filter((i) => i.id !== item.id);
    open = null;
  }
  const fmt = $derived(new Intl.DateTimeFormat(getLang(), { day: "numeric", month: "short" }));
  const icon = (k: InboxItem["kind"]) => (k === "quiz" ? "quiz" : k === "folder" ? "folder" : "lists");
</script>

<PageHead title={t("inbox.title")} back={{ href: href.account(), label: t("account.title") }} />

<section class="inbox">
  {#if !account.user}
    <p class="muted">{t("inbox.signIn")}</p>
    <a class="btn btn-primary" href={href.account()}>{t("account.signIn")}</a>
  {:else if open?.item}
    <p class="small muted">{t("inbox.from", { name: open.from })}</p>
    <ItemPreview
      item={open.item}
      oncancel={() => {
        if (open) void dismiss(open);
      }}
      onadded={async () => {
        if (open) await account.dismiss(open.id);
      }}
    />
  {:else if items === null}
    <p class="muted" aria-busy="true">{t("common.loading")}</p>
  {:else if items.length === 0}
    <p class="muted">{error || t("inbox.empty")}</p>
  {:else}
    <ul class="rows">
      {#each items as item (item.id)}
        <li>
          <button type="button" class="row-item" disabled={!item.item} onclick={() => (open = item)}>
            <Icon name={icon(item.kind)} />
            <span class="row-main">
              <span class="row-title">{item.title}</span>
              <span class="row-sub">{item.item ? t("inbox.from", { name: item.from }) : t("inbox.broken")} · {fmt.format(new Date(item.created_at))}</span>
            </span>
            <Icon name="chevron" size={20} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .inbox {
    display: grid;
    gap: 0.75rem;
    max-width: 640px;
  }
</style>
