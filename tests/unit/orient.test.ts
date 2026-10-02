import { describe, expect, it } from "vitest";
import { lineAngle, uprightCandidates } from "../../src/lib/orient";

/** A white page with dark "lines of text" (bars with gaps, like words) at an angle. */
function page(angleDeg: number, w = 600, h = 600) {
  const data = new Uint8Array(w * h).fill(240);
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  for (let line = -12; line <= 12; line++) {
    for (let s = -250; s <= 250; s++) {
      if (Math.floor((s + 300) / 23) % 4 === 3) continue; // word gaps
      for (let th = 0; th < 7; th++) {
        const u = s;
        const v = line * 20 + th;
        const x = Math.round(w / 2 + u * cos - v * sin);
        const y = Math.round(h / 2 + u * sin + v * cos);
        if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = 20;
      }
    }
  }
  return { width: w, height: h, data };
}

describe("text orientation", () => {
  it("finds the angle of the lines: upright, tilted, on its side", () => {
    expect(lineAngle(page(0))).toBe(0);
    expect(Math.abs(lineAngle(page(2.5))! - 2.5)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(lineAngle(page(-3))! + 3)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(lineAngle(page(90))! - 90)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(lineAngle(page(88))! - 88)).toBeLessThanOrEqual(0.5);
  });

  it("gives up on an empty page, and offers both ways up", () => {
    expect(lineAngle({ width: 100, height: 100, data: new Uint8Array(10000).fill(250) })).toBeNull();
    expect(uprightCandidates(90)).toEqual([-90, 90]);
    expect(uprightCandidates(1.5)).toEqual([-1.5, 178.5]);
  });
});
