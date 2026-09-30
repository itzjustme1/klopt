import type { Card } from "./types";

export type Rng = () => number;

/** Cards due on or before today, lowest box first, shuffled within each box. */
export function buildSession<T extends Pick<Card, "box" | "due">>(cards: readonly T[], today: string, rng: Rng = Math.random): T[] {
  const byBox = new Map<number, T[]>();
  for (const c of cards) {
    if (c.due > today) continue;
    const list = byBox.get(c.box) ?? [];
    list.push(c);
    byBox.set(c.box, list);
  }
  const out: T[] = [];
  for (const box of [1, 2, 3, 4, 5]) {
    const list = byBox.get(box);
    if (list) out.push(...shuffle(list, rng));
  }
  return out;
}

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function isDue(card: Pick<Card, "due">, today: string): boolean {
  return card.due <= today;
}
