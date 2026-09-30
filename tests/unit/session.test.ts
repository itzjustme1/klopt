import { describe, expect, it } from "vitest";
import { buildSession, shuffle } from "../../src/lib/session";
import type { Box } from "../../src/lib/types";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

const c = (id: string, box: Box, due: string) => ({ id, box, due });

describe("buildSession", () => {
  const cards = [
    c("a", 3, "2026-10-01"),
    c("b", 1, "2026-09-20"),
    c("c", 1, "2026-10-01"),
    c("d", 2, "2026-10-02"), // not due
    c("e", 5, "2026-09-01"),
    c("f", 3, "2026-09-30"),
    c("g", 1, "2026-10-01"),
  ];

  it("includes cards due today or earlier only", () => {
    const ids = buildSession(cards, "2026-10-01").map((x) => x.id);
    expect(ids).not.toContain("d");
    expect(ids.sort()).toEqual(["a", "b", "c", "e", "f", "g"]);
  });

  it("orders by box ascending", () => {
    for (let s = 1; s < 20; s++) {
      const boxes = buildSession(cards, "2026-10-01", seeded(s)).map((x) => x.box);
      expect(boxes).toEqual([...boxes].sort((a, b) => a - b));
    }
  });

  it("shuffles within a box", () => {
    const orders = new Set<string>();
    for (let s = 1; s < 40; s++) {
      orders.add(buildSession(cards, "2026-10-01", seeded(s)).slice(0, 3).map((x) => x.id).join(""));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("returns an empty session when nothing is due", () => {
    expect(buildSession(cards, "2026-01-01")).toEqual([]);
  });
});

describe("shuffle", () => {
  it("keeps every element exactly once and doesn't mutate", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, seeded(7));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort()).toEqual(input);
  });
});
