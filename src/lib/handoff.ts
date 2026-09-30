import type { ContentLang } from "./types";

/** Text recognised from a photo, handed to the import screen for checking. In memory only. */
export interface PendingImport {
  text: string;
  langFront: ContentLang;
  langBack: ContentLang;
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
