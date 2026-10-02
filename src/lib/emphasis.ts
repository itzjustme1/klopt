/**
 * Finds the bold and italic words on a photo of a textbook page and turns them into term cards.
 *
 * The text recogniser (Tesseract's LSTM engine) does not report font styles, so they are measured
 * in the photo itself, per word box:
 * - bold: the typical stroke width (the median length of the dark runs along each pixel row),
 *   relative to the height of the line, compared with the rest of the page;
 * - italic: the shear that makes the strokes most upright (the one giving the sharpest column
 *   histogram), compared with the rest of the page.
 * Comparing with the page itself keeps it working with any font, size, lighting or a tilted photo.
 * Pure: no DOM, so it is tested on its own.
 */

export interface Gray {
  width: number;
  height: number;
  /** One byte per pixel, 0 = black. */
  data: Uint8Array;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A recognised word in reading order, with where it is on the page. */
export interface PageWord extends Box {
  text: string;
  /** Paragraph and line number, in reading order. */
  para: number;
  line: number;
  confidence?: number;
}

export interface StyledWord extends PageWord {
  bold: boolean;
  italic: boolean;
}

export interface TermCard {
  term: string;
  explanation: string;
}

/** Converts RGBA pixels (canvas ImageData) to grey. */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const data = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < data.length; i += 4, j++) data[j] = (rgba[i]! * 77 + rgba[i + 1]! * 150 + rgba[i + 2]! * 29) >> 8;
  return { width, height, data };
}

/** Otsu's threshold for a set of grey values. */
function otsu(values: ArrayLike<number>): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < values.length; i++) hist[values[i]!]!++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * The ink of one word: a bitmap (thresholded locally, so uneven light does not matter) plus how dark
 * each pixel is from 0 (paper) to 1 (ink), for sub-pixel measurements.
 */
function inkOf(g: Gray, b: Box): { w: number; h: number; ink: Uint8Array; dark: Float32Array } | null {
  const x0 = Math.max(0, Math.floor(b.x0));
  const y0 = Math.max(0, Math.floor(b.y0));
  const x1 = Math.min(g.width, Math.ceil(b.x1));
  const y1 = Math.min(g.height, Math.ceil(b.y1));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 3 || h < 6) return null;
  const values = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) values[y * w + x] = g.data[(y0 + y) * g.width + x0 + x]!;
  const t = otsu(values);
  // Paper and ink levels: the typical value on each side of the threshold.
  const paper: number[] = [];
  const inkV: number[] = [];
  for (const v of values) (v > t ? paper : inkV).push(v);
  if (!inkV.length || !paper.length) return null;
  const pl = median(paper);
  const il = median(inkV);
  if (pl - il < 40) return null; // no contrast: not a word
  const ink = new Uint8Array(w * h);
  const dark = new Float32Array(w * h);
  for (let i = 0; i < ink.length; i++) {
    ink[i] = values[i]! <= t ? 1 : 0;
    dark[i] = Math.min(1, Math.max(0, (pl - values[i]!) / (pl - il)));
  }
  return { w, h, ink, dark };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Typical stroke width of a word in pixels, with sub-pixel precision: the median width of the
 * horizontal runs of ink, where each run also counts the partly dark pixels at its edges.
 */
export function strokeWidth(g: Gray, b: Box): number | null {
  const bm = inkOf(g, b);
  if (!bm) return null;
  const runs: number[] = [];
  for (let y = 0; y < bm.h; y++) {
    const row = y * bm.w;
    let x = 0;
    while (x < bm.w) {
      if (!bm.ink[row + x]) {
        x++;
        continue;
      }
      const from = x;
      while (x < bm.w && bm.ink[row + x]) x++;
      let width = 0;
      for (let k = from; k < x; k++) width += bm.dark[row + k]!;
      if (from > 0) width += bm.dark[row + from - 1]!;
      if (x < bm.w) width += bm.dark[row + x]!;
      runs.push(width);
    }
  }
  // Only cuts through upright strokes: long runs are horizontal bars (e, t) or joined letters, whose
  // length says nothing about the weight and differs per font.
  const short = runs.filter((r) => r <= bm.h * 0.3);
  return short.length >= 6 ? median(short) : null;
}

/** The shear (dx per pixel up) that makes a word's strokes most upright; about 0.2 for italic type. */
export function slant(g: Gray, b: Box): number | null {
  const bm = inkOf(g, b);
  if (!bm) return null;
  let inkCount = 0;
  for (const v of bm.ink) inkCount += v;
  if (inkCount < 20) return null;
  const yc = bm.h / 2;
  const pad = Math.ceil(bm.h * 0.6);
  let best = -Infinity;
  let bestS = 0;
  for (let s = -0.15; s <= 0.5001; s += 0.025) {
    const cols = new Float64Array(bm.w + 2 * pad);
    for (let y = 0; y < bm.h; y++) {
      // Upward is a smaller y, so a forward-leaning stroke moves right going up.
      const shift = s * (yc - y);
      for (let x = 0; x < bm.w; x++) if (bm.ink[y * bm.w + x]) cols[Math.round(x - shift) + pad]!++;
    }
    let score = 0;
    for (const c of cols) score += c * c;
    if (score > best + 1e-9) {
      best = score;
      bestS = s;
    }
  }
  return Math.round(bestS * 1000) / 1000;
}

const LETTERS = /\p{L}/u;
const letterCount = (s: string) => [...s].filter((c) => LETTERS.test(c)).length;

/** Marks every word bold and/or italic, by comparing it with the rest of its page. */
export function styleWords(g: Gray, words: readonly PageWord[]): StyledWord[] & { blurry?: boolean } {
  // Per line: the height of its words, so stroke widths of different text sizes compare fairly.
  const lineHeights = new Map<string, number>();
  const byLine = new Map<string, PageWord[]>();
  for (const w of words) {
    const key = `${w.para}:${w.line}`;
    (byLine.get(key) ?? byLine.set(key, []).get(key)!).push(w);
  }
  for (const [key, ws] of byLine) lineHeights.set(key, median(ws.map((w) => w.y1 - w.y0)));

  const measured = words.map((w) => {
    const usable = letterCount(w.text) >= 3;
    const sw = usable ? strokeWidth(g, w) : null;
    const lh = lineHeights.get(`${w.para}:${w.line}`) || w.y1 - w.y0;
    return { w, stroke: sw === null ? null : sw / lh, slant: usable ? slant(g, w) : null };
  });
  const strokes = measured.flatMap((m) => (m.stroke === null ? [] : [m.stroke]));
  const slants = measured.flatMap((m) => (m.slant === null ? [] : [m.slant]));
  // The body text is most of the page, so the medians describe regular type. Per line is better
  // still (same light, same blur), when the line has enough words to tell.
  const pageStroke = median(strokes);
  const refSlant = median(slants);
  const lineStroke = new Map<string, number>();
  for (const [key] of byLine) {
    const vals = measured.filter((m) => `${m.w.para}:${m.w.line}` === key && m.stroke !== null).map((m) => m.stroke!);
    lineStroke.set(key, vals.length >= 4 ? Math.min(median(vals), pageStroke * 1.15) : pageStroke);
  }
  // How much regular words already vary on this photo: on a small or blurry photo the stroke width of
  // ordinary words scatters, so bold has to stand out further before it counts.
  const ratios = measured.flatMap((m) => (m.stroke === null ? [] : [m.stroke / lineStroke.get(`${m.w.para}:${m.w.line}`)!])).sort((a, b) => a - b);
  const q = (f: number) => ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * f))] ?? 1;
  // The spread of the middle half: bold words (the top few percent) do not count in it.
  const noise = ratios.length >= 20 ? Math.max(0, q(0.75) - q(0.25)) : 0;
  // Too much scatter and bold cannot be told from noise at all; italic (a slant) still can.
  // Measured: sharp pages 0.03 to 0.07 whatever the font, a WhatsApp photo 0.08, a blurry one 0.2.
  const blurry = noise > 0.075;
  const boldLong = blurry ? Infinity : Math.max(1.18, 1 + 4 * noise);
  const boldShort = boldLong + 0.07;
  const styled: StyledWord[] = measured.map((m) => {
    const ref = lineStroke.get(`${m.w.para}:${m.w.line}`)!;
    return {
      ...m.w,
      bold: m.stroke !== null && ref > 0 && m.stroke >= ref * (letterCount(m.w.text) >= 5 ? boldLong : boldShort),
      // Short words are noisier: they need a clearer slant.
      italic: m.slant !== null && m.slant - refSlant >= (letterCount(m.w.text) >= 5 ? 0.15 : 0.22),
    };
  });

  // A short word on its own is never italic: letters like W and V lean by themselves. Next to an
  // italic word it can be (the italic "Tweede Kamer").
  for (let i = 0; i < styled.length; i++) {
    const w = styled[i]!;
    if (!w.italic || letterCount(w.text) >= 5) continue;
    const near = [styled[i - 1], styled[i + 1]].some((o) => o && o.para === w.para && o.italic && letterCount(o.text) >= 5);
    if (!near) w.italic = false;
  }
  // On a noisy photo a single word leaning a little can be chance: it needs a clear slant, or an
  // italic neighbour (the phrase "spinning jenny" backs itself up).
  if (blurry) {
    const lean = styled.map((w, i) => (measured[i]!.slant ?? 0) - refSlant);
    const keep = styled.map((w, i) => {
      if (!w.italic) return false;
      if (lean[i]! >= 0.2) return true;
      return [styled[i - 1], styled[i + 1]].some((o) => o && o.para === w.para && o.italic);
    });
    styled.forEach((w, i) => (w.italic = keep[i]!));
  }

  // Short words (de, of, 3) are too small to measure: they take the style of the words around them.
  for (let i = 0; i < styled.length; i++) {
    const m = measured[i]!;
    if (m.stroke !== null || m.slant !== null) continue;
    const prev = styled[i - 1];
    const next = styled[i + 1];
    const same = (o?: StyledWord) => o && o.para === styled[i]!.para;
    if (same(prev) && same(next)) {
      styled[i]!.bold = prev!.bold && next!.bold;
      styled[i]!.italic = prev!.italic && next!.italic;
    } else if (same(prev) && !same(next) && letterCount(styled[i]!.text) === 0) {
      // Trailing punctuation such as ":" after a term.
      styled[i]!.bold = prev!.bold;
      styled[i]!.italic = prev!.italic;
    }
  }
  return Object.assign(styled, { blurry });
}

// Building cards

const ABBREVIATIONS = new Set(["bijv", "bv", "o.a", "oa", "m.a.w", "mw", "dhr", "mevr", "ca", "e.d", "enz", "etc", "nl", "d.w.z", "dwz", "jh", "e.g", "i.e", "vs", "st", "nr", "blz", "fig", "z.g.a", "evt"]);

interface Token {
  text: string;
  emph: boolean;
  para: number;
  line: number;
  /** Height of the word, for telling headings from body text. */
  h: number;
  lineStart: boolean;
  /** A run-in heading in capitals, written as a normal word in the card. */
  caps?: boolean;
  /** How sure the recogniser was of the word (0 to 100). */
  conf: number;
}

/** All capitals, at least two letters: "STOOMMACHINES", "VOC". */
const isCaps = (s: string) => letterCount(s) >= 2 && s === s.toLocaleUpperCase() && s !== s.toLocaleLowerCase();

/** Ends a sentence: "." "!" "?" (also inside quotes), unless it is a known abbreviation or a single initial. */
function endsSentence(word: string, next: Token | undefined): boolean {
  if (!/[.!?]["'”’)]*$/.test(word)) return false;
  const bare = word.replace(/["'”’)]+$/, "").replace(/[.!?]+$/, "").toLowerCase();
  if (ABBREVIATIONS.has(bare)) return false;
  if (/^\p{L}$/u.test(bare)) return false; // "W. Drees"
  return !next || /^["'“‘(]?[\p{Lu}\d]/u.test(next.text);
}

/** Sentence openers that point back at the sentence before ("Dat noemen we …", "Deze staking …"). */
const DEMONSTRATIVE = /^(dit|dat|deze|die|zo|zo'n|zulke|hierdoor|daardoor|this|that|these|those|such|das|dies|diese|dieser|ce|cela|cette|ces|c'est|esto|eso|esta|este)$/i;

const strip = (s: string) => s.replace(/^[\s"'“‘(,;:–—-]+|[\s"'”’),;:.–—-]+$/g, "");
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replaces the term in its explanation with "…", so asking the other way round gives nothing away. */
export function blankTerm(explanation: string, term: string): string {
  // Also the singular or plural: "Stoommachines" blanks "stoommachine" too.
  const stem = term.replace(/('s|s|en)$/u, "");
  const forms = stem.length >= 4 && stem !== term ? `${escapeRe(term)}|${escapeRe(stem)}(?:'s|s|en)?` : escapeRe(term);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms})(?![\\p{L}\\p{N}])`, "giu");
  return explanation.replace(re, "…");
}

/** Longest explanation on a card, in words. */
const MAX_WORDS = 45;

/**
 * Keeps an explanation short enough to learn: when it runs long (a misread full stop can glue
 * sentences together), it ends at the last full stop that leaves a real sentence, or is cut with "…".
 */
export function shorten(text: string): string {
  const ws = text.split(" ");
  if (ws.length <= MAX_WORDS) return text;
  const head = ws.slice(0, MAX_WORDS);
  for (let i = head.length - 1; i >= 9; i--) if (/[.!?]$/.test(head[i]!)) return head.slice(0, i + 1).join(" ");
  return `${head.join(" ").replace(/[,;:]$/, "")} …`;
}

/** Share of words in a text that look like misreadings: stray bars, mixed-up capitals ("rsKasse"), no letters. */
function junkShare(text: string): number {
  const ws = text.split(/\s+/).filter((w) => w && w !== "…" && !/^[\p{N}.,;:!?()"'„“”‘’-]+$/u.test(w));
  if (!ws.length) return 1;
  const junk = ws.filter((w) => /[|\\{}<>_~^]/.test(w) || /\p{Ll}\p{Lu}/u.test(w) || !/\p{L}{2}/u.test(w));
  return junk.length / ws.length;
}

/**
 * Turns styled words into term cards:
 * - consecutive bold or italic words are one term ("Verenigde Oost-Indische Compagnie");
 * - a term inside a sentence gets that sentence as its explanation (and the next one when it is short);
 * - a term that starts a line followed by ":" or a dash, or that stands on a line of its own,
 *   gets the text after it (a glossary or margin box);
 * - lines in a bigger font are headings: they never become terms, the first one names the list.
 */
export function cardsFromWords(raw: readonly StyledWord[]): { cards: TermCard[]; title: string; unclear: boolean } {
  // Drop specks the recogniser was unsure about ("EE" from a smudge).
  const kept = raw.filter((w) => !(w.confidence !== undefined && w.confidence < 60 && letterCount(w.text) <= 3));
  // The recogniser sometimes starts a new paragraph halfway through a sentence: join those again.
  const input: StyledWord[] = [];
  let para = 0;
  for (let i = 0; i < kept.length; i++) {
    const w = kept[i]!;
    const prev = kept[i - 1];
    if (!prev || (prev.para !== w.para && !(!/[.!?:]["'”’)]*$/.test(prev.text) && /^\p{Ll}/u.test(w.text)))) para++;
    input.push({ ...w, para });
  }

  // Join words broken off at the end of a line ("aan-" + "val").
  const toks: Token[] = [];
  for (let i = 0; i < input.length; i++) {
    const w = input[i]!;
    const prev = input[i - 1];
    const lineStart = !prev || prev.line !== w.line || prev.para !== w.para;
    const last = toks[toks.length - 1];
    if (last && lineStart && prev && prev.para === w.para && /\p{L}-$/u.test(last.text) && /^\p{Ll}/u.test(w.text)) {
      last.text = last.text.slice(0, -1) + w.text;
      last.emph = last.emph || w.bold || w.italic;
      continue;
    }
    toks.push({ text: w.text, emph: w.bold || w.italic, para: w.para, line: w.line, h: w.y1 - w.y0, lineStart, conf: w.confidence ?? 100 });
  }
  // Run-in headings in capitals open a paragraph and name what it explains ("STOOMMACHINES Nog
  // belangrijker was…"): one to three capitalised words, followed by normal text.
  for (let i = 0; i < toks.length; i++) {
    const startsPara = i === 0 || toks[i - 1]!.para !== toks[i]!.para;
    if (!startsPara) continue;
    let j = i;
    while (j < toks.length && j - i < 4 && toks[j]!.para === toks[i]!.para && isCaps(toks[j]!.text)) j++;
    const n = j - i;
    if (n >= 1 && n <= 3 && j < toks.length && toks[j]!.para === toks[i]!.para && !isCaps(toks[j]!.text) && /^\p{L}/u.test(toks[j]!.text) && toks.slice(i, j).some((t) => letterCount(t.text) >= 4)) {
      for (let k = i; k < j; k++) {
        toks[k]!.emph = true;
        toks[k]!.caps = true;
      }
    }
  }
  const bodyH = median(toks.filter((t) => letterCount(t.text) >= 3).map((t) => t.h)) || 1;

  // Headings: whole lines in a clearly bigger font.
  const lineH = new Map<string, number>();
  for (const t of toks) {
    const k = `${t.para}:${t.line}`;
    lineH.set(k, Math.max(lineH.get(k) ?? 0, t.h));
  }
  const isHeading = (t: Token) => (lineH.get(`${t.para}:${t.line}`) ?? 0) >= bodyH * 1.35 && median(toks.filter((o) => o.para === t.para && o.line === t.line).map((o) => o.h)) >= bodyH * 1.3;
  const title = toks.filter(isHeading).reduce<{ key: string; text: string[] }[]>((acc, t) => {
    const key = `${t.para}:${t.line}`;
    if (acc.at(-1)?.key === key) acc.at(-1)!.text.push(t.text);
    else acc.push({ key, text: [t.text] });
    return acc;
  }, [])[0];

  // Sentences, per paragraph, as token index ranges.
  const sentenceOf = new Array<number>(toks.length);
  const sentences: { from: number; to: number; para: number }[] = [];
  let start = 0;
  for (let i = 0; i < toks.length; i++) {
    const next = toks[i + 1];
    const paraEnd = !next || next.para !== toks[i]!.para;
    if (paraEnd || endsSentence(toks[i]!.text, next)) {
      sentences.push({ from: start, to: i, para: toks[i]!.para });
      for (let k = start; k <= i; k++) sentenceOf[k] = sentences.length - 1;
      start = i + 1;
    }
  }
  const textOf = (from: number, to: number) => toks.slice(from, to + 1).map((t) => t.text).join(" ");

  // On a real page only a few words stand out. When a large share seems to, the photo is too blurry
  // or too small to tell bold from regular, and the result would be guesswork.
  const body = toks.filter((t) => letterCount(t.text) >= 4 && !isHeading(t));
  const unclear = body.length >= 20 && body.filter((t) => t.emph).length / body.length > 0.15;
  if (unclear) return { cards: [], title: title ? strip(title.text.join(" ")) : "", unclear };

  const cards: TermCard[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < toks.length; i++) {
    if (!toks[i]!.emph || isHeading(toks[i]!)) continue;
    // The run of emphasised words, within one paragraph.
    let j = i;
    // A term never runs on past the end of a sentence.
    while (j + 1 < toks.length && toks[j + 1]!.emph && toks[j + 1]!.para === toks[i]!.para && !isHeading(toks[j + 1]!) && sentenceOf[j + 1] === sentenceOf[i]) j++;
    const runFrom = i;
    i = j;
    // Words the recogniser was unsure of (text in a picture, a smudge) never become a term.
    const run = toks.slice(runFrom, j + 1);
    if (run.reduce((n, t) => n + t.conf, 0) / run.length < 70) continue;
    // Capitals that belong to a longer line of capitals (a header, footer or long heading) are not a term.
    const capsAround = (k: number) => !!toks[k] && toks[k]!.para === toks[runFrom]!.para && isCaps(toks[k]!.text);
    if (!toks[runFrom]!.caps && run.every((t) => isCaps(t.text)) && (capsAround(runFrom - 1) || capsAround(j + 1))) continue;
    const raw = strip(textOf(runFrom, j));
    // "STOOMMACHINES" reads as "Stoommachines"; a short abbreviation such as "VOC" stays as it is.
    const term = toks[runFrom]!.caps && letterCount(raw) > 4 ? raw.charAt(0) + raw.slice(1).toLocaleLowerCase() : raw;
    if (letterCount(term) < 2 || words(term) > 8) continue;
    // One card per term: "stoommachine" and "Stoommachines" are the same.
    const key = term.toLocaleLowerCase().replace(/('s|s|en)$/u, "");
    if (seen.has(key)) continue;

    const para = toks[runFrom]!.para;
    const startsLine = toks[runFrom]!.lineStart;
    const after = toks[j + 1];
    const glossary = startsLine && (/[:–—-]$/.test(toks[j]!.text) || (after && after.para === para && /^[:–—-]$/.test(after.text)));
    const aloneOnLine = startsLine && (!after || after.para !== para || after.line !== toks[j]!.line);

    let explanation: string;
    if (toks[runFrom]!.caps) {
      // A run-in heading: the paragraph after it explains it (its first two sentences).
      const first = sentenceOf[j + 1];
      let to = j + 1;
      while (to + 1 < toks.length && toks[to + 1]!.para === para && sentenceOf[to + 1]! <= first! + 1) to++;
      explanation = textOf(j + 1, to);
    } else if (glossary || aloneOnLine) {
      // The text after the term, up to the next term that starts a line, at most three sentences.
      let from = j + 1;
      if (toks[from] && /^[:–—-]$/.test(toks[from]!.text)) from++;
      if (!toks[from]) continue;
      const firstSentence = sentenceOf[from]!;
      let to = from;
      while (
        to + 1 < toks.length &&
        sentenceOf[to + 1]! <= firstSentence + 2 &&
        !(toks[to + 1]!.lineStart && toks[to + 1]!.emph) &&
        !isHeading(toks[to + 1]!) &&
        toks[to + 1]!.para === toks[from]!.para
      )
        to++;
      explanation = textOf(from, to);
    } else {
      const si = sentenceOf[runFrom]!;
      const s = sentences[si]!;
      let from = s.from;
      let to = s.to;
      const own = words(textOf(s.from, s.to)) - words(term);
      const prev = sentences[si - 1];
      const next = sentences[si + 1];
      if (DEMONSTRATIVE.test(toks[s.from]!.text) && prev && prev.para === s.para) {
        // "Dat noemen we collaboratie." explains what came before it.
        from = prev.from;
        const before = sentences[si - 2];
        if (words(textOf(from, to)) - words(term) < 14 && before && before.para === s.para) from = before.from;
      } else if (own < 6 && next && next.para === s.para) {
        // A short sentence ("Dit heet de Blitzkrieg.") needs the next one to explain anything.
        to = next.to;
      }
      explanation = textOf(from, to);
    }
    explanation = shorten(explanation.replace(/\s+/g, " ").trim());
    explanation = blankTerm(explanation, term);
    explanation = explanation.charAt(0).toLocaleUpperCase() + explanation.slice(1);
    if (words(explanation.replace(/…/g, "")) < 3) continue;
    // An explanation full of misreadings would teach nonsense.
    if (junkShare(explanation) > 0.12 || /\p{Ll}\p{Lu}/u.test(term)) continue;
    seen.add(key);
    cards.push({ term, explanation });
  }
  // A heading that was read only partly ("ustrie & kolon") is no name for a list.
  const titleText = title ? strip(title.text.join(" ")) : "";
  return { cards, title: /^[\p{Lu}\p{N}]/u.test(titleText) && junkShare(titleText) === 0 ? titleText : "", unclear: false };
}

/**
 * Rebuilds the reading order of a page from the word positions: the recogniser sometimes reads two
 * columns of a textbook as one line, which mixes up the sentences. Lines are split at a column gap,
 * the pieces are grouped into columns (left to right), and paragraphs are found from extra space
 * between lines or an indented first line.
 */
export function relayout(words: readonly PageWord[]): PageWord[] {
  if (words.length < 3) return [...words];
  const h = median(words.map((w) => w.y1 - w.y0)) || 1;
  // 1. Line pieces: a recognised line split wherever the gap is much wider than a word space.
  type Piece = { words: PageWord[]; x0: number; x1: number; y0: number; y1: number; yc: number };
  const byLine = new Map<string, PageWord[]>();
  for (const w of words) {
    const k = `${w.para}:${w.line}`;
    (byLine.get(k) ?? byLine.set(k, []).get(k)!).push(w);
  }
  const pieces: Piece[] = [];
  const close = (ws: PageWord[]) => {
    if (!ws.length) return;
    const x0 = Math.min(...ws.map((w) => w.x0));
    const x1 = Math.max(...ws.map((w) => w.x1));
    const y0 = Math.min(...ws.map((w) => w.y0));
    const y1 = Math.max(...ws.map((w) => w.y1));
    pieces.push({ words: ws, x0, x1, y0, y1, yc: median(ws.map((w) => (w.y0 + w.y1) / 2)) });
  };
  // Column gutters: vertical strips that almost no word covers, with text on both sides.
  const width = Math.ceil(Math.max(...words.map((w) => w.x1))) + 1;
  const cover = new Float32Array(width);
  for (const w of words) for (let x = Math.max(0, Math.floor(w.x0)); x < Math.min(width, Math.ceil(w.x1)); x++) cover[x]!++;
  const peak = Math.max(...cover);
  const gutters: number[] = [];
  for (let x = 0; x < width; ) {
    if (cover[x]! <= Math.max(1, peak * 0.04)) {
      let end = x;
      while (end + 1 < width && cover[end + 1]! <= Math.max(1, peak * 0.04)) end++;
      const left = cover.slice(0, x).reduce((a, b) => a + b, 0);
      const right = cover.slice(end + 1).reduce((a, b) => a + b, 0);
      if (end - x + 1 >= h * 0.5 && left > peak * h && right > peak * h) gutters.push((x + end) / 2);
      x = end + 1;
    } else x++;
  }
  for (const ws of byLine.values()) {
    ws.sort((a, b) => a.x0 - b.x0);
    const gaps = ws.slice(1).map((w, i) => w.x0 - ws[i]!.x1);
    const space = median(gaps.filter((g) => g > 0)) || h * 0.35;
    const limit = Math.max(h * 1.8, space * 3.5);
    let cur: PageWord[] = [];
    ws.forEach((w, i) => {
      const prev = ws[i - 1];
      const acrossGutter = !!prev && gutters.some((g) => g > prev.x1 && g < w.x0);
      if (i > 0 && (gaps[i - 1]! > limit || acrossGutter)) {
        close(cur);
        cur = [];
      }
      cur.push(w);
    });
    close(cur);
  }
  // 2. Columns: a piece joins the column it overlaps most horizontally, checked from top to bottom.
  type Column = { x0: number; x1: number; pieces: Piece[] };
  const columns: Column[] = [];
  for (const p of pieces.toSorted((a, b) => a.yc - b.yc)) {
    let best: Column | null = null;
    let bestOverlap = 0;
    for (const c of columns) {
      const overlap = Math.min(p.x1, c.x1) - Math.max(p.x0, c.x0);
      const share = overlap / Math.max(1, Math.min(p.x1 - p.x0, c.x1 - c.x0));
      if (share > 0.5 && share > bestOverlap) {
        best = c;
        bestOverlap = share;
      }
    }
    if (best) {
      best.pieces.push(p);
      // A column keeps its own width: a wide heading does not swallow the columns under it.
      if (p.x1 - p.x0 < (best.x1 - best.x0) * 1.3) {
        best.x0 = Math.min(best.x0, p.x0);
        best.x1 = Math.max(best.x1, p.x1);
      }
    } else columns.push({ x0: p.x0, x1: p.x1, pieces: [p] });
  }
  // Reading order: columns from left to right (by where most of their lines start), top to bottom inside.
  columns.sort((a, b) => median(a.pieces.map((p) => p.x0)) - median(b.pieces.map((p) => p.x0)) || a.pieces[0]!.yc - b.pieces[0]!.yc);
  // 3. Paragraphs: extra space above a line, or an indented line after a finished sentence.
  const out: PageWord[] = [];
  let para = 0;
  let line = 0;
  for (const c of columns) {
    const left = median(c.pieces.map((p) => p.x0));
    let prev: Piece | null = null;
    for (const p of c.pieces.toSorted((a, b) => a.yc - b.yc)) {
      const gap = prev ? p.y0 - prev.y1 : Infinity;
      const prevText = prev?.words.at(-1)?.text ?? "";
      const indented = p.x0 > left + h * 0.8 && /[.!?:]["'”’)]*$/.test(prevText);
      if (!prev || gap > h * 0.9 || indented) para++;
      line++;
      for (const w of p.words) out.push({ ...w, para, line });
      prev = p;
    }
  }
  return out;
}
