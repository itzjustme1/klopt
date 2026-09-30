import { describe, expect, it } from "vitest";
import { LIMITS } from "../../src/config";
import { cardKey, parseImport, separatorIndex, unquote } from "../../src/lib/importText";

describe("parseImport", () => {
  it("splits on tab (Quizlet / spreadsheet)", () => {
    const r = parseImport("inflatie\tstijging van het prijspeil\nbbp\tbruto binnenlands product");
    expect(r.cards).toEqual([
      { line: 1, front: "inflatie", back: "stijging van het prijspeil" },
      { line: 2, front: "bbp", back: "bruto binnenlands product" },
    ]);
    expect(r.skipped).toEqual([]);
  });

  it("splits on the first semicolon when there is no tab", () => {
    const r = parseImport("stack;LIFO; last in, first out");
    expect(r.cards).toEqual([{ line: 1, front: "stack", back: "LIFO; last in, first out" }]);
  });

  it("prefers a tab over semicolons, and splits only on the first tab", () => {
    const r = parseImport("a;b\tc;d\te");
    expect(r.cards).toEqual([{ line: 1, front: "a;b", back: "c;d\te" }]);
  });

  it("ignores blank lines but keeps real line numbers", () => {
    const r = parseImport("\n  \na;b\r\n\r\nc;d\n");
    expect(r.cards.map((c) => c.line)).toEqual([3, 5]);
    expect(r.skipped).toEqual([]);
  });

  it("handles CRLF and CR line endings", () => {
    expect(parseImport("a;b\r\nc;d\re;f").cards).toHaveLength(3);
  });

  it("skips a line without separator, with its line number", () => {
    const r = parseImport("a;b\nno separator here\nc;d");
    expect(r.skipped).toEqual([{ line: 2, reason: "noSeparator" }]);
    expect(r.cards).toHaveLength(2);
  });

  it("skips empty sides", () => {
    const r = parseImport(";only back\nonly front;\n \t only back");
    expect(r.skipped).toEqual([
      { line: 1, reason: "emptyFront" },
      { line: 2, reason: "emptyBack" },
      { line: 3, reason: "emptyFront" },
    ]);
  });

  it("treats an empty spreadsheet row (only a tab) as a blank line", () => {
    expect(parseImport("a\tb\n\t\nc\td")).toMatchObject({ skipped: [], cards: [{ line: 1 }, { line: 3 }] });
  });

  it("trims whitespace around both sides", () => {
    expect(parseImport("  term  ;  uitleg  ").cards[0]).toMatchObject({ front: "term", back: "uitleg" });
  });

  it("keeps HTML as plain text, untouched", () => {
    const r = parseImport('<img src=x onerror="alert(1)">;<b>vet</b> &amp; <script>x</script>');
    expect(r.cards[0]).toMatchObject({ front: '<img src=x onerror="alert(1)">', back: "<b>vet</b> &amp; <script>x</script>" });
  });

  it("skips duplicates within the paste and against the existing deck", () => {
    const r = parseImport("a;b\na;b\nc;d", new Set([cardKey("c", "d")]));
    expect(r.cards).toEqual([{ line: 1, front: "a", back: "b" }]);
    expect(r.skipped).toEqual([
      { line: 2, reason: "duplicate" },
      { line: 3, reason: "duplicate" },
    ]);
  });

  it("rejects a side longer than the limit", () => {
    const long = "x".repeat(LIMITS.sideChars + 1);
    const ok = "x".repeat(LIMITS.sideChars);
    const r = parseImport(`${long};b\na;${long}\n${ok};${ok}`);
    expect(r.skipped).toEqual([
      { line: 1, reason: "tooLong" },
      { line: 2, reason: "tooLong" },
    ]);
    expect(r.cards).toHaveLength(1);
  });

  it("flags more than the card limit", () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => `t${i};d${i}`).join("\n");
    expect(parseImport(lines(LIMITS.importCards)).tooMany).toBe(false);
    expect(parseImport(lines(LIMITS.importCards + 1)).tooMany).toBe(true);
  });

  it("refuses oversize raw input without parsing", () => {
    const r = parseImport("a".repeat(LIMITS.importRawChars + 1));
    expect(r).toEqual({ cards: [], skipped: [], tooMany: false, tooBig: true });
  });

  it("returns nothing for empty input", () => {
    expect(parseImport("")).toEqual({ cards: [], skipped: [], tooMany: false, tooBig: false });
  });
});

describe("spreadsheet quoting", () => {
  it("ignores separators inside quotes and removes the quotes", () => {
    const r = parseImport('"to be; to exist";zijn\n"say ""hi""";zeg hoi\nkort;"lang; met puntkomma"');
    expect(r.cards).toEqual([
      { line: 1, front: "to be; to exist", back: "zijn" },
      { line: 2, front: 'say "hi"', back: "zeg hoi" },
      { line: 3, front: "kort", back: "lang; met puntkomma" },
    ]);
  });

  it("still prefers an unquoted tab", () => {
    expect(separatorIndex('a;b\tc')).toBe(3);
    expect(separatorIndex('"a\tb"\tc')).toBe(5);
    expect(separatorIndex('"a;b"')).toBe(-1);
  });

  it("leaves text without surrounding quotes alone", () => {
    expect(unquote(' "half')).toBe('"half');
    expect(unquote("he said \"hi\"")).toBe('he said "hi"');
    expect(unquote('""')).toBe("");
  });
});
