/**
 * Calendar dates as "YYYY-MM-DD" strings. Arithmetic runs in UTC on year/month/day,
 * so daylight-saving changes can never shift a date.
 */

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function parts(day: string): [number, number, number] {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error(`Invalid day: ${day}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isValidDay(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  const [y, m, d] = parts(value);
  if (y < 1970 || y > 9999) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Local calendar date of the given moment (default: now). */
export function localDay(at: Date = new Date()): string {
  return `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Format a day for display without any timezone shift. */
export function formatDay(day: string, locale: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }): string {
  const [y, m, d] = parts(day);
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
