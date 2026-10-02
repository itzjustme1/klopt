/**
 * Turns OCR word boxes from a photo of a word list into "term<TAB>translation" lines.
 * Two-column lists are split on the empty band between the columns; single-column
 * lists written as "huis - house" are split on the dash.
 */

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence?: number;
}

interface Line {
  words: OcrWord[];
  yc: number;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function groupLines(words: OcrWord[]): Line[] {
  const h = median(words.map((w) => w.y1 - w.y0)) || 1;
  const sorted = [...words].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  const lines: Line[] = [];
  for (const w of sorted) {
    const yc = (w.y0 + w.y1) / 2;
    const line = lines[lines.length - 1];
    if (line && Math.abs(yc - line.yc) < h * 0.55) {
      line.words.push(w);
      line.yc = (line.yc * (line.words.length - 1) + yc) / line.words.length;
    } else {
      lines.push({ words: [w], yc });
    }
  }
  for (const l of lines) l.words.sort((a, b) => a.x0 - b.x0);
  return lines;
}

const DASH = /\s+[-–—=:]\s+/;

export function rowsFromWords(input: OcrWord[]): string[] {
  // Drop specks and words the recogniser was unsure of (text in a picture, a smudge).
  const words = input.filter((w) => w.text.trim() && !(w.confidence !== undefined && (w.confidence < 45 || (w.confidence < 30 && !/[\p{L}\p{N}]/u.test(w.text)))));
  if (!words.length) return [];
  const lines = groupLines(words);
  const charW = median(words.map((w) => (w.x1 - w.x0) / Math.max(1, w.text.length))) || 1;

  // Candidate column splits: the widest gap in each line, if it is clearly wider than a word space.
  const gaps: number[] = [];
  for (const l of lines) {
    let best = 0;
    let at = 0;
    for (let i = 1; i < l.words.length; i++) {
      const gap = l.words[i]!.x0 - l.words[i - 1]!.x1;
      if (gap > best) {
        best = gap;
        at = (l.words[i]!.x0 + l.words[i - 1]!.x1) / 2;
      }
    }
    if (best > charW * 3) gaps.push(at);
  }
  const twoColumns = gaps.length >= Math.max(2, lines.length * 0.4);
  const split = median(gaps);

  const rows: [string, string][] = [];
  for (const l of lines) {
    const text = l.words.map((w) => w.text).join(" ");
    if (!twoColumns) {
      const m = DASH.exec(text);
      rows.push(m ? [text.slice(0, m.index).trim(), text.slice(m.index + m[0].length).trim()] : [text.trim(), ""]);
      continue;
    }
    const left = l.words.filter((w) => (w.x0 + w.x1) / 2 < split).map((w) => w.text).join(" ");
    const right = l.words.filter((w) => (w.x0 + w.x1) / 2 >= split).map((w) => w.text).join(" ");
    const prev = rows[rows.length - 1];
    if (!left && right && prev) {
      // A wrapped translation continues the previous row.
      prev[1] = `${prev[1]} ${right}`.trim();
    } else {
      rows.push([left.trim(), right.trim()]);
    }
  }
  return rows.filter(([a, b]) => a || b).map(([a, b]) => (b ? `${a}\t${b}` : a));
}
