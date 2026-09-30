<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import type { StringKey } from "../i18n/types";
  import Icon, { type IconName } from "../components/Icon.svelte";
  import PageBand from "../components/PageBand.svelte";
  import { MODE_COLOR } from "../lib/modeStyle";
  import { href } from "../lib/router";
  import { DAYS } from "../lib/scheduler";
  import type { Mode } from "../lib/types";

  const modes: { mode: Mode; icon: IconName; desc: StringKey }[] = [
    { mode: "leren", icon: "learn", desc: "modeDesc.leren" },
    { mode: "flashcards", icon: "cards", desc: "modeDesc.flashcards" },
    { mode: "meerkeuze", icon: "choice", desc: "modeDesc.meerkeuze" },
    { mode: "typen", icon: "type", desc: "modeDesc.typen" },
    { mode: "dictee", icon: "listen", desc: "modeDesc.dictee" },
    { mode: "toets", icon: "test", desc: "modeDesc.toets" },
    { mode: "koppelen", icon: "match", desc: "modeDesc.koppelen" },
  ];
  const sections: { title: StringKey; items: StringKey[] }[] = [
    { title: "help.checkTitle", items: ["help.check1", "help.check2", "help.check3", "help.check4", "help.check5", "help.check6"] },
    { title: "help.examTitle", items: ["help.exam1", "help.exam2"] },
    { title: "help.dataTitle", items: ["help.data1", "help.data2", "help.data3", "help.data4"] },
  ];
</script>

<PageBand title={t("help.title")} back={{ href: href.settings(), label: t("settings.title") }} />
<article class="help">

  <section class="card card-pad">
    <h2>{t("help.reviewTitle")}</h2>
    <ol class="boxes" aria-hidden="true">
      {#each DAYS as d, i (i)}
        <li class="b{i + 1}"><span class="caption">{t("box.label", { n: i + 1 })}</span><span class="num">{t("box.interval", { n: d })}</span></li>
      {/each}
    </ol>
    <p>{t("help.review1")}</p>
    <p>{t("help.review2")}</p>
    <p>{t("help.review3")}</p>
    <p>{t("help.review4")}</p>
  </section>

  <section class="card card-pad">
    <h2>{t("help.modesTitle")}</h2>
    <ul class="modes">
      {#each modes as m (m.mode)}
        <li>
          <span class="ic-round ic-{MODE_COLOR[m.mode]} ic"><Icon name={m.icon} size={22} /></span>
          <span><strong>{t(`mode.${m.mode}`)}</strong> <span class="muted">{t(m.desc)}</span></span>
        </li>
      {/each}
    </ul>
  </section>

  {#each sections as s (s.title)}
    <section class="card card-pad">
      <h2>{t(s.title)}</h2>
      <ul class="points">
        {#each s.items as item (item)}<li>{t(item)}</li>{/each}
      </ul>
    </section>
  {/each}
</article>

<style>
  .help {
    display: grid;
    gap: 1rem;
    max-width: 760px;
  }
  section {
    display: grid;
    gap: 0.75rem;
  }
  .boxes {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .boxes li {
    display: grid;
    justify-items: center;
    gap: 0.25rem;
    padding: 0.75rem 0.25rem;
    border-radius: var(--r-sm);
    background: var(--surface-2);
    border-top: 4px solid;
  }
  .boxes .b1 { border-top-color: var(--b1); }
  .boxes .b2 { border-top-color: var(--b2); }
  .boxes .b3 { border-top-color: var(--b3); }
  .boxes .b4 { border-top-color: var(--b4); }
  .boxes .b5 { border-top-color: var(--b5); }
  .boxes .num {
    font-weight: 800;
    font-size: var(--fs-h2);
  }
  .modes,
  .points {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .modes li {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  .ic {
    width: 44px;
    height: 44px;
  }
  .points li {
    position: relative;
    padding-left: 1.25rem;
  }
  .points li::before {
    content: "";
    position: absolute;
    left: 0.25rem;
    top: 0.6em;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }
</style>
