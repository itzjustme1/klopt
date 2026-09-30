import { LIMITS } from "../config";

export type SkipReason = "noSeparator" | "emptyFront" | "emptyBack" | "tooLong" | "duplicate";

export interface ParsedCard {
  line: number;
  front: string;
  back: string;
}

export interface ParseResult {
  cards: ParsedCard[];
  skipped: { line: number; reason: SkipReason }[];
  /** More recognised cards than one import allows. */
  tooMany: boolean;
  /** Raw text over the size cap; nothing was parsed. */
  tooBig: boolean;
}

export function cardKey(front: string, back: string): string {
  return `${front}\u0000${back}`;
}

/**
 * One card per line. A tab separates term and definition; if a line has no tab, the first
 * semicolon does. Tab wins because definitions often contain semicolons. Text is never interpreted.
 */
export function parseImport(text: string, existing: ReadonlySet<string> = new Set()): ParseResult {
  if (text.length > LIMITS.importRawChars) return { cards: [], skipped: [], tooMany: false, tooBig: true };

  const cards: ParsedCard[] = [];
  const skipped: ParseResult["skipped"] = [];
  const seen = new Set(existing);
  const lines = text.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = i + 1;
    if (raw.trim() === "") continue;

    let at = raw.indexOf("\t");
    if (at === -1) at = raw.indexOf(";");
    if (at === -1) {
      skipped.push({ line, reason: "noSeparator" });
      continue;
    }
    const front = raw.slice(0, at).trim();
    const back = raw.slice(at + 1).trim();
    if (!front) skipped.push({ line, reason: "emptyFront" });
    else if (!back) skipped.push({ line, reason: "emptyBack" });
    else if (front.length > LIMITS.sideChars || back.length > LIMITS.sideChars) skipped.push({ line, reason: "tooLong" });
    else {
      const key = cardKey(front, back);
      if (seen.has(key)) skipped.push({ line, reason: "duplicate" });
      else {
        seen.add(key);
        cards.push({ line, front, back });
      }
    }
  }

  return { cards, skipped, tooMany: cards.length > LIMITS.importCards, tooBig: false };
}
