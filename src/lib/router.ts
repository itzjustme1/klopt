import type { Mode } from "./types";
import { MODES } from "./types";
import type { Direction } from "./practice";

export type Which = "all" | "hard" | "due";
/** A deck id, or "alles" for every list. */
export type Scope = string;

export type Route =
  | { name: "today" }
  | { name: "lists" }
  | { name: "new" }
  | { name: "editor"; id?: string }
  | { name: "deck"; id: string; share?: boolean }
  | { name: "practice"; scope: Scope; mode: Mode; dir: Direction; which: Which }
  | { name: "import"; deckId?: string }
  | { name: "photo"; deckId?: string }
  | { name: "file" }
  | { name: "progress" }
  | { name: "settings" }
  | { name: "share"; payload: string }
  | { name: "notfound" };

function seg(s: string | undefined): string | undefined {
  if (s === undefined || s === "") return undefined;
  try {
    return decodeURIComponent(s);
  } catch {
    return undefined;
  }
}

const DIRS: readonly Direction[] = ["front", "back", "mixed"];
const WHICH: readonly Which[] = ["all", "hard", "due"];

/** Pure hash parser. Slugs are fixed Dutch words so shared links work in any UI language. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\/?/, "/").replace(/\/+$/, "");
  const parts = path.split("/").slice(1);
  const [head = "", a, b, c, d] = parts;
  const n = parts.length;
  const notFound: Route = { name: "notfound" };

  switch (head) {
    case "":
      return n <= 1 ? { name: "today" } : notFound;
    case "lijsten":
      return n === 1 ? { name: "lists" } : notFound;
    case "nieuw":
      return n === 1 ? { name: "new" } : notFound;
    case "lijst": {
      if (a === "nieuw" && n === 2) return { name: "editor" };
      const id = seg(a);
      if (!id) return notFound;
      if (n === 2) return { name: "deck", id };
      if (n === 3 && b === "bewerken") return { name: "editor", id };
      if (n === 3 && b === "delen") return { name: "deck", id, share: true };
      return notFound;
    }
    case "oefenen": {
      const scope = seg(a);
      const mode = b as Mode;
      const dir = (c ?? "front") as Direction;
      const which = (d ?? "all") as Which;
      if (!scope || !MODES.includes(mode) || !DIRS.includes(dir) || !WHICH.includes(which) || n > 5) return notFound;
      return { name: "practice", scope, mode, dir, which };
    }
    case "importeren": {
      const deckId = seg(a);
      if (n > 2) return notFound;
      return deckId ? { name: "import", deckId } : { name: "import" };
    }
    case "foto": {
      const deckId = seg(a);
      if (n > 2) return notFound;
      return deckId ? { name: "photo", deckId } : { name: "photo" };
    }
    case "bestand":
      return n === 1 ? { name: "file" } : notFound;
    case "voortgang":
      return n === 1 ? { name: "progress" } : notFound;
    case "instellingen":
      return n === 1 ? { name: "settings" } : notFound;
    case "deel":
      return a ? { name: "share", payload: parts.slice(1).join("/") } : notFound;
    default:
      return notFound;
  }
}

const enc = encodeURIComponent;

export const href = {
  today: () => "#/",
  lists: () => "#/lijsten",
  newList: () => "#/nieuw",
  editorNew: () => "#/lijst/nieuw",
  deck: (id: string) => `#/lijst/${enc(id)}`,
  edit: (id: string) => `#/lijst/${enc(id)}/bewerken`,
  shareDeck: (id: string) => `#/lijst/${enc(id)}/delen`,
  practice: (scope: Scope, mode: Mode, dir: Direction = "front", which: Which = "all") => `#/oefenen/${enc(scope)}/${mode}/${dir}/${which}`,
  review: (deckId?: string) => `#/oefenen/${enc(deckId ?? "alles")}/herhalen/front/due`,
  import: (deckId?: string) => (deckId ? `#/importeren/${enc(deckId)}` : "#/importeren"),
  photo: (deckId?: string) => (deckId ? `#/foto/${enc(deckId)}` : "#/foto"),
  file: () => "#/bestand",
  progress: () => "#/voortgang",
  settings: () => "#/instellingen",
  share: (payload: string) => `#/deel/${payload}`,
};
