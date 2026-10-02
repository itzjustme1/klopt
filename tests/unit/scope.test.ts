import { describe, expect, it } from "vitest";
import { decksScope, folderScope, parseScope } from "../../src/lib/scope";

describe("practice scopes", () => {
  it("reads every kind of scope back", () => {
    expect(parseScope("alles")).toEqual({ kind: "all" });
    expect(parseScope("abc-123")).toEqual({ kind: "deck", id: "abc-123" });
    expect(parseScope(folderScope("Hoofdstuk 3: WO2"))).toEqual({ kind: "folder", name: "Hoofdstuk 3: WO2" });
    expect(parseScope(decksScope(["a", "b"]))).toEqual({ kind: "decks", ids: ["a", "b"] });
    expect(parseScope("lijsten:")).toEqual({ kind: "decks", ids: [] });
  });
});
