import { describe, expect, it } from "vitest";
import { parseAIResult } from "../../src/lib/aiTerms";

describe("answers from slim herkennen", () => {
  it("keeps valid terms, tidies them and blanks the term in its explanation", () => {
    const r = parseAIResult({
      readable: true,
      title: "  Industrie   &   kolonialisme ",
      terms: [
        { term: "spinning jenny:", explanation: "De spinning jenny was een machine waarmee één spinner   meerdere draden tegelijk kon maken." },
        { term: "Spinning Jenny", explanation: "Dubbel." },
        { term: "", explanation: "Leeg begrip." },
        { term: "arbeiders", explanation: 42 },
        "geen object",
      ],
    });
    expect(r).toEqual({ title: "Industrie & kolonialisme", readable: true, cards: [{ term: "spinning jenny", explanation: "De … was een machine waarmee één spinner meerdere draden tegelijk kon maken." }] });
  });

  it("rejects anything that is not the agreed shape, and reports an unreadable photo", () => {
    expect(parseAIResult(null)).toBeNull();
    expect(parseAIResult({ terms: "nee" })).toBeNull();
    expect(parseAIResult({ readable: false, title: "", terms: [] })).toEqual({ cards: [], title: "", readable: false });
  });
});
