/**
 * Words picked on a list page to practise ("Oefen selectie"). Kept for this tab only, like a draft;
 * a practice route with which = "selectie" reads it. Storage errors are ignored.
 */
const KEY = "klopt-selection";

export function setSelection(deckId: string, ids: readonly string[]): void {
  try {
    if (ids.length) sessionStorage.setItem(KEY, JSON.stringify({ deckId, ids }));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: practising the selection falls back to the whole list.
  }
}

export function getSelection(deckId: string): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return [];
    const { deckId: d, ids } = v as { deckId?: unknown; ids?: unknown };
    return d === deckId && Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
