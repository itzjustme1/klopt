/**
 * What a practice session covers, as one URL segment:
 * - "alles": every list (the daily review);
 * - a list id;
 * - "map:<name>": every list in a folder;
 * - "lijsten:<id>,<id>": a few lists picked together (chapters 1 to 3 before a test).
 */
export type ScopeKind = { kind: "all" } | { kind: "deck"; id: string } | { kind: "folder"; name: string } | { kind: "decks"; ids: string[] };

export function parseScope(scope: string): ScopeKind {
  if (scope === "alles") return { kind: "all" };
  if (scope.startsWith("map:")) return { kind: "folder", name: scope.slice(4) };
  if (scope.startsWith("lijsten:")) return { kind: "decks", ids: scope.slice(8).split(",").filter(Boolean) };
  return { kind: "deck", id: scope };
}

export const folderScope = (name: string) => `map:${name}`;
export const decksScope = (ids: readonly string[]) => `lijsten:${ids.join(",")}`;
