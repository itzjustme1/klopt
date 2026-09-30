import type { ContentLang } from "./types";

/** Text recognised from a photo, handed to the import screen for checking. In memory only. */
export interface PendingImport {
  text: string;
  langFront: ContentLang;
  langBack: ContentLang;
  source: "photo" | "share";
}

/** Largest shared text we accept from another app. */
const MAX_SHARED = 200_000;

/**
 * Android's share sheet opens the app as ./?title=…&text=…&url=… (manifest share_target).
 * Returns the shared text, if any. The caller strips the query from the address bar.
 */
export function sharedTextFromUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  const parts = [params.get("text"), params.get("url")].filter((p): p is string => !!p && p.trim() !== "");
  if (!parts.length) return null;
  return parts.join("\n").slice(0, MAX_SHARED);
}

let pending: PendingImport | null = null;

export function setPendingImport(p: PendingImport): void {
  pending = p;
}

export function takePendingImport(): PendingImport | null {
  const p = pending;
  pending = null;
  return p;
}
