/**
 * Checks a typed answer against the expected one, the way a teacher would:
 * case, extra spaces, trailing punctuation and optional parts in brackets don't matter;
 * several accepted answers can be separated with "/", ";" or ",".
 * A missing accent or a single typo counts as "close", never silently as right.
 */

export type Verdict = "correct" | "close" | "wrong";

export interface CheckResult {
  verdict: Verdict;
  /** Why it was close. */
  note?: "accents" | "typo";
}

const QUOTES: [RegExp, string][] = [
  [/[‘’‚`´]/g, "'"],
  [/[“”„]/g, '"'],
  [/[‐‑‒–—]/g, "-"],
];

export function normalize(s: string): string {
  let out = s.normalize("NFC").toLowerCase();
  for (const [re, to] of QUOTES) out = out.replace(re, to);
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/^[\s.,;:!?¿¡"']+|[\s.,;:!?"']+$/g, "");
  return out;
}

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/œ/g, "oe").replace(/æ/g, "ae");
}

/** All accepted forms of an expected answer. */
export function alternatives(expected: string): string[] {
  const forms = new Set<string>();
  const add = (s: string) => {
    const n = normalize(s);
    if (n) forms.add(n);
  };
  // Split on "/" and ";", and on commas that are not a decimal comma ("1,5" stays whole).
  const parts = [expected, ...expected.split(/[/;]|(?<!\d),|,(?!\d)/)];
  for (const part of parts) {
    add(part);
    if (/[()]/.test(part)) {
      // "(de) auto" accepts "auto" and "de auto".
      add(part.replace(/\([^)]*\)/g, " "));
      add(part.replace(/[()]/g, " "));
    }
  }
  return [...forms];
}

/** Edit distance where swapping two neighbouring letters counts as one typo (optimal string alignment). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

export function checkAnswer(given: string, expected: string): CheckResult {
  const g = normalize(given);
  if (!g) return { verdict: "wrong" };
  const forms = alternatives(expected);
  if (forms.includes(g)) return { verdict: "correct" };
  const gBare = stripAccents(g);
  if (forms.some((f) => stripAccents(f) === gBare)) return { verdict: "close", note: "accents" };
  for (const f of forms) {
    const allowed = f.length >= 10 ? 2 : f.length >= 5 ? 1 : 0;
    if (allowed > 0 && levenshtein(stripAccents(f), gBare) <= allowed) return { verdict: "close", note: "typo" };
  }
  return { verdict: "wrong" };
}

/** Short answers can be typed; long definitions are checked by the student themselves. */
export function isTypeable(answer: string): boolean {
  const t = answer.trim();
  return t.length > 0 && t.length <= 40 && t.split(/\s+/).length <= 6 && !t.includes("\n");
}

/** Letters revealed by a hint: the first `n` characters (spaces kept), the rest as dots. */
export function hintText(answer: string, n: number): string {
  const first = answer.split(/[/;]|(?<!\d),|,(?!\d)/)[0]!.trim();
  return [...first].map((ch, i) => (i < n || ch === " " ? ch : "·")).join("");
}
