import { addDays } from "./dates";
import type { Box, Card, Grade } from "./types";

/** Interval in days for boxes 1 to 5. */
export const DAYS = [1, 3, 7, 14, 30] as const;

export function nextBox(box: Box, grade: Grade): Box {
  if (grade === "fout") return 1;
  if (grade === "goed") return Math.min(5, box + 1) as Box;
  return box;
}

/** Pure Leitner step: the card as it should be after this grade on `today` (YYYY-MM-DD). */
export function review<T extends Pick<Card, "box" | "due">>(card: T, grade: Grade, today: string): T {
  const box = nextBox(card.box, grade);
  return { ...card, box, due: addDays(today, DAYS[box - 1]!) };
}

/**
 * Applies one answer. Only the first answer to a card on a given day counts for the Leitner boxes;
 * later answers the same day (practice rounds, repeats) leave box and due untouched.
 */
export function answerCard<T extends Pick<Card, "box" | "due" | "lastDay">>(
  card: T,
  grade: Grade,
  day: string,
): { card: T; counts: boolean; fromBox: Box; toBox: Box } {
  const fromBox = card.box;
  if (card.lastDay === day) return { card: { ...card }, counts: false, fromBox, toBox: fromBox };
  const next = review(card, grade, day);
  return { card: { ...next, lastDay: day }, counts: true, fromBox, toBox: next.box };
}
