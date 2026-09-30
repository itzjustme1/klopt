export type Route =
  | { name: "today" }
  | { name: "review"; deckId?: string }
  | { name: "decks"; create?: boolean }
  | { name: "deck"; id: string; share?: boolean }
  | { name: "import"; deckId?: string }
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

/** Pure hash parser. Slugs are fixed Dutch words so shared links work in any UI language. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\/?/, "/");
  const [, head = "", a, ...rest] = path.split("/");
  if (head === "stapels" && rest.length === 1 && rest[0] === "delen") {
    const id = seg(a);
    return id ? { name: "deck", id, share: true } : { name: "notfound" };
  }
  if (rest.length > 0 && head !== "deel") return { name: "notfound" };
  switch (head) {
    case "":
      return { name: "today" };
    case "overhoren": {
      const deckId = seg(a);
      return deckId ? { name: "review", deckId } : { name: "review" };
    }
    case "stapels": {
      if (a === "nieuw") return { name: "decks", create: true };
      const id = seg(a);
      return id ? { name: "deck", id } : { name: "decks" };
    }
    case "importeren": {
      const deckId = seg(a);
      return deckId ? { name: "import", deckId } : { name: "import" };
    }
    case "instellingen":
      return a ? { name: "notfound" } : { name: "settings" };
    case "deel":
      return a ? { name: "share", payload: [a, ...rest].join("/") } : { name: "notfound" };
    default:
      return { name: "notfound" };
  }
}

export const href = {
  today: () => "#/",
  review: (deckId?: string) => (deckId ? `#/overhoren/${encodeURIComponent(deckId)}` : "#/overhoren"),
  decks: () => "#/stapels",
  newDeck: () => "#/stapels/nieuw",
  deck: (id: string) => `#/stapels/${encodeURIComponent(id)}`,
  shareDeck: (id: string) => `#/stapels/${encodeURIComponent(id)}/delen`,
  import: (deckId?: string) => (deckId ? `#/importeren/${encodeURIComponent(deckId)}` : "#/importeren"),
  settings: () => "#/instellingen",
  share: (payload: string) => `#/deel/${payload}`,
};
