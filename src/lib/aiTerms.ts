/**
 * "Slim herkennen": a page photo read by Claude through the account's Edge Function (recognize-terms).
 * This file prepares the photo and checks what comes back; it never trusts the answer blindly.
 */
import { LIMITS } from "../config";
import { blankTerm, shorten, type TermCard } from "./emphasis";

/** Claude scales larger images down to this long side anyway, so sending more only costs time. */
const AI_SIDE = 1568;

/** The photo as a base64 JPEG (without the data: prefix), at most AI_SIDE pixels on its long side. */
export async function pageForAI(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, AI_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1]!;
  } finally {
    bitmap.close();
  }
}

/** Checks and tidies the answer: known shape only, sane lengths, the term blanked in its explanation. */
export function parseAIResult(raw: unknown): { cards: TermCard[]; title: string; readable: boolean } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { readable?: unknown; title?: unknown; terms?: unknown };
  if (!Array.isArray(r.terms)) return null;
  const seen = new Set<string>();
  const cards: TermCard[] = [];
  for (const t of r.terms.slice(0, 80)) {
    if (!t || typeof t !== "object") continue;
    const { term, explanation } = t as { term?: unknown; explanation?: unknown };
    if (typeof term !== "string" || typeof explanation !== "string") continue;
    const front = term.replace(/\s+/g, " ").replace(/[:\s]+$/, "").trim().slice(0, LIMITS.sideChars);
    const back = blankTerm(shorten(explanation.replace(/\s+/g, " ").trim()), front).slice(0, LIMITS.sideChars);
    const key = front.toLocaleLowerCase();
    if (!front || !back || seen.has(key)) continue;
    seen.add(key);
    cards.push({ term: front, explanation: back });
  }
  const title = typeof r.title === "string" ? r.title.replace(/\s+/g, " ").trim().slice(0, LIMITS.deckNameChars) : "";
  return { cards, title, readable: r.readable !== false };
}
