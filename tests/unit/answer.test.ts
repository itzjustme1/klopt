import { describe, expect, it } from "vitest";
import { alternatives, checkAnswer, hintText, isTypeable, levenshtein, normalize } from "../../src/lib/answer";

describe("normalize", () => {
  it("ignores case, extra spaces, outer punctuation and curly quotes", () => {
    expect(normalize("  Het   HUIS. ")).toBe("het huis");
    expect(normalize("¿Qué tal?")).toBe("qué tal");
    expect(normalize("l’école")).toBe("l'école");
  });
});

describe("checkAnswer", () => {
  it("accepts the exact answer, whatever the case or spacing", () => {
    expect(checkAnswer("het huis", "het huis").verdict).toBe("correct");
    expect(checkAnswer("  Het Huis ", "het huis").verdict).toBe("correct");
    expect(checkAnswer("het huis.", "het huis").verdict).toBe("correct");
  });

  it("accepts any alternative separated by /, ; or a comma", () => {
    expect(checkAnswer("glad", "happy, glad").verdict).toBe("correct");
    expect(checkAnswer("home", "house / home").verdict).toBe("correct");
    expect(checkAnswer("woning", "huis; woning").verdict).toBe("correct");
    expect(checkAnswer("happy, glad", "happy, glad").verdict).toBe("correct");
  });

  it("keeps decimal commas together", () => {
    expect(checkAnswer("1,5 miljoen", "1,5 miljoen").verdict).toBe("correct");
    expect(checkAnswer("1", "1,5 miljoen").verdict).toBe("wrong");
  });

  it("treats text in brackets as optional", () => {
    expect(checkAnswer("auto", "(de) auto").verdict).toBe("correct");
    expect(checkAnswer("de auto", "(de) auto").verdict).toBe("correct");
    expect(checkAnswer("run", "(to) run").verdict).toBe("correct");
  });

  it("calls a missing accent close, not correct", () => {
    expect(checkAnswer("l'ecole", "l'école")).toEqual({ verdict: "close", note: "accents" });
    expect(checkAnswer("strasse", "Straße")).toEqual({ verdict: "close", note: "accents" });
    expect(checkAnswer("fenetre", "la fenêtre").verdict).toBe("wrong");
  });

  it("calls one typo in a longer word close, but not in a short one", () => {
    expect(checkAnswer("fenetr", "fenêtre")).toEqual({ verdict: "close", note: "typo" });
    expect(checkAnswer("hosue", "house")).toEqual({ verdict: "close", note: "typo" });
    expect(checkAnswer("cat", "car").verdict).toBe("wrong");
    expect(checkAnswer("verantwordelijk", "verantwoordelijk")).toEqual({ verdict: "close", note: "typo" });
  });

  it("marks wrong and empty answers wrong", () => {
    expect(checkAnswer("dog", "de hond").verdict).toBe("wrong");
    expect(checkAnswer("", "de hond").verdict).toBe("wrong");
    expect(checkAnswer("   ", "de hond").verdict).toBe("wrong");
  });

  it("never interprets the answer as markup or a pattern", () => {
    expect(checkAnswer("<b>x</b>", "<b>x</b>").verdict).toBe("correct");
    expect(checkAnswer("a.*", "abc").verdict).toBe("wrong");
  });
});

describe("helpers", () => {
  it("lists alternatives", () => {
    expect(alternatives("(de) auto / wagen").sort()).toEqual(["(de) auto", "(de) auto / wagen", "auto", "auto / wagen", "de auto", "de auto / wagen", "wagen"].sort());
  });

  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });

  it("decides which answers can be typed", () => {
    expect(isTypeable("het huis")).toBe(true);
    expect(isTypeable("De procentuele verandering van de gevraagde hoeveelheid gedeeld door de procentuele verandering van de prijs.")).toBe(false);
    expect(isTypeable("een twee drie vier vijf zes zeven")).toBe(false);
    expect(isTypeable("")).toBe(false);
  });

  it("reveals hints letter by letter, keeping spaces", () => {
    expect(hintText("het huis", 0)).toBe("··· ····");
    expect(hintText("het huis", 2)).toBe("he· ····");
    expect(hintText("house / home", 1)).toBe("h····");
  });
});

describe("lenient checking", () => {
  it("can count accent-only differences as right", () => {
    expect(checkAnswer("l'ecole", "l'école", { lenientAccents: true })).toEqual({ verdict: "correct", note: "accents" });
    expect(checkAnswer("l'ecole", "l'école", { lenientTypos: true }).verdict).toBe("close");
  });
  it("can count a small typo as right", () => {
    expect(checkAnswer("hosue", "house", { lenientTypos: true })).toEqual({ verdict: "correct", note: "typo" });
    expect(checkAnswer("hosue", "house", { lenientAccents: true }).verdict).toBe("close");
  });
  it("never makes a really wrong answer right", () => {
    expect(checkAnswer("dog", "house", { lenientAccents: true, lenientTypos: true }).verdict).toBe("wrong");
  });
});
