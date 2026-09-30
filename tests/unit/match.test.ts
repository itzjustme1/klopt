import { describe, expect, it } from "vitest";
import { MatchGame } from "../../src/lib/match";
import type { PracticeCard } from "../../src/lib/practice";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}
const cards = (n: number): PracticeCard[] => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, front: `w${i}`, back: `v${i}`, langFront: "fr", langBack: "nl" }));

describe("MatchGame", () => {
  it("deals rounds of up to six pairs, folding a lone last pair into the previous round", () => {
    expect(new MatchGame(cards(12), seeded(1)).rounds.map((r) => r.length)).toEqual([6, 6]);
    expect(new MatchGame(cards(13), seeded(1)).rounds.map((r) => r.length)).toEqual([6, 7]);
    expect(new MatchGame(cards(8), seeded(1)).rounds.map((r) => r.length)).toEqual([6, 2]);
    expect(new MatchGame(cards(4), seeded(1)).tiles).toHaveLength(8);
  });

  it("matches a word with its translation and grades it right without mistakes", () => {
    const g = new MatchGame(cards(3), seeded(2));
    expect(g.select("c1:f")).toEqual({ kind: "selected" });
    expect(g.select("c1:b")).toEqual({ kind: "match", cardId: "c1", grade: "goed" });
    expect(g.matched.has("c1")).toBe(true);
    // Matched tiles can't be selected again.
    expect(g.select("c1:f")).toEqual({ kind: "deselected" });
  });

  it("counts a wrong pairing against both words", () => {
    const g = new MatchGame(cards(3), seeded(3));
    g.select("c0:f");
    expect(g.select("c2:b")).toEqual({ kind: "mismatch", tiles: ["c0:f", "c2:b"] });
    expect(g.mistakes).toBe(1);
    g.select("c0:b");
    expect(g.select("c0:f")).toEqual({ kind: "match", cardId: "c0", grade: "fout" });
    g.select("c2:f");
    expect(g.select("c2:b")).toMatchObject({ grade: "fout" });
    g.select("c1:b");
    expect(g.select("c1:f")).toMatchObject({ grade: "goed" });
    expect(g.finished).toBe(true);
  });

  it("switches the selection when two words from the same side are tapped, and deselects on a second tap", () => {
    const g = new MatchGame(cards(3), seeded(4));
    g.select("c0:f");
    expect(g.select("c1:f")).toEqual({ kind: "selected" });
    expect(g.selected).toBe("c1:f");
    expect(g.mistakes).toBe(0);
    expect(g.select("c1:f")).toEqual({ kind: "deselected" });
    expect(g.selected).toBeNull();
  });

  it("plays through every round", () => {
    const g = new MatchGame(cards(8), seeded(5));
    let rounds = 1;
    for (;;) {
      for (const t of g.tiles.filter((t) => t.side === "front")) {
        g.select(t.id);
        g.select(`${t.cardId}:b`);
      }
      if (g.finished) break;
      expect(g.nextRound()).toBe(true);
      rounds++;
    }
    expect(rounds).toBe(2);
    expect(g.matched.size).toBe(8);
    expect(g.nextRound()).toBe(false);
  });
});
