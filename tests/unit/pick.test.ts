import { describe, expect, it } from "vitest";
import { pickForPractice } from "../../src/lib/app.svelte";
import type { Box } from "../../src/lib/types";

describe("pickForPractice", () => {
  const card = (id: string, hist: string | undefined, box: Box) => ({ id, hist, box });
  const cards = [
    card("goed1", "ggg", 3),
    card("nieuw1", undefined, 1),
    card("vaak1", "ggf", 1),
    card("soms1", "fgg", 2),
    card("goed2", "gg", 2),
    card("nieuw2", undefined, 1),
    card("vaak2", "ff", 1),
  ];

  it("takes the words that need practice most", () => {
    const ids = pickForPractice(cards, 4, () => 0.5).map((c) => c.id);
    expect(ids.slice(0, 2).sort()).toEqual(["vaak1", "vaak2"]);
    expect(ids[2]).toBe("soms1");
    expect(ids[3]).toMatch(/^nieuw/);
  });

  it("returns everything, most urgent first, when the count is larger", () => {
    const ids = pickForPractice(cards, 100, () => 0).map((c) => c.id);
    expect(ids).toHaveLength(7);
    expect(ids.slice(-2).sort()).toEqual(["goed1", "goed2"]);
    // Within a group, lower boxes first.
    expect(ids.indexOf("goed2")).toBeLessThan(ids.indexOf("goed1"));
  });
});
