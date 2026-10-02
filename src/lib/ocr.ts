/**
 * On-device text recognition for photos of word lists (Tesseract, WebAssembly).
 * Everything is served from this app's own origin (/ocr/); nothing is sent anywhere.
 * Loaded lazily: the engine is only downloaded the first time a student uses it.
 */
import { cardsFromWords, styleWords, toGray, type PageWord, type TermCard } from "./emphasis";
import { groupLabels, type LabelBox, type OcrLabelWord } from "./occlusion";
import { rowsFromWords, type OcrWord } from "./ocrRows";
import type { PSM } from "tesseract.js";
import type { ContentLang } from "./types";

const TESS: Record<ContentLang, string[]> = {
  nl: ["nld"],
  en: ["eng"],
  fr: ["fra"],
  de: ["deu"],
  es: ["spa"],
  it: ["ita"],
  la: ["lat"],
  xx: ["nld", "eng"],
};

export function tesseractLangs(langs: readonly ContentLang[]): string[] {
  return [...new Set(langs.flatMap((l) => TESS[l]))];
}

export interface OcrProgress {
  status: "loading" | "reading";
  /** 0 to 1. */
  progress: number;
}

/** Scales a photo down so recognition stays fast on a phone. */
async function prepare(file: Blob, max = 2200): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

interface TessWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
interface TessBlock {
  paragraphs: { lines: { words: TessWord[] }[] }[];
}

async function worker(langs: readonly ContentLang[], onProgress: (p: OcrProgress) => void) {
  const { createWorker } = await import("tesseract.js");
  const base = new URL("ocr/", document.baseURI).href;
  onProgress({ status: "loading", progress: 0 });
  const worker = await createWorker(tesseractLangs(langs), 1, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
    workerBlobURL: false,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      onProgress({ status: m.status.startsWith("recognizing") ? "reading" : "loading", progress: m.progress });
    },
  });
  return worker;
}

export async function recognizeList(file: Blob, langs: readonly ContentLang[], onProgress: (p: OcrProgress) => void): Promise<string[]> {
  const w = await worker(langs, onProgress);
  try {
    const canvas = await prepare(file);
    const { data } = await w.recognize(canvas, {}, { blocks: true });
    const words: OcrWord[] = [];
    for (const block of (data.blocks ?? []) as TessBlock[]) {
      for (const p of block.paragraphs) for (const l of p.lines) for (const w of l.words) words.push({ text: w.text, confidence: w.confidence, ...w.bbox });
    }
    return rowsFromWords(words);
  } finally {
    await w.terminate();
  }
}

/**
 * A photo of a textbook page: its bold and italic words become terms, explained by the sentence
 * they stand in. Also returns the page's heading, as a name for the list.
 */
export async function recognizeTerms(file: Blob, lang: ContentLang, onProgress: (p: OcrProgress) => void): Promise<{ cards: TermCard[]; title: string; words: number; unclear: boolean }> {
  const w = await worker([lang], onProgress);
  try {
    // More pixels than for a word list: telling bold from regular needs the detail.
    const canvas = await prepare(file, 3000);
    const { data } = await w.recognize(canvas, {}, { blocks: true });
    const words: PageWord[] = [];
    let para = 0;
    let line = 0;
    for (const block of (data.blocks ?? []) as TessBlock[]) {
      for (const p of block.paragraphs) {
        para++;
        for (const l of p.lines) {
          line++;
          for (const x of l.words) if (x.text.trim()) words.push({ text: x.text, confidence: x.confidence, para, line, ...x.bbox });
        }
      }
    }
    const ctx = canvas.getContext("2d")!;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { cards, title, unclear } = cardsFromWords(styleWords(toGray(img.data, canvas.width, canvas.height), words));
    return { cards, title, unclear, words: words.length };
  } finally {
    await w.terminate();
  }
}

/** The labels on a diagram (for "Plaatje met namen"), as boxes in fractions of the picture. */
export async function recognizeLabels(file: Blob, lang: ContentLang, onProgress: (p: OcrProgress) => void): Promise<LabelBox[]> {
  const w = await worker([lang], onProgress);
  try {
    const canvas = await prepare(file, 2600);
    // Sparse text: labels scattered over a picture rather than paragraphs.
    // A fixed resolution, so the engine does not guess (and log about it).
    await w.setParameters({ tessedit_pageseg_mode: "11" as PSM, user_defined_dpi: "300" });
    const { data } = await w.recognize(canvas, {}, { blocks: true });
    const words: OcrLabelWord[] = [];
    let line = 0;
    for (const block of (data.blocks ?? []) as TessBlock[]) {
      for (const p of block.paragraphs) {
        for (const l of p.lines) {
          line++;
          for (const x of l.words) words.push({ text: x.text, confidence: x.confidence, line, ...x.bbox });
        }
      }
    }
    return groupLabels(words, canvas.width, canvas.height);
  } finally {
    await w.terminate();
  }
}
