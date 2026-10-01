import { checkAnswer, type CheckOptions } from "./answer";
import type { QuizQuestion } from "./types";

export const QUIZ_LIMITS = { questions: 200, options: 6, blanks: 10, text: 2000 } as const;

export type ClozePart = { text: string } | { blank: string };

/** Splits fill-in text into plain parts and blanks ("[answer]"). Brackets without content stay text. */
export function clozeParts(text: string): ClozePart[] {
  const parts: ClozePart[] = [];
  const re = /\[([^\]\n]+)\]/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ blank: m[1]!.trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export function blanksOf(text: string): string[] {
  return clozeParts(text).flatMap((p) => ("blank" in p ? [p.blank] : []));
}

/** What a question is worth for a given response: 1, 0, or a fraction for fill-ins with several blanks. */
export type Response =
  | { type: "mc"; chosen: number }
  | { type: "open"; selfGrade: "goed" | "fout" }
  | { type: "cloze"; given: string[] }
  | { type: "tf"; chosen: boolean }
  | { type: "dictee"; given: string };

export interface Marked {
  points: number;
  /** Per blank, for fill-ins: right (accents and small typos per the settings count as right). */
  blanks?: boolean[];
}

export function mark(q: QuizQuestion, r: Response, opts: CheckOptions = {}): Marked {
  if (q.type === "mc" && r.type === "mc") return { points: r.chosen === q.correct ? 1 : 0 };
  if (q.type === "tf" && r.type === "tf") return { points: r.chosen === q.answer ? 1 : 0 };
  if (q.type === "open" && r.type === "open") return { points: r.selfGrade === "goed" ? 1 : 0 };
  if (q.type === "cloze" && r.type === "cloze") {
    const answers = blanksOf(q.text);
    const blanks = answers.map((a, i) => {
      const given = (r.given[i] ?? "").trim();
      return given !== "" && checkAnswer(given, a, opts).verdict !== "wrong";
    });
    const right = blanks.filter(Boolean).length;
    return { points: answers.length ? right / answers.length : 0, blanks };
  }
  if (q.type === "dictee" && r.type === "dictee") {
    // Spelling is the point: a typo the settings let through counts half.
    const given = r.given.trim();
    if (!given) return { points: 0 };
    const v = checkAnswer(given, q.text, opts).verdict;
    return { points: v === "correct" ? 1 : v === "close" ? 0.5 : 0 };
  }
  return { points: 0 };
}

/** Dutch school grade from points: 1 + 9 × the share right, one decimal. */
export function quizGrade(points: number, total: number): number {
  if (total <= 0) return 1;
  return Math.round((1 + (9 * points) / total) * 10) / 10;
}

/** Problems that keep a question from being saved, as message keys with a question number. */
export function questionProblem(q: QuizQuestion): "empty" | "options" | "blanks" | null {
  switch (q.type) {
    case "mc": {
      const filled = q.options.filter((o) => o.trim());
      if (!q.prompt.trim()) return "empty";
      if (filled.length < 2 || !q.options[q.correct]?.trim()) return "options";
      return null;
    }
    case "open":
      return q.prompt.trim() && q.answer.trim() ? null : "empty";
    case "tf":
      return q.prompt.trim() ? null : "empty";
    case "cloze":
      return blanksOf(q.text).length ? null : "blanks";
    case "dictee":
      return q.text.trim() ? null : "empty";
  }
}

/** One line that shows what a question is about: fill-ins with their blanks as dots. */
export function questionPreview(q: QuizQuestion): string {
  if (q.type === "cloze") return q.text.replace(/\[[^\]\n]+\]/g, "…");
  if (q.type === "dictee") return q.text;
  return q.prompt;
}
