import { describe, expect, it } from "vitest";
import { href, parseHash } from "../../src/lib/router";

describe("router", () => {
  it.each([
    ["", { name: "today" }],
    ["#", { name: "today" }],
    ["#/", { name: "today" }],
    ["#/lijsten", { name: "lists" }],
    ["#/nieuw", { name: "new" }],
    ["#/lijst/nieuw", { name: "editor" }],
    ["#/lijst/abc", { name: "deck", id: "abc" }],
    ["#/lijst/abc/bewerken", { name: "editor", id: "abc" }],
    ["#/lijst/abc/delen", { name: "deck", id: "abc", share: true }],
    ["#/oefenen/abc/leren/front/all", { name: "practice", scope: "abc", mode: "leren", dir: "front", which: "all" }],
    ["#/oefenen/alles/herhalen/front/due", { name: "practice", scope: "alles", mode: "herhalen", dir: "front", which: "due" }],
    ["#/oefenen/abc/toets", { name: "practice", scope: "abc", mode: "toets", dir: "front", which: "all" }],
    ["#/importeren", { name: "import" }],
    ["#/importeren/abc", { name: "import", deckId: "abc" }],
    ["#/foto", { name: "photo" }],
    ["#/foto/abc", { name: "photo", deckId: "abc" }],
    ["#/bestand", { name: "file" }],
    ["#/voortgang", { name: "progress" }],
    ["#/instellingen", { name: "settings" }],
    ["#/deel/H4sIAAA_-x", { name: "share", payload: "H4sIAAA_-x" }],
    ["#/nope", { name: "notfound" }],
    ["#/lijst/a/b", { name: "notfound" }],
    ["#/oefenen/abc/hacken", { name: "notfound" }],
    ["#/oefenen/abc/leren/sideways", { name: "notfound" }],
    ["#/oefenen/abc/leren/front/some", { name: "notfound" }],
    ["#/deel", { name: "notfound" }],
  ])("parses %s", (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it("round-trips ids through href", () => {
    expect(parseHash(href.deck("a b/c"))).toEqual({ name: "deck", id: "a b/c" });
    expect(parseHash(href.practice("x y", "dictee", "mixed", "hard"))).toEqual({ name: "practice", scope: "x y", mode: "dictee", dir: "mixed", which: "hard" });
    expect(parseHash(href.review())).toEqual({ name: "practice", scope: "alles", mode: "herhalen", dir: "front", which: "due" });
  });

  it("does not crash on malformed escapes", () => {
    expect(parseHash("#/lijst/%E0%A4%A")).toEqual({ name: "notfound" });
  });
});
