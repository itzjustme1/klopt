<script lang="ts">
  import { getLang, t } from "../i18n/index.svelte";
  import ConfirmInline from "../components/ConfirmInline.svelte";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import { account, accountsEnabled, USERNAME } from "../lib/account.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";

  let mode = $state<"in" | "up" | "reset">("in");
  let email = $state("");
  let password = $state("");
  let username = $state("");
  let displayName = $state("");
  let consent = $state(false);
  let busy = $state(false);
  let error = $state("");
  let notice = $state("");
  let deleting = $state(false);
  let editName = $state(false);

  function explain(e: unknown): string {
    const m = e instanceof Error ? e.message : String(e);
    if (m === "username-taken") return t("account.usernameTaken");
    if (/invalid login|invalid credentials/i.test(m)) return t("account.wrongLogin");
    if (/email not confirmed/i.test(m)) return t("account.confirmFirst");
    if (/already registered|already exists/i.test(m)) return t("account.emailTaken");
    if (/password/i.test(m)) return t("account.weakPassword");
    if (/fetch|network/i.test(m)) return t("account.offline");
    return t("account.failed");
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = "";
    notice = "";
    const mail = email.trim();
    if (mode === "up") {
      const name = username.trim().toLowerCase();
      if (!USERNAME.test(name)) return void (error = t("account.usernameRule"));
      if (password.length < 8) return void (error = t("account.weakPassword"));
      if (!consent) return void (error = t("account.consentNeeded"));
      busy = true;
      try {
        const r = await account.signUp(mail, password, name, displayName.trim() || name);
        if (r === "confirm") notice = t("account.checkMail", { email: mail });
        else await syncNow();
      } catch (err) {
        error = explain(err);
      } finally {
        busy = false;
      }
    } else if (mode === "reset") {
      busy = true;
      try {
        await account.resetPassword(mail);
        notice = t("account.resetSent", { email: mail });
      } catch (err) {
        error = explain(err);
      } finally {
        busy = false;
      }
    } else {
      busy = true;
      try {
        await account.signIn(mail, password);
        password = "";
        await syncNow();
      } catch (err) {
        error = explain(err);
      } finally {
        busy = false;
      }
    }
  }

  async function syncNow() {
    await app.syncAccount();
    if (account.syncError) error = explain(new Error(account.syncError));
  }

  async function saveName(e: SubmitEvent) {
    e.preventDefault();
    const name = username.trim().toLowerCase();
    if (!USERNAME.test(name)) return void (error = t("account.usernameRule"));
    try {
      await account.setProfile(name, displayName.trim() || name);
      editName = false;
      error = "";
    } catch (err) {
      error = explain(err);
    }
  }

  async function removeAccount() {
    try {
      await account.deleteAccount();
      app.showFlash(t("account.deleted"));
    } catch (err) {
      error = explain(err);
    }
    deleting = false;
  }

  const when = $derived(account.lastSync ? new Intl.DateTimeFormat(getLang(), { hour: "2-digit", minute: "2-digit" }).format(new Date(account.lastSync)) : "");
</script>

<PageHead title={t("account.title")} back={{ href: href.settings(), label: t("settings.title") }} />

<section class="acc">
  {#if !accountsEnabled}
    <p class="muted">{t("account.off")}</p>
  {:else if account.user}
    <div class="card card-pad who">
      <span class="avatar" aria-hidden="true">{(account.profile?.display_name ?? account.user.email ?? "?").slice(0, 1).toUpperCase()}</span>
      <div class="who-text">
        <p class="name">{account.profile?.display_name ?? t("account.noName")}</p>
        {#if account.profile}<p class="small muted">@{account.profile.username}</p>{/if}
        <p class="small muted">{account.user.email}</p>
      </div>
    </div>

    {#if !account.profile || editName}
      <form class="card card-pad stack" style:--gap="0.75rem" onsubmit={saveName}>
        <p>{t("account.pickName")}</p>
        <div class="field">
          <label for="acc-user">{t("account.username")}</label>
          <input id="acc-user" type="text" bind:value={username} autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20" />
          <span class="small muted">{t("account.usernameRule")}</span>
        </div>
        <div class="field">
          <label for="acc-display">{t("account.displayName")}</label>
          <input id="acc-display" type="text" bind:value={displayName} maxlength="40" autocomplete="nickname" />
        </div>
        <button type="submit" class="btn btn-primary">{t("common.save")}</button>
      </form>
    {/if}

    <div class="card card-pad stack" style:--gap="0.75rem">
      <h2>{t("account.sync")}</h2>
      <p class="small muted">{t("account.syncHelp")}</p>
      <p class="small" role="status">
        {#if account.syncing}{t("account.syncing")}{:else if account.syncError}<span class="error">{t("account.syncFailed")}</span>{:else if when}{t("account.syncedAt", { time: when })}{/if}
      </p>
      <button type="button" class="btn btn-primary" disabled={account.syncing} onclick={syncNow}><Icon name="learn" size={18} />{t("account.syncNow")}</button>
    </div>

    <ul class="rows">
      <li><a class="row-item" href={href.inbox()}><Icon name="share" /><span class="row-main"><span class="row-title">{t("inbox.title")}</span></span>{#if account.inboxCount}<span class="tag">{account.inboxCount}</span>{/if}</a></li>
      <li><a class="row-item" href={href.groups()}><Icon name="lists" /><span class="row-main"><span class="row-title">{t("groups.title")}</span></span><Icon name="chevron" size={20} /></a></li>
      {#if account.profile}
        <li><button type="button" class="row-item" onclick={() => { username = account.profile?.username ?? ""; displayName = account.profile?.display_name ?? ""; editName = true; }}><Icon name="edit" /><span class="row-main"><span class="row-title">{t("account.changeName")}</span></span></button></li>
      {/if}
      <li><button type="button" class="row-item" onclick={() => account.signOut()}><Icon name="back" /><span class="row-main"><span class="row-title">{t("account.signOut")}</span><span class="row-sub">{t("account.signOutHelp")}</span></span></button></li>
    </ul>

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    {#if deleting}
      <ConfirmInline message={t("account.deleteConfirm")} confirmLabel={t("account.deleteYes")} onconfirm={removeAccount} oncancel={() => (deleting = false)} />
    {:else}
      <button type="button" class="btn btn-quiet danger" onclick={() => (deleting = true)}><Icon name="trash" size={18} />{t("account.delete")}</button>
    {/if}
  {:else}
    <p class="muted">{t("account.why")}</p>
    <div class="segmented" role="group" aria-label={t("account.title")}>
      <label><input type="radio" name="acc-mode" value="in" bind:group={mode} />{t("account.signIn")}</label>
      <label><input type="radio" name="acc-mode" value="up" bind:group={mode} />{t("account.signUp")}</label>
    </div>
    <form class="card card-pad stack" style:--gap="0.875rem" onsubmit={submit} novalidate>
      <div class="field">
        <label for="acc-email">{t("account.email")}</label>
        <input id="acc-email" type="email" bind:value={email} autocomplete="email" autocapitalize="off" spellcheck="false" required />
      </div>
      {#if mode !== "reset"}
        <div class="field">
          <label for="acc-pass">{t("account.password")}</label>
          <input id="acc-pass" type="password" bind:value={password} autocomplete={mode === "up" ? "new-password" : "current-password"} minlength="8" required />
          {#if mode === "up"}<span class="small muted">{t("account.passwordRule")}</span>{/if}
        </div>
      {/if}
      {#if mode === "up"}
        <div class="field">
          <label for="acc-user">{t("account.username")}</label>
          <input id="acc-user" type="text" bind:value={username} autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20" required />
          <span class="small muted">{t("account.usernameRule")}</span>
        </div>
        <div class="field">
          <label for="acc-display">{t("account.displayName")}</label>
          <input id="acc-display" type="text" bind:value={displayName} maxlength="40" autocomplete="nickname" />
        </div>
        <label class="consent"><input type="checkbox" bind:checked={consent} /><span>{t("account.consent")}</span></label>
        <p class="small muted">{t("account.privacy")}</p>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      {#if notice}<p class="notice" role="status">{notice}</p>{/if}
      <button type="submit" class="btn btn-primary btn-lg" disabled={busy}>
        {mode === "up" ? t("account.signUp") : mode === "reset" ? t("account.sendReset") : t("account.signIn")}
      </button>
      {#if mode === "in"}
        <button type="button" class="btn btn-quiet" onclick={() => { mode = "reset"; error = ""; }}>{t("account.forgot")}</button>
      {:else if mode === "reset"}
        <button type="button" class="btn btn-quiet" onclick={() => (mode = "in")}>{t("common.back")}</button>
      {/if}
    </form>
  {/if}
</section>

<style>
  .acc {
    display: grid;
    gap: 1rem;
    max-width: 560px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .avatar {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    flex: none;
    border-radius: 50%;
    background: var(--brand);
    color: var(--on-brand);
    font-size: var(--fs-section);
    font-weight: 900;
  }
  .who-text {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .name {
    font-weight: 900;
    font-size: var(--fs-section);
  }
  .consent {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    min-height: var(--tap);
    cursor: pointer;
  }
  .consent input {
    width: 20px;
    height: 20px;
    margin-top: 0.125rem;
    flex: none;
    accent-color: var(--green);
  }
  .notice {
    padding: 0.75rem 1rem;
    border-radius: var(--r-sm);
    background: var(--good-soft);
    color: var(--good);
    font-weight: 700;
  }
  .danger {
    justify-self: start;
    color: var(--bad);
  }
</style>
