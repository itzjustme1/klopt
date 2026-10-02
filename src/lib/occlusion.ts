/**
 * "Plaatje met namen": a diagram whose labels are covered one at a time, so each label becomes a card
 * ("what is this?"). The labels are found with the on-device text recogniser and can be adjusted by
 * hand. Boxes are kept as fractions of the picture, so they stay right at any size.
 */
import { LIMITS } from "../config";

export interface OcrLabelWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  line: number;
  confidence?: number;
}

export interface LabelBox {
  /** Position and size as fractions (0 to 1) of the picture. */
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

const letters = (s: string) => [...s].filter((c) => /\p{L}/u.test(c)).length;

/**
 * Groups recognised words into labels: words on the same line that sit close together
 * ("rechter boezem") are one label; words far apart on a line are separate labels.
 */
export function groupLabels(words: readonly OcrLabelWord[], width: number, height: number): LabelBox[] {
  const usable = words.filter((w) => w.text.trim() && letters(w.text) >= 1 && !(w.confidence !== undefined && w.confidence < 55));
  const groups: OcrLabelWord[][] = [];
  for (const w of usable) {
    const g = groups.at(-1);
    const prev = g?.at(-1);
    const h = w.y1 - w.y0;
    if (g && prev && prev.line === w.line && w.x0 - prev.x1 < h * 1.2) g.push(w);
    else groups.push([w]);
  }
  return groups
    .map((g) => {
      const text = g.map((w) => w.text).join(" ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, "");
      const x0 = Math.min(...g.map((w) => w.x0));
      const y0 = Math.min(...g.map((w) => w.y0));
      const x1 = Math.max(...g.map((w) => w.x1));
      const y1 = Math.max(...g.map((w) => w.y1));
      // A little room around the text, so no letter peeks out from under the cover.
      const pad = (y1 - y0) * 0.25;
      const bx0 = Math.max(0, x0 - pad);
      const by0 = Math.max(0, y0 - pad);
      const bx1 = Math.min(width, x1 + pad);
      const by1 = Math.min(height, y1 + pad);
      return { x: bx0 / width, y: by0 / height, w: (bx1 - bx0) / width, h: (by1 - by0) / height, text };
    })
    .filter((b) => letters(b.text) >= 2);
}

/** The largest side of a covered picture: more than a plain card picture, so small parts stay visible. */
const MAX_SIDE = 960;

/**
 * Draws the picture with every label covered, and the one asked (`ask`) marked with a question mark.
 * Returns a JPEG data URL that fits a card.
 */
export function coveredPicture(img: CanvasImageSource, width: number, height: number, boxes: readonly Pick<LabelBox, "x" | "y" | "w" | "h">[], ask: number): string {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  boxes.forEach((b, i) => {
    const x = b.x * w;
    const y = b.y * h;
    const bw = b.w * w;
    const bh = b.h * h;
    const asked = i === ask;
    ctx.fillStyle = asked ? "#1f5cff" : "#dfe5f2";
    ctx.strokeStyle = asked ? "#0b1736" : "#9aa8c7";
    ctx.lineWidth = Math.max(1.5, Math.min(w, h) / 300);
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, Math.min(6, bh / 4));
    ctx.fill();
    ctx.stroke();
    if (asked) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 ${Math.max(12, Math.min(bh * 0.75, 40))}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", x + bw / 2, y + bh / 2 + 1);
    }
  });
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= LIMITS.imageChars) return url;
  }
  throw new Error("Picture too large");
}
