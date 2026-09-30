<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import NewOptions from "../components/NewOptions.svelte";
  import { href } from "../lib/router";
</script>

<section class="new">
  <a class="back small" href={href.lists()}><Icon name="back" size={18} />{t("deck.back")}</a>
  <h1>{t("new.title")}</h1>
  <NewOptions />
</section>

<style>
  .new {
    display: grid;
    gap: 1.25rem;
    max-width: 760px;
  }
  :global(.back) {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    justify-self: start;
    min-height: var(--tap);
    font-weight: 700;
    text-decoration: none;
  }
</style>
