<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { canSpeak, loadVoices, speak } from "../lib/speech";
  import type { ContentLang } from "../lib/types";
  import Icon from "./Icon.svelte";

  let { text, lang, size = 20, label }: { text: string; lang: ContentLang; size?: number; label?: string } = $props();

  let available = $state(false);
  $effect(() => {
    const l = lang;
    void loadVoices().then(() => (available = canSpeak(l)));
  });
</script>

{#if available && text}
  <button type="button" class="icon-btn speak" aria-label={label ?? `${t("common.speak")}: ${text}`} onclick={() => speak(text, lang)}>
    <Icon name="speaker" {size} />
  </button>
{/if}
