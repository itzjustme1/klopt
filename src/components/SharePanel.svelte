<script lang="ts">
  import Icon from "./Icon.svelte";
  import QrCode from "./QrCode.svelte";
  import { t } from "../i18n/index.svelte";
  import { APP_NAME } from "../config";
  import { backupFileName } from "../lib/backup";
  import { downloadText } from "../lib/files";
  import { href } from "../lib/router";
  import { encodeJson } from "../lib/share";
  import { account, accountsEnabled, type Group } from "../lib/account.svelte";
  import { app } from "../lib/app.svelte";
  import type { Card } from "../lib/types";

  /** Share a list, quiz or folder: `json` is its share file; `cards` (a list) also offers a plain-text export. */
  let {
    name,
    json,
    kind = "deck",
    cards = [],
    title,
    onclose,
  }: { name: string; json: string; kind?: "deck" | "quiz" | "folder"; cards?: Card[]; title?: string; onclose: () => void } = $props();

  // Signed in: send it straight to a classmate's account, or put it in one of your groups.
  let to = $state("");
  let sendState = $state<"" | "busy" | "sent" | "unknown" | "failed">("");
  let groups = $state.raw<Group[]>([]);
  $effect(() => {
    if (account.user) void account.groups().then((g) => (groups = g)).catch(() => {});
  });
  async function sendTo(e: SubmitEvent) {
    e.preventDefault();
    sendState = "busy";
    try {
      const person = await account.findUser(to.replace(/^@/, ""));
      if (!person) return void (sendState = "unknown");
      await account.send(person.id, kind, name, json);
      sendState = "sent";
      to = "";
    } catch {
      sendState = "failed";
    }
  }
  async function toGroup(g: Group) {
    try {
      await account.addToGroup(g.id, kind, name, json);
      app.showFlash(t("groups.addedTo", { name: g.name }));
    } catch {
      app.showFlash(t("account.failed"));
    }
  }

  let link = $state<string | null | undefined>(undefined);
  let showQr = $state(false);
  /** Longer links make a code too dense to scan from a phone screen. */
  const QR_MAX = 1800;
  let copied = $state<"" | "ok" | "failed">("");
  let heading: HTMLElement | undefined = $state();

  $effect(() => {
    heading?.focus();
  });

  $effect(() => {
    const file = json;
    let cancelled = false;
    link = undefined;
    void encodeJson(file).then((payload) => {
      if (cancelled) return;
      link = payload ? new URL(href.share(payload), location.href).href : null;
    });
    return () => {
      cancelled = true;
    };
  });

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      copied = "ok";
    } catch {
      copied = "failed";
    }
  }

  function download() {
    downloadText(backupFileName(APP_NAME, new Date(), "deck", name), json);
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function nativeShare() {
    try {
      if (link) {
        await navigator.share({ title: name, text: t("share.nativeText"), url: link });
      } else {
        const file = new File([json], backupFileName(APP_NAME, new Date(), "deck", name), { type: "application/json" });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: name, files: [file] });
        else download();
      }
    } catch {
      // The student closed the share sheet; nothing to do.
    }
  }

  /** One word per line, tab between the sides: what Quizlet and spreadsheets import. */
  const asText = $derived(cards.map((c) => `${c.front.replace(/[\t\r\n]+/g, " ")}\t${c.back.replace(/[\t\r\n]+/g, " ")}`).join("\n"));
  let textCopied = $state<"" | "ok" | "failed">("");

  async function copyText() {
    try {
      await navigator.clipboard.writeText(asText);
      textCopied = "ok";
    } catch {
      textCopied = "failed";
    }
  }

  function downloadAsText() {
    const base = backupFileName(APP_NAME, new Date(), "deck", name).replace(/\.json$/, ".txt");
    downloadText(base, asText, "text/plain;charset=utf-8");
  }
</script>

<section class="card card-pad share" aria-labelledby="share-title">
  <h2 id="share-title" tabindex="-1" bind:this={heading}>{title ?? t("share.title")}</h2>
  <p class="muted">{t("share.intro")}</p>
    {#if link === null}
      <p>{t("share.tooLong")}</p>
    {:else if link}
      <div class="field">
        <label for="share-link">{t("share.linkLabel")}</label>
        <input id="share-link" type="text" readonly value={link} onfocus={(e) => e.currentTarget.select()} />
      </div>
      <p class="small" aria-live="polite">
        {#if copied === "ok"}{t("share.copied")}{:else if copied === "failed"}<span class="error">{t("share.copyFailed")}</span>{/if}
      </p>
    {/if}
    <div class="row">
      {#if canNativeShare}<button type="button" class="btn btn-primary" onclick={nativeShare}>{t("share.native")}</button>{/if}
      {#if link}<button type="button" class={canNativeShare ? "btn" : "btn btn-primary"} onclick={copy}>{t("share.copyLink")}</button>{/if}
      {#if link}<button type="button" class="btn" aria-expanded={showQr} onclick={() => (showQr = !showQr)}><Icon name="qr" size={18} />{t("share.qr")}</button>{/if}
      <button type="button" class={link === null && !canNativeShare ? "btn btn-primary" : "btn"} onclick={download}>{t("share.file")}</button>
    </div>
    {#if showQr && link}
      <div class="qr-box">
        {#if link.length <= QR_MAX}
          <QrCode text={link} label={t("share.qrLabel", { name })} />
          <p class="small muted">{t("share.qrHelp")}</p>
        {:else}
          <p class="small">{t("share.qrTooLong")}</p>
        {/if}
      </div>
    {/if}

    {#if accountsEnabled && account.user}
      <form class="person" onsubmit={sendTo}>
        <div class="field">
          <label for="share-to">{t("share.toPerson")}</label>
          <input id="share-to" type="text" bind:value={to} placeholder="@gebruikersnaam" autocapitalize="off" spellcheck="false" autocomplete="off" />
        </div>
        <button type="submit" class="btn btn-primary" disabled={!to.trim() || sendState === "busy"}>{t("share.send")}</button>
        <p class="small" aria-live="polite">
          {#if sendState === "sent"}{t("share.sent")}{:else if sendState === "unknown"}<span class="error">{t("share.unknownUser")}</span>{:else if sendState === "failed"}<span class="error">{t("account.failed")}</span>{/if}
        </p>
      </form>
      {#if groups.length}
        <div class="row">
          {#each groups as g (g.id)}
            <button type="button" class="btn" onclick={() => toGroup(g)}>{t("share.toGroup", { name: g.name })}</button>
          {/each}
        </div>
      {/if}
    {/if}

    {#if cards.length}<div class="export">
      <h3>{t("share.export")}</h3>
      <p class="small muted">{t("share.exportIntro")}</p>
      <div class="row">
        <button type="button" class="btn" onclick={copyText}>{t("share.copyText")}</button>
        <button type="button" class="btn" onclick={downloadAsText}>{t("share.downloadText")}</button>
      </div>
      <p class="small" aria-live="polite">
        {#if textCopied === "ok"}{t("share.textCopied")}{:else if textCopied === "failed"}<span class="error">{t("share.copyFailed")}</span>{/if}
      </p>
    </div>{/if}
    <button type="button" class="btn btn-quiet close" onclick={onclose}>{t("common.close")}</button>
</section>

<style>
  .qr-box {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    padding: 1rem;
    border-radius: var(--r-md);
    background: var(--surface-2);
    text-align: center;
  }
  .share {
    display: grid;
    gap: 0.75rem;
    border: 2px solid var(--accent);
  }
  .share h2 {
    outline: none;
  }
  .export {
    display: grid;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
  }
  .person {
    display: grid;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
  }
  .person .btn {
    justify-self: start;
  }
  .close {
    justify-self: start;
  }
  input[readonly] {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
</style>
