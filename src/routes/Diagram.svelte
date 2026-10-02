<script lang="ts">
  import { tick } from "svelte";
  import { getLang, t, tp } from "../i18n/index.svelte";
  import { LIMITS } from "../config";
  import Icon from "../components/Icon.svelte";
  import PageHead from "../components/PageHead.svelte";
  import { app } from "../lib/app.svelte";
  import { coveredPicture, type LabelBox } from "../lib/occlusion";
  import { recognizeLabels, type OcrProgress } from "../lib/ocr";
  import { href } from "../lib/router";
  import { SUBJECTS } from "../lib/subjects";
  import { CONTENT_LANGS, type ContentLang } from "../lib/types";

  /**
   * "Plaatje met namen": a diagram (the heart, a map, a cell) whose labels are covered one at a time.
   * The labels are found by the text recogniser; boxes can be removed, drawn and renamed by hand.
   */
  let { deckId }: { deckId?: string } = $props();

  // svelte-ignore state_referenced_locally
  const deck = deckId ? app.deck(deckId) : undefined;
  let lang = $state<ContentLang>(deck && deck.langBack !== "xx" ? deck.langBack : getLang());
  let imgUrl = $state("");
  let img: HTMLImageElement | undefined = $state();
  let file: Blob | null = null;
  type Box = LabelBox & { id: number };
  let boxes = $state<Box[]>([]);
  let nextId = 0;
  let progress = $state<OcrProgress | null>(null);
  let error = $state("");
  let name = $state("");
  let subject = $state(deck?.subject ?? "");
  let saving = $state(false);
  let input: HTMLInputElement | undefined = $state();
  let stage: HTMLElement | undefined = $state();
  let drawing = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  let selected = $state<number | null>(null);

  const named = $derived(boxes.filter((b) => b.text.trim()));
  // Free the picture's memory when leaving the screen.
  $effect(() => () => {
    if (imgUrl) URL.revokeObjectURL(imgUrl);
  });

  async function choose(f: File | undefined) {
    error = "";
    if (!f) return;
    if (f.type && !f.type.startsWith("image/")) return void (error = t("photo.notImage"));
    file = f;
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    imgUrl = URL.createObjectURL(f);
    boxes = [];
    if (!name) name = t("diagram.defaultName");
    await findLabels();
    if (input) input.value = "";
  }

  async function findLabels() {
    if (!file) return;
    try {
      progress = { status: "loading", progress: 0 };
      const found = await recognizeLabels(file, lang, (p) => (progress = p));
      boxes = found.map((b) => ({ ...b, text: b.text.slice(0, LIMITS.sideChars), id: nextId++ }));
      if (!found.length) error = t("diagram.noneFound");
    } catch (e) {
      console.error(e);
      error = t("photo.failed");
    } finally {
      progress = null;
    }
  }

  // Drawing a new box by dragging over the picture.
  function point(e: PointerEvent) {
    const r = stage!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }
  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest(".box")) return;
    const p = point(e);
    drawing = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    stage!.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function onpointermove(e: PointerEvent) {
    if (!drawing) return;
    const p = point(e);
    drawing = { ...drawing, x1: p.x, y1: p.y };
  }
  async function onpointerup() {
    if (!drawing) return;
    const d = drawing;
    drawing = null;
    const box = { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) };
    if (box.w < 0.02 || box.h < 0.015) return;
    const id = nextId++;
    boxes = [...boxes, { ...box, text: "", id }];
    await focusBox(id);
  }

  async function focusBox(id: number) {
    selected = id;
    await tick();
    document.getElementById(`box-text-${id}`)?.focus();
  }

  // Moving a box by dragging it, resizing it by its corner; arrow keys do the same (Shift+arrow resizes).
  function editBox(e: PointerEvent, b: Box, mode: "move" | "resize") {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const r = stage!.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const start = { x: b.x, y: b.y, w: b.w, h: b.h };
    let dragged = false;
    const onmove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / r.width;
      const dy = (ev.clientY - sy) / r.height;
      if (!dragged && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      dragged = true;
      const i = boxes.findIndex((x) => x.id === b.id);
      if (i < 0) return;
      const box = boxes[i]!;
      if (mode === "move") {
        box.x = Math.min(1 - start.w, Math.max(0, start.x + dx));
        box.y = Math.min(1 - start.h, Math.max(0, start.y + dy));
      } else {
        box.w = Math.min(1 - start.x, Math.max(0.02, start.w + dx));
        box.h = Math.min(1 - start.y, Math.max(0.015, start.h + dy));
      }
    };
    const onup = () => {
      el.removeEventListener("pointermove", onmove);
      el.removeEventListener("pointerup", onup);
      el.removeEventListener("pointercancel", onup);
      // A tap (no drag) picks the box to rename it.
      if (!dragged) void focusBox(b.id);
      else selected = b.id;
    };
    el.addEventListener("pointermove", onmove);
    el.addEventListener("pointerup", onup);
    el.addEventListener("pointercancel", onup);
  }

  function boxKey(e: KeyboardEvent, b: Box) {
    const step = 0.01;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = d[e.key];
    if (!move) return;
    e.preventDefault();
    const box = boxes.find((x) => x.id === b.id)!;
    if (e.shiftKey) {
      box.w = Math.min(1 - box.x, Math.max(0.02, box.w + move[0]));
      box.h = Math.min(1 - box.y, Math.max(0.015, box.h + move[1]));
    } else {
      box.x = Math.min(1 - box.w, Math.max(0, box.x + move[0]));
      box.y = Math.min(1 - box.h, Math.max(0, box.y + move[1]));
    }
    selected = b.id;
  }

  function remove(id: number) {
    boxes = boxes.filter((b) => b.id !== id);
    if (selected === id) selected = null;
  }

  async function save() {
    if (!img || !named.length) return;
    saving = true;
    error = "";
    try {
      const covers = named.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
      const cards = named.map((b, i) => ({ front: "", back: b.text.trim(), image: coveredPicture(img!, img!.naturalWidth, img!.naturalHeight, covers, i) }));
      let id = deck?.id;
      if (!id) {
        const made = await app.createDeck({ name: name.trim().slice(0, LIMITS.deckNameChars) || t("diagram.defaultName"), subject: subject.trim().slice(0, LIMITS.labelChars), langFront: "xx", langBack: lang });
        id = made.id;
      }
      await app.addCards(id, cards);
      app.showFlash(tp("diagram.saved", cards.length));
      location.hash = href.deck(id);
    } catch (e) {
      console.error(e);
      error = t("common.saveFailed");
      saving = false;
    }
  }

  let dragging = $state(false);
  function onpaste(e: ClipboardEvent) {
    const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
    if (f && !progress) {
      e.preventDefault();
      void choose(f);
    }
  }
</script>

<svelte:window {onpaste} />

<PageHead title={t("diagram.title")} subtitle={imgUrl ? undefined : t("diagram.intro")} back={{ href: deck ? href.deck(deck.id) : href.newList(), label: t("common.back") }} />

<section
  class="diagram"
  class:dragging
  aria-label={t("diagram.title")}
  ondrop={(e) => {
    e.preventDefault();
    dragging = false;
    void choose(e.dataTransfer?.files?.[0]);
  }}
  ondragover={(e) => {
    if (e.dataTransfer?.types.includes("Files")) {
      e.preventDefault();
      dragging = true;
    }
  }}
  ondragleave={() => (dragging = false)}
>
  {#if !imgUrl}
    <div class="card card-pad intro">
      <div class="field">
        <label for="dg-lang">{t("diagram.lang")}</label>
        <select id="dg-lang" bind:value={lang}>
          {#each CONTENT_LANGS.filter((l) => l !== "xx") as l (l)}<option value={l}>{t(`lang.${l}`)}</option>{/each}
        </select>
      </div>
      <label class="btn btn-primary btn-lg pick">
        <Icon name="image" size={22} />{t("diagram.choose")}
        <input class="visually-hidden" type="file" accept="image/*" bind:this={input} onchange={() => choose(input?.files?.[0])} />
      </label>
      <p class="small muted">{t("diagram.how")}</p>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
  {:else}
    <div class="card card-pad editor">
      <p class="small muted">{t("diagram.drawHint")}</p>
      <p class="visually-hidden" id="diagram-keys">{t("diagram.keys")}</p>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="stage" bind:this={stage} {onpointerdown} {onpointermove} onpointerup={onpointerup} onpointercancel={() => (drawing = null)}>
        <img src={imgUrl} alt={t("diagram.picture")} bind:this={img} draggable="false" />
        {#each boxes as b, i (b.id)}
          <button
            type="button"
            class="box"
            class:sel={selected === b.id}
            class:empty={!b.text.trim()}
            style:left="{b.x * 100}%"
            style:top="{b.y * 100}%"
            style:width="{b.w * 100}%"
            style:height="{b.h * 100}%"
            aria-label={t("diagram.boxLabel", { n: i + 1, text: b.text || "…" })}
            aria-describedby="diagram-keys"
            onpointerdown={(e) => editBox(e, b, "move")}
            onclick={(e) => {
              // Keyboard Enter; a pointer is handled by editBox.
              if (e.detail === 0) void focusBox(b.id);
            }}
            onkeydown={(e) => boxKey(e, b)}
          ><span class="num">{i + 1}</span>{#if selected === b.id}<span class="corner" aria-hidden="true" onpointerdown={(e) => editBox(e, b, "resize")}></span>{/if}</button>
        {/each}
        {#if drawing}
          <span class="box drawing" style:left="{Math.min(drawing.x0, drawing.x1) * 100}%" style:top="{Math.min(drawing.y0, drawing.y1) * 100}%" style:width="{Math.abs(drawing.x1 - drawing.x0) * 100}%" style:height="{Math.abs(drawing.y1 - drawing.y0) * 100}%"></span>
        {/if}
      </div>

      {#if progress}
        <div class="progress" role="status">
          <p class="small">{progress.status === "reading" ? t("diagram.reading", { p: Math.round(progress.progress * 100) }) : t("photo.loading", { p: Math.round(progress.progress * 100) })}</p>
          <div class="bar" aria-hidden="true"><span style:width="{Math.round(progress.progress * 100)}%"></span></div>
        </div>
      {:else}
        <h2>{tp("diagram.count", boxes.length)}</h2>
        {#if boxes.length}
          <ol class="labels">
            {#each boxes as b, i (b.id)}
              <li class:sel={selected === b.id}>
                <span class="n num" aria-hidden="true">{i + 1}</span>
                <label class="visually-hidden" for="box-text-{b.id}">{t("diagram.nameOf", { n: i + 1 })}</label>
                <input id="box-text-{b.id}" type="text" bind:value={boxes[i]!.text} maxlength={LIMITS.sideChars} placeholder={t("diagram.namePlaceholder")} autocomplete="off" onfocus={() => (selected = b.id)} />
                <button type="button" class="icon-btn" aria-label={t("diagram.remove", { n: i + 1 })} onclick={() => remove(b.id)}><Icon name="x" size={18} /></button>
              </li>
            {/each}
          </ol>
        {/if}
        {#if !deck}
          <div class="meta">
            <div class="field">
              <label for="dg-name">{t("editor.name")}</label>
              <input id="dg-name" type="text" bind:value={name} maxlength={LIMITS.deckNameChars} autocomplete="off" />
            </div>
            <div class="field">
              <label for="dg-subject">{t("editor.subject")}</label>
              <input id="dg-subject" type="text" bind:value={subject} list="dg-subjects" maxlength={LIMITS.labelChars} autocomplete="off" />
              <datalist id="dg-subjects">
                {#each SUBJECTS[getLang()] as s (s)}<option value={s}></option>{/each}
              </datalist>
            </div>
          </div>
        {/if}
        {#if error}<p class="error" role="alert">{error}</p>{/if}
        <div class="row actions">
          <button type="button" class="btn btn-primary btn-lg" disabled={saving || !named.length} onclick={save}>
            {deck ? tp("diagram.addTo", named.length, { name: deck.name }) : tp("diagram.make", named.length)}
          </button>
          <label class="btn pick">
            <Icon name="image" size={20} />{t("diagram.other")}
            <input class="visually-hidden" type="file" accept="image/*" bind:this={input} onchange={() => choose(input?.files?.[0])} />
          </label>
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .diagram {
    display: grid;
    gap: 1rem;
    max-width: 760px;
    border-radius: var(--r-lg);
  }
  .diagram.dragging {
    box-shadow: 0 0 0 3px var(--accent);
  }
  .intro,
  .editor {
    display: grid;
    gap: 1rem;
  }
  .pick {
    justify-self: start;
  }
  .pick:focus-within {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .stage {
    position: relative;
    justify-self: center;
    max-width: 100%;
    touch-action: none;
    user-select: none;
    cursor: crosshair;
    border-radius: var(--r-sm);
    background: #fff;
  }
  .stage img {
    display: block;
    border-radius: var(--r-sm);
    max-width: 100%;
    max-height: 70vh;
    pointer-events: none;
  }
  .stage .box {
    position: absolute;
    cursor: move;
    display: block;
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: 2px solid var(--brand);
    border-radius: 4px;
    background: rgb(31 92 255 / 0.18);
    cursor: pointer;
  }
  .stage .box.sel {
    background: rgb(31 92 255 / 0.4);
    box-shadow: 0 0 0 3px var(--yellow);
  }
  .stage .box {
    touch-action: none;
  }
  /* Just outside the corner, so even a small box can still be grabbed in the middle to move it. */
  .corner {
    position: absolute;
    right: -20px;
    bottom: -20px;
    width: 18px;
    height: 18px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: var(--brand);
    cursor: nwse-resize;
  }
  /* A bigger area to grab with a finger than the dot shows. */
  .corner::after {
    content: "";
    position: absolute;
    inset: -8px;
  }
  .stage .box.empty {
    border-style: dashed;
  }
  .stage .box.drawing {
    border-style: dashed;
    pointer-events: none;
  }
  .stage .num {
    position: absolute;
    bottom: calc(100% + 2px);
    left: -2px;
    display: grid;
    place-items: center;
    min-width: 1.3rem;
    height: 1.3rem;
    padding: 0 0.25rem;
    border-radius: 999px;
    background: var(--brand);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 800;
  }
  .progress {
    display: grid;
    gap: 0.5rem;
  }
  .labels {
    display: grid;
    gap: 0.375rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .labels li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: var(--r-sm);
  }
  .labels li.sel {
    box-shadow: 0 0 0 2px var(--yellow);
  }
  .labels .n {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    flex: none;
    border-radius: 50%;
    background: var(--brand);
    color: #fff;
    font-weight: 800;
    font-size: var(--fs-small);
  }
  .labels input {
    flex: 1;
    min-width: 0;
  }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .actions {
    flex-wrap: wrap;
  }
  @media (max-width: 480px) {
    .meta {
      grid-template-columns: 1fr;
    }
  }
</style>
