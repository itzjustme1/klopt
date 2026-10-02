/**
 * Makes a practice test from a list, without any AI: the questions come from the list itself.
 * - term lists: "which term fits this explanation" and the other way round (multiple choice),
 *   the explanation with the term to fill in, and true-or-false pairings;
 * - word lists: translate (multiple choice both ways) and fill in the translation;
 * - verb lists: fill in a form of a verb.
 * Wrong options are other answers from the same list, so they are plausible.
 * Pure, with injectable randomness.
 */
import { QUIZ_LIMITS, questionProblem } from "./quiz";
import { shuffle, type Rng } from "./session";
import type { Card, Deck, QuizQuestion } from "./types";

export interface GenLabels {
  /** "Welk begrip past bij deze uitleg?" */
  whichTerm: string;
  /** "Wat betekent {term}?" */
  whatMeans: (term: string) => string;
  /** "Wat is {word} in het {lang}?" */
  translate: (word: string) => string;
  /** "{term} betekent: {explanation}" */
  pairing: (term: string, explanation: string) => string;
}

type GenCard = Pick<Card, "front" | "back"> & Partial<Pick<Card, "forms">>;

/** Brackets would turn into blanks in a fill-in question. */
const clean = (s: string) => s.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
const fits = (s: string) => s.length > 0 && s.length <= QUIZ_LIMITS.text;

export function generateQuiz(deck: Pick<Deck, "kind" | "columns">, cards: readonly GenCard[], labels: GenLabels, newId: () => string, rng: Rng = Math.random, max = 20): QuizQuestion[] {
  const usable = cards.map((c) => ({ ...c, front: clean(c.front), back: clean(c.back) })).filter((c) => fits(c.front) && fits(c.back));
  if (!usable.length) return [];
  const picked = shuffle(usable, rng).slice(0, max);
  const mcPossible = usable.length >= 4;

  /** Three other answers from the list, different from the right one. */
  const others = (side: "front" | "back", right: string): string[] =>
    shuffle(
      [...new Set(usable.map((c) => c[side]).filter((v) => v.toLocaleLowerCase() !== right.toLocaleLowerCase()))],
      rng,
    ).slice(0, 3);
  const mc = (prompt: string, right: string, wrong: string[]): QuizQuestion => {
    const options = shuffle([right, ...wrong], rng);
    return { id: newId(), type: "mc", prompt, options, correct: options.indexOf(right) };
  };

  const out: QuizQuestion[] = [];
  picked.forEach((c, i) => {
    let q: QuizQuestion | null = null;
    if (deck.kind === "forms" && c.forms?.some((f) => f.trim())) {
      const cols = deck.columns ?? [];
      const k = shuffle(c.forms.map((f, j) => j).filter((j) => c.forms![j]!.trim() && cols[j]), rng)[0];
      if (k !== undefined) q = { id: newId(), type: "cloze", text: `${c.front} (${clean(cols[k]!)}): [${clean(c.forms[k]!)}]` };
    } else if (deck.kind === "terms") {
      const kind = i % 4;
      if (kind === 0 && c.back.includes("…")) q = { id: newId(), type: "cloze", text: c.back.replaceAll("…", `[${c.front}]`) };
      else if (kind <= 1 && mcPossible) q = mc(`${labels.whichTerm}\n${c.back}`, c.front, others("front", c.front));
      else if (kind === 2 && mcPossible) q = mc(labels.whatMeans(c.front), c.back, others("back", c.back));
      else {
        // True or false: half the time the explanation of another term.
        const wrong = usable.length > 1 && rng() < 0.5 ? shuffle(usable.filter((o) => o.back !== c.back), rng)[0] : undefined;
        q = { id: newId(), type: "tf", prompt: labels.pairing(c.front, wrong?.back ?? c.back), answer: !wrong };
      }
    } else {
      const kind = i % 3;
      if (kind === 0 && mcPossible) q = mc(labels.translate(c.front), c.back, others("back", c.back));
      else if (kind === 1 && mcPossible) q = mc(labels.translate(c.back), c.front, others("front", c.front));
      else q = { id: newId(), type: "cloze", text: `${c.front} = [${c.back}]` };
    }
    if (q && !questionProblem(q) && (q.type !== "cloze" || q.text.length <= QUIZ_LIMITS.text)) out.push(q);
  });
  return out;
}
