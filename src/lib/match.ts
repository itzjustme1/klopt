/**
 * The matching game: tap a word, then its translation. Pure and seedable, like the practice engine.
 * Words are played in rounds of up to six pairs.
 */
import type { PracticeCard } from "./practice";
import type { Rng } from "./session";
import type { ContentLang, Grade } from "./types";

export const PAIRS_PER_ROUND = 6;

export interface Tile {
  id: string;
  cardId: string;
  side: "front" | "back";
  text: string;
  lang: ContentLang;
}

export type SelectResult =
  | { kind: "selected" }
  | { kind: "deselected" }
  | { kind: "match"; cardId: string; grade: Grade }
  | { kind: "mismatch"; tiles: [string, string] };

export class MatchGame {
  readonly rounds: PracticeCard[][];
  round = 0;
  tiles: Tile[] = [];
  readonly matched = new Set<string>();
  selected: string | null = null;
  /** Wrong pairings per card; a card with any gets "fout" when finally matched. */
  readonly misses = new Map<string, number>();
  mistakes = 0;

  constructor(
    cards: readonly PracticeCard[],
    private readonly rng: Rng = Math.random,
  ) {
    const deck = shuffle([...cards], rng);
    this.rounds = [];
    for (let i = 0; i < deck.length; i += PAIRS_PER_ROUND) this.rounds.push(deck.slice(i, i + PAIRS_PER_ROUND));
    // A last round of one pair isn't a game: fold it into the previous round.
    const last = this.rounds[this.rounds.length - 1];
    if (this.rounds.length > 1 && last && last.length === 1) {
      this.rounds.pop();
      this.rounds[this.rounds.length - 1]!.push(last[0]!);
    }
    this.deal();
  }

  get total(): number {
    return this.rounds.reduce((n, r) => n + r.length, 0);
  }

  get roundDone(): boolean {
    return this.tiles.every((t) => this.matched.has(t.cardId));
  }

  get finished(): boolean {
    return this.round >= this.rounds.length - 1 && this.roundDone;
  }

  /** Moves to the next round once the current one is done. Returns false at the end. */
  nextRound(): boolean {
    if (!this.roundDone || this.round >= this.rounds.length - 1) return false;
    this.round++;
    this.deal();
    return true;
  }

  select(tileId: string): SelectResult {
    const tile = this.tiles.find((t) => t.id === tileId);
    if (!tile || this.matched.has(tile.cardId)) return { kind: "deselected" };
    if (this.selected === null) {
      this.selected = tileId;
      return { kind: "selected" };
    }
    if (this.selected === tileId) {
      this.selected = null;
      return { kind: "deselected" };
    }
    const first = this.tiles.find((t) => t.id === this.selected)!;
    this.selected = null;
    if (first.side === tile.side) {
      // Two words from the same column: switch the selection instead of counting a mistake.
      this.selected = tileId;
      return { kind: "selected" };
    }
    if (first.cardId === tile.cardId) {
      this.matched.add(tile.cardId);
      return { kind: "match", cardId: tile.cardId, grade: this.misses.get(tile.cardId) ? "fout" : "goed" };
    }
    this.mistakes++;
    for (const id of [first.cardId, tile.cardId]) this.misses.set(id, (this.misses.get(id) ?? 0) + 1);
    return { kind: "mismatch", tiles: [first.id, tile.id] };
  }

  private deal(): void {
    const cards = this.rounds[this.round] ?? [];
    const tiles: Tile[] = [];
    for (const c of cards) {
      tiles.push({ id: `${c.id}:f`, cardId: c.id, side: "front", text: c.front, lang: c.langFront });
      tiles.push({ id: `${c.id}:b`, cardId: c.id, side: "back", text: c.back, lang: c.langBack });
    }
    this.tiles = shuffle(tiles, this.rng);
    this.selected = null;
  }
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
