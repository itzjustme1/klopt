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
    ["#/oefenen/abc/leren/front/all", { name: "practice", scope: "abc", mode: "leren", dir: "front", which: "all", count: "all" }],
    ["#/oefenen/alles/herhalen/front/due", { name: "practice", scope: "alles", mode: "herhalen", dir: "front", which: "due", count: "all" }],
    ["#/oefenen/abc/toets", { name: "practice", scope: "abc", mode: "toets", dir: "front", which: "all", count: "all" }],
    ["#/oefenen/abc/leren/back/starred/10", { name: "practice", scope: "abc", mode: "leren", dir: "back", which: "starred", count: 10 }],
    ["#/oefenen/abc/leren/back/all/20", { name: "practice", scope: "abc", mode: "leren", dir: "back", which: "all", count: 20 }],
    ["#/oefenen/abc/leren/back/all/7", { name: "notfound" }],
    ["#/importeren", { name: "import" }],
    ["#/importeren/abc", { name: "import", deckId: "abc" }],
    ["#/foto", { name: "photo" }],
    ["#/foto/abc", { name: "photo", deckId: "abc" }],
    ["#/bestand", { name: "file" }],
    ["#/voortgang", { name: "progress" }],
    ["#/instellingen", { name: "settings" }],
    ["#/uitleg", { name: "help" }],
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
    expect(parseHash(href.practice("x y", "dictee", "mixed", "hard"))).toEqual({ name: "practice", scope: "x y", mode: "dictee", dir: "mixed", which: "hard", count: "all" });
    expect(parseHash(href.practice("x", "typen", "front", "all", 10))).toEqual({ name: "practice", scope: "x", mode: "typen", dir: "front", which: "all", count: 10 });
    expect(parseHash(href.review())).toEqual({ name: "practice", scope: "alles", mode: "herhalen", dir: "front", which: "due", count: "all" });
  });

  it("does not crash on malformed escapes", () => {
    expect(parseHash("#/lijst/%E0%A4%A")).toEqual({ name: "notfound" });
  });
});

describe("shared text from another app", async () => {
  const { sharedTextFromUrl } = await import("../../src/lib/handoff");
  it("reads text and url from the query", () => {
    expect(sharedTextFromUrl("?title=x&text=huis%09house%0Ahond%09dog")).toBe("huis\thouse\nhond\tdog");
    expect(sharedTextFromUrl("?text=a%3Bb&url=https%3A%2F%2Fexample.com")).toBe("a;b\nhttps://example.com");
    expect(sharedTextFromUrl("")).toBeNull();
    expect(sharedTextFromUrl("?title=only")).toBeNull();
    expect(sharedTextFromUrl("?text=%20%20")).toBeNull();
  });
  it("caps very long shared text", () => {
    expect(sharedTextFromUrl(`?text=${"a".repeat(300_000)}`)!.length).toBe(200_000);
  });
});
