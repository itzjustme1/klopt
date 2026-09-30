<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import NewOptions from "../components/NewOptions.svelte";
  import PageBand from "../components/PageBand.svelte";
  import { href } from "../lib/router";
</script>

<PageBand title={t("new.title")} subtitle={t("new.sub")} back={{ href: href.lists(), label: t("deck.back") }} />
<section class="new">
  <NewOptions />
</section>

<style>
  .new {
    max-width: 760px;
  }
</style>
