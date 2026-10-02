import { describe, expect, it } from "vitest";
import { groupLabels } from "../../src/lib/occlusion";

const w = (text: string, x0: number, y0: number, line: number, confidence = 90) => ({ text, x0, y0, x1: x0 + text.length * 10, y1: y0 + 20, line, confidence });

describe("labels on a diagram", () => {
  it("groups close words on a line and splits far ones, as fractions of the picture", () => {
    const labels = groupLabels([w("rechter", 100, 100, 1), w("boezem", 178, 100, 1), w("aorta", 600, 100, 1), w("hart-", 100, 300, 2), w("kamer", 400, 500, 3)], 1000, 800);
    expect(labels.map((l) => l.text)).toEqual(["rechter boezem", "aorta", "hart", "kamer"]);
    const first = labels[0]!;
    expect(first.x).toBeCloseTo(0.095, 3);
    expect(first.y).toBeCloseTo(0.11875, 4);
    expect(first.w).toBeGreaterThan(0.13);
    expect(first.h).toBeCloseTo(30 / 800, 4); // 20 px of text plus a quarter of that above and below
  });

  it("skips specks, numbers on their own and uncertain words, and stays inside the picture", () => {
    const labels = groupLabels([w("|", 10, 10, 1), w("12", 200, 10, 1), w("xq", 400, 10, 1, 20), w("long", 0, 0, 2)], 300, 200);
    expect(labels.map((l) => l.text)).toEqual(["long"]);
    expect(labels[0]!.x).toBe(0);
    expect(labels[0]!.y).toBe(0);
  });
});
