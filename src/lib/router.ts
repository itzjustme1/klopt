import type { Mode } from "./types";
import { MODES } from "./types";
import type { Direction } from "./practice";

export type Which = "all" | "hard" | "due" | "starred" | "selectie";
/** How many words a session holds: a number, or every word. */
export type Count = 10 | 20 | "all";
/** A deck id, or "alles" for every list. */
export type Scope = string;

export type Route =
  | { name: "today" }
  | { name: "lists"; subject?: string }
  | { name: "new" }
  | { name: "editor"; id?: string; terms?: boolean }
  | { name: "deck"; id: string; share?: boolean }
  | { name: "practice"; scope: Scope; mode: Mode; dir: Direction; which: Which; count: Count }
  | { name: "import"; deckId?: string }
  | { name: "photo"; deckId?: string }
  | { name: "file" }
  | { name: "progress" }
  | { name: "settings" }
  | { name: "help" }
  | { name: "share"; payload: string }
  | { name: "quizzes" }
  | { name: "quiz"; id: string }
  | { name: "quizEditor"; id?: string }
  | { name: "quizPlay"; id: string }
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
const WHICH: readonly Which[] = ["all", "hard", "due", "starred", "selectie"];
const COUNTS: Record<string, Count> = { "10": 10, "20": 20, all: "all" };

/** Pure hash parser. Slugs are fixed Dutch words so shared links work in any UI language. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\/?/, "/").replace(/\/+$/, "");
  const parts = path.split("/").slice(1);
  const [head = "", a, b, c, d, e] = parts;
  const n = parts.length;
  const notFound: Route = { name: "notfound" };

  switch (head) {
    case "":
      return n <= 1 ? { name: "today" } : notFound;
    case "lijsten": {
      if (n === 1) return { name: "lists" };
      const subject = seg(a);
      return n === 2 && subject ? { name: "lists", subject } : notFound;
    }
    case "nieuw":
      return n === 1 ? { name: "new" } : notFound;
    case "lijst": {
      if (a === "nieuw" && n === 2) return { name: "editor" };
      if (a === "nieuw" && n === 3 && b === "begrippen") return { name: "editor", terms: true };
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
      const count = COUNTS[e ?? "all"];
      if (!scope || !MODES.includes(mode) || !DIRS.includes(dir) || !WHICH.includes(which) || !count || n > 6) return notFound;
      return { name: "practice", scope, mode, dir, which, count };
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
    case "uitleg":
      return n === 1 ? { name: "help" } : notFound;
    case "deel":
      return a ? { name: "share", payload: parts.slice(1).join("/") } : notFound;
    case "quizzen":
      return n === 1 ? { name: "quizzes" } : notFound;
    case "quiz": {
      if (a === "nieuw" && n === 2) return { name: "quizEditor" };
      const id = seg(a);
      if (!id) return notFound;
      if (n === 2) return { name: "quiz", id };
      if (n === 3 && b === "bewerken") return { name: "quizEditor", id };
      if (n === 3 && b === "maken") return { name: "quizPlay", id };
      return notFound;
    }
    default:
      return notFound;
  }
}

const enc = encodeURIComponent;

export const href = {
  today: () => "#/",
  lists: (subject?: string) => (subject ? `#/lijsten/${enc(subject)}` : "#/lijsten"),
  newList: () => "#/nieuw",
  editorNew: () => "#/lijst/nieuw",
  termsNew: () => "#/lijst/nieuw/begrippen",
  deck: (id: string) => `#/lijst/${enc(id)}`,
  edit: (id: string) => `#/lijst/${enc(id)}/bewerken`,
  shareDeck: (id: string) => `#/lijst/${enc(id)}/delen`,
  practice: (scope: Scope, mode: Mode, dir: Direction = "front", which: Which = "all", count: Count = "all") =>
    `#/oefenen/${enc(scope)}/${mode}/${dir}/${which}${count === "all" ? "" : `/${count}`}`,
  review: (deckId?: string) => `#/oefenen/${enc(deckId ?? "alles")}/herhalen/front/due`,
  import: (deckId?: string) => (deckId ? `#/importeren/${enc(deckId)}` : "#/importeren"),
  photo: (deckId?: string) => (deckId ? `#/foto/${enc(deckId)}` : "#/foto"),
  file: () => "#/bestand",
  progress: () => "#/voortgang",
  settings: () => "#/instellingen",
  help: () => "#/uitleg",
  share: (payload: string) => `#/deel/${payload}`,
  quizzes: () => "#/quizzen",
  quizNew: () => "#/quiz/nieuw",
  quiz: (id: string) => `#/quiz/${enc(id)}`,
  quizEdit: (id: string) => `#/quiz/${enc(id)}/bewerken`,
  quizPlay: (id: string) => `#/quiz/${enc(id)}/maken`,
};
