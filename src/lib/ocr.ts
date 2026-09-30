/**
 * On-device text recognition for photos of word lists (Tesseract, WebAssembly).
 * Everything is served from this app's own origin (/ocr/); nothing is sent anywhere.
 * Loaded lazily: the engine is only downloaded the first time a student uses it.
 */
import { rowsFromWords, type OcrWord } from "./ocrRows";
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
async function prepare(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const max = 2200;
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

export async function recognizeList(file: Blob, langs: readonly ContentLang[], onProgress: (p: OcrProgress) => void): Promise<string[]> {
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
  try {
    const canvas = await prepare(file);
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    const words: OcrWord[] = [];
    for (const block of (data.blocks ?? []) as TessBlock[]) {
      for (const p of block.paragraphs) for (const l of p.lines) for (const w of l.words) words.push({ text: w.text, confidence: w.confidence, ...w.bbox });
    }
    return rowsFromWords(words);
  } finally {
    await worker.terminate();
  }
}
