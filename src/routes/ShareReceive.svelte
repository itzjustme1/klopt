<script lang="ts">
  import { t } from "../i18n/index.svelte";
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
    history.replaceState(null, "", href.today());
    dispatchEvent(new HashChangeEvent("hashchange"));
  }
</script>

<section class="stack">
  <h1>{t("receive.title")}</h1>
  {#if status === "loading"}
    <p class="muted" aria-busy="true">{t("receive.reading")}</p>
  {:else if status === "invalid"}
    <p class="error" role="alert">{t("receive.invalid")}</p>
    <a class="btn" href={href.today()}>{t("review.backHome")}</a>
  {:else}
    <p class="muted">{t("receive.intro")}</p>
    <SharedPreview shared={status} oncancel={leave} />
  {/if}
</section>
