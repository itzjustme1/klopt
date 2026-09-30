import { describe, expect, it } from "vitest";
import { rowsFromWords, type OcrWord } from "../../src/lib/ocrRows";

/** Builds word boxes for text laid out on a page: each line is [x, text] pairs at a y position. */
function page(lines: [number, [number, string][]][]): OcrWord[] {
  const words: OcrWord[] = [];
  for (const [y, items] of lines) {
    for (const [x, text] of items) {
      let cx = x;
      for (const w of text.split(" ")) {
        words.push({ text: w, x0: cx, y0: y, x1: cx + w.length * 10, y1: y + 20, confidence: 90 });
        cx += w.length * 10 + 8;
      }
    }
  }
  return words;
}

describe("rowsFromWords", () => {
  it("splits a two-column word list on the gap between the columns", () => {
    const words = page([
      [100, [[50, "la maison"], [400, "het huis"]]],
      [140, [[50, "le chien"], [400, "de hond"]]],
      [180, [[50, "l'école"], [400, "de school"]]],
    ]);
    expect(rowsFromWords(words)).toEqual(["la maison\thet huis", "le chien\tde hond", "l'école\tde school"]);
  });

  it("joins a wrapped translation to the row above", () => {
    const words = page([
      [100, [[50, "la fenêtre"], [400, "het raam, het"]]],
      [125, [[400, "venster"]]],
      [170, [[50, "le livre"], [400, "het boek"]]],
    ]);
    expect(rowsFromWords(words)).toEqual(["la fenêtre\thet raam, het venster", "le livre\thet boek"]);
  });

  it("handles a slightly skewed photo", () => {
    const words = page([
      [100, [[50, "haben"]]],
      [104, [[400, "hebben"]]],
      [140, [[50, "gehen"]]],
      [145, [[400, "gaan"]]],
    ]);
    expect(rowsFromWords(words)).toEqual(["haben\thebben", "gehen\tgaan"]);
  });

  it("splits single-column lines on a dash", () => {
    const words = page([
      [100, [[50, "the house - het huis"]]],
      [140, [[50, "the dog = de hond"]]],
      [180, [[50, "to run: rennen"]]],
    ]);
    // "to run: rennen" has no spaced separator, so it stays one line for the student to fix.
    expect(rowsFromWords(words)).toEqual(["the house\thet huis", "the dog\tde hond", "to run: rennen"]);
  });

  it("drops low-confidence noise and returns nothing for an empty page", () => {
    expect(rowsFromWords([])).toEqual([]);
    expect(rowsFromWords([{ text: "|", x0: 0, y0: 0, x1: 2, y1: 20, confidence: 10 }])).toEqual([]);
  });
});
