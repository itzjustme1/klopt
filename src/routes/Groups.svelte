<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import { account, type Group } from "../lib/account.svelte";
  import { href } from "../lib/router";

  let groups = $state.raw<Group[] | null>(null);
  let name = $state("");
  let code = $state("");
  let error = $state("");
  let busy = $state(false);

  $effect(() => {
    if (account.user) void account.groups().then((g) => (groups = g)).catch(() => ((groups = []), (error = t("account.offline"))));
  });

  async function create(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    busy = true;
    try {
      const g = await account.createGroup(name);
      location.hash = href.group(g.id);
    } catch {
      error = t("account.failed");
    } finally {
      busy = false;
    }
  }
  async function join(e: SubmitEvent) {
    e.preventDefault();
    error = "";
    busy = true;
    try {
      const g = await account.joinGroup(code);
      if (g) location.hash = href.group(g.id);
      else error = t("groups.badCode");
    } catch {
      error = t("account.failed");
    } finally {
      busy = false;
    }
  }
</script>

<PageHead title={t("groups.title")} back={{ href: href.account(), label: t("account.title") }} />

<section class="groups">
  {#if !account.user}
    <p class="muted">{t("groups.signIn")}</p>
    <a class="btn btn-primary" href={href.account()}>{t("account.signIn")}</a>
  {:else}
    {#if groups === null}
      <p class="muted" aria-busy="true">{t("common.loading")}</p>
    {:else if groups.length}
      <ul class="rows">
        {#each groups as g (g.id)}
          <li><a class="row-item" href={href.group(g.id)}><Icon name="lists" /><span class="row-main"><span class="row-title">{g.name}</span><span class="row-sub">{t("groups.code", { code: g.code })}</span></span><Icon name="chevron" size={20} /></a></li>
        {/each}
      </ul>
    {:else}
      <p class="muted">{t("groups.none")}</p>
    {/if}

    <form class="card card-pad stack" style:--gap="0.75rem" onsubmit={join}>
      <div class="field">
        <label for="g-code">{t("groups.joinLabel")}</label>
        <input id="g-code" type="text" bind:value={code} maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABC123" />
      </div>
      <button type="submit" class="btn btn-primary" disabled={busy || code.trim().length !== 6}>{t("groups.join")}</button>
    </form>
    <form class="card card-pad stack" style:--gap="0.75rem" onsubmit={create}>
      <div class="field">
        <label for="g-name">{t("groups.newLabel")}</label>
        <input id="g-name" type="text" bind:value={name} maxlength="60" autocomplete="off" placeholder={t("groups.newPlaceholder")} />
      </div>
      <button type="submit" class="btn" disabled={busy || !name.trim()}>{t("groups.create")}</button>
    </form>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  {/if}
</section>

<style>
  .groups {
    display: grid;
    gap: 1rem;
    max-width: 640px;
  }
</style>
