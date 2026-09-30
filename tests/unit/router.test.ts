import { describe, expect, it } from "vitest";
import { href, parseHash } from "../../src/lib/router";

describe("router", () => {
  it.each([
    ["", { name: "today" }],
    ["#", { name: "today" }],
    ["#/", { name: "today" }],
    ["#/overhoren", { name: "review" }],
    ["#/overhoren/abc", { name: "review", deckId: "abc" }],
    ["#/stapels", { name: "decks" }],
    ["#/stapels/nieuw", { name: "decks", create: true }],
    ["#/stapels/abc", { name: "deck", id: "abc" }],
    ["#/stapels/abc/delen", { name: "deck", id: "abc", share: true }],
    ["#/importeren", { name: "import" }],
    ["#/importeren/abc", { name: "import", deckId: "abc" }],
    ["#/instellingen", { name: "settings" }],
    ["#/deel/H4sIAAA_-x", { name: "share", payload: "H4sIAAA_-x" }],
    ["#/nope", { name: "notfound" }],
    ["#/stapels/a/b", { name: "notfound" }],
    ["#/deel", { name: "notfound" }],
  ])("parses %s", (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it("round-trips ids through href", () => {
    expect(parseHash(href.deck("a b/c"))).toEqual({ name: "deck", id: "a b/c" });
    expect(parseHash(href.review("x"))).toEqual({ name: "review", deckId: "x" });
  });

  it("does not crash on malformed escapes", () => {
    expect(parseHash("#/stapels/%E0%A4%A")).toEqual({ name: "decks" });
  });
});
