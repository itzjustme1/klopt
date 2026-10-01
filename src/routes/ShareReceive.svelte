<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import PageHead from "../components/PageHead.svelte";
  import SharedPreview from "../components/SharedPreview.svelte";
  import type { SharedDeck } from "../lib/backup";
  import { href } from "../lib/router";
  import { decodeShare } from "../lib/share";

  let { payload }: { payload: string } = $props();

  let status = $state.raw<"loading" | "invalid" | SharedDeck>("loading");

  $effect(() => {
    let cancelled = false;
    void decodeShare(payload).then((r) => {
      if (!cancelled) status = r.ok ? r.data : "invalid";
    });
    return () => {
      cancelled = true;
    };
  });

  function leave() {
    // Replace so the Back button doesn't reopen the shared link.
    location.replace(href.today());
  }
</script>

<PageHead title={t("receive.title")} subtitle={typeof status === "object" ? t("receive.intro") : undefined} />
<section class="receive">
  {#if status === "loading"}
    <p class="muted" aria-busy="true">{t("receive.reading")}</p>
  {:else if status === "invalid"}
    <p class="error" role="alert">{t("receive.invalid")}</p>
    <a class="btn" href={href.today()}>{t("practice.backHome")}</a>
  {:else}
    <SharedPreview shared={status} oncancel={leave} />
  {/if}
</section>

<style>
  .receive {
    display: grid;
    gap: 1rem;
    max-width: 720px;
    justify-items: start;
  }
  .receive :global(.preview) {
    width: 100%;
  }
</style>
