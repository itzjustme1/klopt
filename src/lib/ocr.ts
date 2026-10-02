/**
 * On-device text recognition for photos of word lists (Tesseract, WebAssembly).
 * Everything is served from this app's own origin (/ocr/); nothing is sent anywhere.
 * Loaded lazily: the engine is only downloaded the first time a student uses it.
 */
import { cardsFromWords, relayout, styleWords, toGray, type PageWord, type TermCard } from "./emphasis";
import { lineAngle, uprightCandidates } from "./orient";
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
  try {
    return render(bitmap, 0, Math.min(1, max / Math.max(bitmap.width, bitmap.height)));
  } finally {
    bitmap.close();
  }
}

/** Draws a picture turned by `deg` degrees clockwise and scaled, on white. */
function render(src: ImageBitmap | HTMLCanvasElement, deg: number, scale: number): HTMLCanvasElement {
  const a = (deg * Math.PI) / 180;
  const w = src.width * scale;
  const h = src.height * scale;
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * cos + h * sin);
  canvas.height = Math.round(w * sin + h * cos);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(a);
  ctx.drawImage(src, -w / 2, -h / 2, w, h);
  return canvas;
}

type TessWorker = Awaited<ReturnType<typeof worker>>;

/**
 * A photo of a page, ready to read: turned so the lines are horizontal and the right way up (a photo
 * sent through WhatsApp often arrives on its side), and scaled so letters are big enough to read and
 * measure: small photos are enlarged (up to twice), big ones made smaller.
 */
async function uprightPage(file: Blob, w: TessWorker, size: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  try {
    const small = render(bitmap, 0, Math.min(1, 800 / Math.max(bitmap.width, bitmap.height)));
    const img = small.getContext("2d")!.getImageData(0, 0, small.width, small.height);
    const angle = lineAngle(toGray(img.data, small.width, small.height)) ?? 0;
    // A tilt under half a degree is not worth the resampling.
    const [up, down] = uprightCandidates(Math.abs(angle) < 0.5 ? 0 : angle);
    let turn = up;
    {
      // Which way up: read a strip from the middle, and the other way round when that reads badly.
      const sample = (deg: number) => {
        const c = render(bitmap, deg, Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)));
        const crop = document.createElement("canvas");
        crop.width = Math.round(c.width * 0.7);
        crop.height = Math.round(c.height * 0.35);
        crop.getContext("2d")!.drawImage(c, (c.width - crop.width) / 2, (c.height - crop.height) / 2, crop.width, crop.height, 0, 0, crop.width, crop.height);
        return w.recognize(crop).then((r) => r.data.confidence);
      };
      const first = await sample(up);
      if (first < 70) {
        const second = await sample(down);
        if (second > first) turn = down;
      }
    }
    const long = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(2, size / long);
    return render(bitmap, turn, scale);
  } finally {
    bitmap.close();
  }
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
    const canvas = await uprightPage(file, w, 2200);
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
    const canvas = await uprightPage(file, w, 3000);
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
    const styled = styleWords(toGray(img.data, canvas.width, canvas.height), relayout(words));
    const res = cardsFromWords(styled);
    // A blurry photo where nothing could be found: say so, with tips, rather than "no terms".
    const unclear = res.unclear || (!!styled.blurry && res.cards.length === 0);
    const { cards, title } = res;
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
