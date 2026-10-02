/**
 * Which way the text on a photo runs, so a photo that arrives on its side (WhatsApp drops the
 * rotation) or slightly tilted can be put straight before it is read.
 *
 * Lines of text make the ink pile up in narrow bands. Projected across the lines at the right angle,
 * the ink histogram has sharp peaks (the lines) and gaps (the spaces between them); at a wrong angle
 * it smears out. The angle with the sharpest histogram is the angle of the lines. Pure, testable.
 */
import type { Gray } from "./emphasis";

/** Otsu's threshold for the whole picture. */
function threshold(g: Gray): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of g.data) hist[v]!++;
  const total = g.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i]!;
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      t = i;
    }
  }
  return t;
}

/** How sharp the ink histogram is when projected across lines at `deg` degrees. */
function sharpness(points: Float32Array, deg: number, size: number): number {
  const a = (deg * Math.PI) / 180;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const bins = new Float64Array(size * 2 + 2);
  for (let i = 0; i < points.length; i += 2) {
    const p = Math.round(-points[i]! * sin + points[i + 1]! * cos) + size;
    bins[p]!++;
  }
  let s = 0;
  for (const b of bins) s += b * b;
  return s;
}

/**
 * The angle (degrees) the lines of text make with the horizontal: about 0 for an upright photo,
 * about 90 for one on its side, with the small tilt included (for example 88.5).
 * Null when there is too little ink to tell.
 */
export function lineAngle(g: Gray): number | null {
  const t = threshold(g);
  const pts: number[] = [];
  // Every other pixel is plenty, and keeps this fast on a phone.
  for (let y = 0; y < g.height; y += 2) {
    for (let x = 0; x < g.width; x += 2) if (g.data[y * g.width + x]! <= t) pts.push(x, y);
  }
  if (pts.length < 400) return null;
  const points = Float32Array.from(pts);
  const size = Math.ceil(Math.hypot(g.width, g.height));
  let best = -1;
  let bestDeg = 0;
  const tryAngles = (from: number, to: number, step: number) => {
    for (let d = from; d <= to + 1e-9; d += step) {
      const s = sharpness(points, d, size);
      if (s > best) {
        best = s;
        bestDeg = d;
      }
    }
  };
  // Thin lines are sharp only within a fraction of a degree: half-degree steps over both axes,
  // then finer around the winner.
  tryAngles(-6, 6, 0.5);
  tryAngles(84, 96, 0.5);
  const coarse = bestDeg;
  tryAngles(coarse - 0.5, coarse + 0.5, 0.1);
  return Math.round(bestDeg * 100) / 100;
}

/**
 * The two rotations (degrees, clockwise) that make the lines horizontal: upright, and upside down.
 * Which of the two is right only the text recogniser can tell.
 */
export function uprightCandidates(angle: number): [number, number] {
  const r = -angle;
  return [r, r + 180];
}
