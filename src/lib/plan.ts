import { addDays, diffDays } from "./dates";
import { difficulty } from "./history";
import type { Card } from "./types";

export interface ExamPlan {
  /** Days until the test; 0 means the test is today. */
  daysLeft: number;
  /** Words not yet known: not practised, or still getting them wrong, or only just learned. */
  toLearn: number;
  /** Words to practise today to be ready in time. */
  target: number;
  /** Words of this list practised today. */
  doneToday: number;
}

/** A word counts as known when its recent answers were right and it has moved past box 1. */
export function isKnown(c: Pick<Card, "hist" | "box">): boolean {
  return difficulty(c.hist) === "goed" && c.box >= 2;
}

/** Spreads the unknown words over the days left, with a sensible minimum per day. Null when the test is past. */
export function examPlan(cards: readonly Pick<Card, "hist" | "box" | "lastDay">[], today: string, examDate: string): ExamPlan | null {
  const daysLeft = diffDays(today, examDate);
  if (daysLeft < 0) return null;
  const toLearn = cards.filter((c) => !isKnown(c)).length;
  const doneToday = cards.filter((c) => c.lastDay === today).length;
  // Today's target is fixed for the whole day: count what was still unknown this morning,
  // so it doesn't shrink while the student is practising.
  const learnedToday = cards.filter((c) => c.lastDay === today && isKnown(c)).length;
  const atStart = toLearn + learnedToday;
  const sessions = Math.max(1, daysLeft);
  const target = atStart === 0 ? 0 : Math.max(Math.ceil(atStart / sessions), Math.min(5, atStart));
  return { daysLeft, toLearn, target: toLearn === 0 ? 0 : target, doneToday };
}

/** Number of cards due on each of the next `days` days; today includes everything overdue. */
export function forecast(cards: readonly Pick<Card, "due">[], today: string, days = 7): { day: string; count: number }[] {
  const out = Array.from({ length: days }, (_, i) => ({ day: addDays(today, i), count: 0 }));
  const last = out[out.length - 1]!.day;
  for (const c of cards) {
    if (c.due <= today) out[0]!.count++;
    else if (c.due <= last) out[diffDays(today, c.due)]!.count++;
  }
  return out;
}
