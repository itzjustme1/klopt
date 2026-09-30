<script lang="ts">
  import { t } from "../i18n/index.svelte";
  let { deckId }: { deckId?: string } = $props();
</script>

<h1 data-deck={deckId}>{t("nav.settings")}</h1>
