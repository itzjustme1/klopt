<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import NewMenu from "../components/NewMenu.svelte";
  import PageHead from "../components/PageHead.svelte";
  import { href } from "../lib/router";
</script>

<PageHead title={t("new.title")} back={{ href: href.lists(), label: t("nav.lists") }} />
<div class="rows"><NewMenu /></div>
