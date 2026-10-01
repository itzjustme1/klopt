import { checkAnswer, type CheckOptions } from "./answer";
import { shuffle, type Rng } from "./session";
import type { Grade } from "./types";

/** One row to fill in: a verb (front), its meaning (back) and its forms, one per column. */
export interface FormsCard {
  id: string;
  front: string;
  back: string;
  forms: string[];
}

export interface FormsResult {
  /** Per column: right, wrong, or null where the column doesn't apply. */
  right: (boolean | null)[];
  grade: Grade;
}

/** Marks a filled-in row. All asked forms right: goed; at least half: twijfel; otherwise fout. */
export function markRow(card: FormsCard, given: readonly string[], opts: CheckOptions = {}): FormsResult {
  const right = card.forms.map((form, i) => {
    if (!form.trim()) return null;
    const g = (given[i] ?? "").trim();
    // Exact, as a teacher marks a verb table: a missing accent only counts with the lenient setting.
    return g !== "" && checkAnswer(g, form, opts).verdict === "correct";
  });
  const asked = right.filter((r) => r !== null);
  const ok = asked.filter(Boolean).length;
  const grade: Grade = ok === asked.length ? "goed" : ok * 2 >= asked.length ? "twijfel" : "fout";
  return { right, grade };
}

/** A round of rows. A row that isn't fully right comes back at the end until it is. */
export class FormsDrill {
  queue: FormsCard[];
  readonly total: number;
  done = 0;
  right = 0;
  wrong = 0;
  /** The first grade per row, for the result. */
  readonly first = new Map<string, Grade>();

  constructor(cards: readonly FormsCard[], rng: Rng = Math.random) {
    const usable = cards.filter((c) => c.forms.some((f) => f.trim()));
    this.queue = shuffle([...usable], rng);
    this.total = usable.length;
  }

  get current(): FormsCard | null {
    return this.queue[0] ?? null;
  }

  answer(result: FormsResult): void {
    const card = this.queue.shift();
    if (!card) return;
    if (!this.first.has(card.id)) this.first.set(card.id, result.grade);
    if (result.grade === "goed") {
      this.right++;
      this.done++;
    } else {
      this.wrong++;
      this.queue.push(card);
    }
  }
}
