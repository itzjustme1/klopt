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

/**
 * Index of the first separator outside double quotes: a tab if there is one, otherwise a semicolon.
 * Spreadsheets quote cells that contain a separator ("a;b";c), so those don't split the line.
 */
export function separatorIndex(line: string): number {
  const find = (sep: string) => {
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') quoted = !quoted;
      else if (ch === sep && !quoted) return i;
    }
    return -1;
  };
  const tab = find("\t");
  return tab !== -1 ? tab : find(";");
}

/** Removes spreadsheet quoting: "say ""hi""" becomes say "hi". Unquoted text is left alone. */
export function unquote(side: string): string {
  const s = side.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/""/g, '"').trim();
  return s;
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

    const at = separatorIndex(raw);
    if (at === -1) {
      skipped.push({ line, reason: "noSeparator" });
      continue;
    }
    const front = unquote(raw.slice(0, at));
    const back = unquote(raw.slice(at + 1));
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
