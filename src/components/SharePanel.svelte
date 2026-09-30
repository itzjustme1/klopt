<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { APP_NAME } from "../config";
  import { backupFileName } from "../lib/backup";
  import { downloadText } from "../lib/files";
  import { href } from "../lib/router";
  import { encodeShare, shareJson } from "../lib/share";
  import type { Card, Deck } from "../lib/types";

  let { deck, cards, onclose }: { deck: Deck; cards: Card[]; onclose: () => void } = $props();

  let link = $state<string | null | undefined>(undefined);
  let copied = $state<"" | "ok" | "failed">("");
  let heading: HTMLElement | undefined = $state();

  $effect(() => {
    heading?.focus();
  });

  $effect(() => {
    if (cards.length === 0) return;
    let cancelled = false;
    link = undefined;
    void encodeShare(deck, cards).then((payload) => {
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
    downloadText(backupFileName(APP_NAME, new Date(), "deck", deck.name), shareJson(deck, cards));
  }
</script>

<section class="card card-pad share" aria-labelledby="share-title">
  <h2 id="share-title" tabindex="-1" bind:this={heading}>{t("share.title")}</h2>
  {#if cards.length === 0}
    <p class="muted">{t("share.noCards")}</p>
  {:else}
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
      {#if link}<button type="button" class="btn btn-primary" onclick={copy}>{t("share.copyLink")}</button>{/if}
      <button type="button" class={link === null ? "btn btn-primary" : "btn"} onclick={download}>{t("share.file")}</button>
      <button type="button" class="btn btn-quiet" onclick={onclose}>{t("common.close")}</button>
    </div>
  {/if}
</section>

<style>
  .share {
    display: grid;
    gap: 0.75rem;
    border: 2px solid var(--accent);
  }
  .share h2 {
    outline: none;
  }
  input[readonly] {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
</style>
