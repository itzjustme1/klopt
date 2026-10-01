<script lang="ts">
  import { getLang, t, tp } from "../i18n/index.svelte";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import SubjectBadge from "../components/SubjectBadge.svelte";
  import { app } from "../lib/app.svelte";
  import { href } from "../lib/router";
  import { VERB_SETS, type VerbSet } from "../lib/verbsets";

  let busy = $state("");
  const lang = $derived(getLang());

  async function add(set: VerbSet) {
    busy = set.id;
    try {
      const deck = await app.createDeck({ name: set.name[lang], subject: set.subject[lang], langFront: set.lang, langBack: lang, kind: "forms", columns: set.columns });
      await app.addCards(deck.id, set.verbs.map((x) => ({ front: x.verb, back: x[lang], forms: x.forms })));
      app.showFlash(t("receive.added", { name: deck.name }));
      location.hash = href.deck(deck.id);
    } catch {
      app.showFlash(t("common.saveFailed"));
      busy = "";
    }
  }
</script>

<PageHead title={t("verbs.title")} subtitle={t("verbs.sub")} back={{ href: href.newList(), label: t("common.back") }} />
<ul class="rows">
  {#each VERB_SETS as set (set.id)}
    <li class="set">
      <SubjectBadge subject={set.subject.nl} size={32} />
      <span class="row-main">
        <span class="row-title">{set.name[lang]}</span>
        <span class="row-sub">{tp("verbs.count", set.verbs.length)}</span>
        <span class="row-sub cols">{set.columns.join(" · ")}</span>
      </span>
      <button type="button" class="btn btn-primary add" disabled={!!busy} onclick={() => add(set)}><Icon name="plus" size={18} />{t("receive.addThis")}</button>
    </li>
  {/each}
</ul>
<p class="small muted note">{t("verbs.own")}</p>

<style>
  .set {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 1rem;
  }
  .cols {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .add {
    flex: none;
    min-height: 2.5rem;
    padding-inline: 0.875rem;
  }
  .note {
    margin-top: 1rem;
  }
</style>
