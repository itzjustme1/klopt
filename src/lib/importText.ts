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

/**
 * Separators people use in notes and summaries, for lines without a tab or semicolon:
 * "Blitzkrieg: snelle aanval", "huis = house", "VOC - handelscompagnie", "inflatie – stijgende prijzen".
 * Returns where the separator starts and how long it is.
 */
export function noteSeparator(line: string): { at: number; length: number } | null {
  const m = /\s+[=–—-]\s+|\s*=\s*|:\s+/.exec(line);
  if (!m || m.index === 0) return null;
  return { at: m.index, length: m[0].length };
}

/** Bullets and numbers that start a line in notes: "- ", "• ", "1. ", "a) ". */
const BULLET = /^\s*(?:[-–—•*·▪]|\d{1,3}[.)]|[a-z][.)])\s+/;

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
  // The card a following line may continue (only for cards from notes, not from spreadsheets).
  let lastFromNotes = false;
  let lastLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = i + 1;
    if (raw.trim() === "") continue;

    let at = separatorIndex(raw);
    let sepLength = 1;
    let text = raw;
    let fromNotes = false;
    if (at === -1) {
      text = raw.replace(BULLET, "");
      const note = noteSeparator(text);
      if (!note) {
        // In notes, an explanation often runs on to the next line: keep it with its term.
        const prev = cards.at(-1);
        const t = raw.trim();
        // A run-on starts in lowercase, or finishes a sentence the card left open; a heading does neither.
        const runsOn = /^\p{Ll}/u.test(t) || (!/[.!?]$/.test(prev?.back ?? "") && /[.!?]$/.test(t));
        if (prev && lastFromNotes && runsOn && prev.line === lastLine && prev.back.length + raw.length < LIMITS.sideChars) {
          prev.back = `${prev.back} ${raw.trim()}`;
          lastLine = line;
          continue;
        }
        skipped.push({ line, reason: "noSeparator" });
        continue;
      }
      at = note.at;
      sepLength = note.length;
      fromNotes = true;
    }
    const front = unquote(text.slice(0, at));
    const back = unquote(text.slice(at + sepLength));
    if (!front) skipped.push({ line, reason: "emptyFront" });
    else if (!back) skipped.push({ line, reason: "emptyBack" });
    else if (front.length > LIMITS.sideChars || back.length > LIMITS.sideChars) skipped.push({ line, reason: "tooLong" });
    else {
      const key = cardKey(front, back);
      if (seen.has(key)) skipped.push({ line, reason: "duplicate" });
      else {
        seen.add(key);
        cards.push({ line, front, back });
        lastFromNotes = fromNotes;
        lastLine = line;
      }
    }
  }

  return { cards, skipped, tooMany: cards.length > LIMITS.importCards, tooBig: false };
}
