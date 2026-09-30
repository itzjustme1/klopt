import { localDay } from "./dates";
import type { PracticeSnapshot } from "./practice";

/**
 * The last unfinished practice session, kept in this browser only (a per-device convenience,
 * like a draft). Valid for the day it was saved on. Storage errors are ignored.
 */
const KEY = "klopt-resume";

interface Saved {
  key: string;
  day: string;
  snap: PracticeSnapshot;
}

export function saveSession(key: string, snap: PracticeSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ key, day: localDay(), snap } satisfies Saved));
  } catch {
    // Private mode or full storage: continuing just won't be offered.
  }
}

export function loadSession(key: string): PracticeSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Saved>;
    if (saved.key !== key || saved.day !== localDay() || !saved.snap || !Array.isArray(saved.snap.queue)) return null;
    return saved.snap;
  } catch {
    return null;
  }
}

/** The saved session's route key and progress, whatever practice it belongs to. */
export function peekSession(): { key: string; left: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Saved>;
    if (!saved.key || saved.day !== localDay() || !saved.snap) return null;
    const left = saved.snap.total - saved.snap.done;
    return left > 0 ? { key: saved.key, left } : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
