import { addDays } from "./dates";
import type { Card, DayStat, Grade, Review } from "./types";

const HIST_LEN = 8;
const CODE: Record<Grade, string> = { goed: "g", twijfel: "t", fout: "f" };

export type Difficulty = "nieuw" | "vaak" | "soms" | "goed";

export function appendHist(hist: string | undefined, grade: Grade): string {
  return ((hist ?? "") + CODE[grade]).slice(-HIST_LEN);
}

/**
 * How hard a card is for this student, from its recent answers:
 * - nieuw: never answered
 * - vaak: the last answer was wrong, or at least half of the recent ones
 * - soms: some recent answer was wrong or unsure
 * - goed: everything recent was right
 */
export function difficulty(hist: string | undefined): Difficulty {
  if (!hist) return "nieuw";
  const wrong = [...hist].filter((c) => c === "f").length;
  if (hist.endsWith("f") || wrong * 2 >= hist.length) return "vaak";
  if (wrong > 0 || hist.includes("t")) return "soms";
  return "goed";
}

export function isHard(hist: string | undefined): boolean {
  const d = difficulty(hist);
  return d === "vaak" || d === "soms";
}

/** Rebuilds the per-card caches and the per-day stats from the review log. */
export function rebuildCaches(reviews: readonly Review[]): {
  cards: Map<string, Pick<Card, "hist" | "lastDay">>;
  days: DayStat[];
} {
  const sorted = [...reviews].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const cards = new Map<string, Pick<Card, "hist" | "lastDay">>();
  const days = new Map<string, DayStat>();
  for (const r of sorted) {
    const c = cards.get(r.cardId) ?? {};
    cards.set(r.cardId, { hist: appendHist(c.hist, r.grade), lastDay: r.day });
    const d = days.get(r.day) ?? { day: r.day, answers: 0, correct: 0 };
    d.answers++;
    if (r.grade === "goed") d.correct++;
    days.set(r.day, d);
  }
  return { cards, days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)) };
}

/**
 * Current streak: consecutive days with at least one answer, ending today.
 * If today has no answers yet, a streak that ended yesterday still counts (it can still be kept).
 */
export function streak(practiced: ReadonlySet<string>, today: string): { days: number; today: boolean } {
  const doneToday = practiced.has(today);
  let day = doneToday ? today : addDays(today, -1);
  let n = 0;
  while (practiced.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return { days: n, today: doneToday };
}

/** The seven days of the current week, Monday first. */
export function weekDays(today: string): string[] {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -weekday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
