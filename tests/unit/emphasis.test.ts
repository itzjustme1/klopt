import { describe, expect, it } from "vitest";
import { blankTerm, cardsFromWords, relayout, slant, strokeWidth, styleWords, type Gray, type PageWord, type StyledWord } from "../../src/lib/emphasis";

/** A white page with "words" drawn as rows of vertical strokes: `width` px thick, leaning `lean` px per px up. */
function page(words: { x: number; y: number; strokes: number; width: number; lean?: number }[], w = 1200, h = 200): Gray {
  const data = new Uint8Array(w * h).fill(245);
  for (const word of words) {
    for (let k = 0; k < word.strokes; k++) {
      const left = word.x + k * 12;
      for (let y = 0; y < 30; y++) {
        const shift = Math.round((word.lean ?? 0) * (30 - y));
        for (let x = 0; x < word.width; x++) data[(word.y + y) * w + left + shift + x] = 20;
      }
    }
  }
  return { width: w, height: h, data };
}
const box = (x: number, y: number, strokes: number): PageWord => ({ text: "woord", x0: x - 2, y0: y - 2, x1: x + strokes * 12 + 12, y1: y + 32, para: 1, line: 1 });

describe("measuring type", () => {
  it("measures stroke width and slant", () => {
    const g = page([
      { x: 20, y: 20, strokes: 6, width: 2 },
      { x: 200, y: 20, strokes: 6, width: 4 },
      { x: 400, y: 20, strokes: 6, width: 2, lean: 0.22 },
    ]);
    const thin = strokeWidth(g, box(20, 20, 6))!;
    const thick = strokeWidth(g, box(200, 20, 6))!;
    expect(thin).toBeCloseTo(2, 0);
    expect(thick / thin).toBeGreaterThan(1.6);
    expect(slant(g, box(20, 20, 6))).toBeCloseTo(0, 1);
    expect(slant(g, box(400, 20, 6))!).toBeGreaterThan(0.15);
  });

  it("marks the words that stand out from their line as bold or italic", () => {
    const xs = [20, 120, 220, 320, 420, 520, 620];
    const g = page(xs.map((x, i) => ({ x, y: 20, strokes: 6, width: i === 2 ? 4 : 2, lean: i === 5 ? 0.22 : 0 })));
    const words = xs.map((x, i) => ({ ...box(x, 20, 6), text: `woord${i}` }));
    const styled = styleWords(g, words);
    expect(styled.map((w) => w.bold)).toEqual([false, false, true, false, false, false, false]);
    expect(styled.map((w) => w.italic)).toEqual([false, false, false, false, false, true, false]);
  });

  it("finds nothing on a blank page", () => {
    const g = page([]);
    expect(strokeWidth(g, box(20, 20, 6))).toBeNull();
    expect(slant(g, box(20, 20, 6))).toBeNull();
  });
});

/** Styled words from text: *word* is emphasised, "|" breaks the line, "¶" starts a paragraph, "#" marks a heading line. */
function styled(text: string): StyledWord[] {
  const out: StyledWord[] = [];
  let para = 1;
  let line = 1;
  let x = 0;
  for (const raw of text.split(/(\s+|\||¶)/).filter((t) => t.trim())) {
    if (raw === "|") {
      line++;
      x = 0;
      continue;
    }
    if (raw === "¶") {
      para++;
      line++;
      x = 0;
      continue;
    }
    const heading = raw.startsWith("#");
    const emph = /^\*.*\*[.,:;]?$/.test(raw);
    const word = raw.replace(/^#/, "").replace(/\*/g, "");
    const h = heading ? 40 : 20;
    out.push({ text: word, para, line, x0: x, y0: line * 30, x1: x + word.length * 10, y1: line * 30 + h, bold: emph, italic: false, confidence: 95 });
    x += word.length * 10 + 8;
  }
  return out;
}

describe("making term cards", () => {
  it("explains a term with the sentence it stands in, blanked", () => {
    const { cards } = cardsFromWords(styled("Op 10 mei viel Duitsland binnen. De Duitsers gebruikten de *Blitzkrieg*, een snelle aanval met tanks. Daarna gaf Nederland zich over."));
    expect(cards).toEqual([{ term: "Blitzkrieg", explanation: "De Duitsers gebruikten de …, een snelle aanval met tanks." }]);
  });

  it("keeps a multi-word term together, also over a line break, but not past a sentence", () => {
    const { cards } = cardsFromWords(styled("Dit was de *Verenigde* | *Oost-Indische* *Compagnie*. *Toen* ging het mis met de handel in Azië en Europa."));
    expect(cards[0]!.term).toBe("Verenigde Oost-Indische Compagnie");
    expect(cards[0]!.explanation).toContain("Dit was de …");
  });

  it("takes the sentences before 'Dat noemen we …'", () => {
    const { cards } = cardsFromWords(styled("Sommigen werkten samen met de Duitsers. Zij kregen er geld voor. Dat noemen we *collaboratie*. Anderen gingen in het verzet."));
    expect(cards[0]).toEqual({ term: "collaboratie", explanation: "Sommigen werkten samen met de Duitsers. Zij kregen er geld voor. Dat noemen we …." });
  });

  it("adds the next sentence when the term's sentence is short", () => {
    const { cards } = cardsFromWords(styled("Er kwam *inflatie*. De prijzen stegen elk jaar met meer dan tien procent."));
    expect(cards[0]!.explanation).toBe("Er kwam …. De prijzen stegen elk jaar met meer dan tien procent.");
  });

  it("reads a glossary line and a term on a line of its own", () => {
    const { cards } = cardsFromWords(styled("*Onderduiken:* je verbergen voor de bezetter, | bijvoorbeeld om niet te werken. ¶ *Hongerwinter* | De winter van 1944, toen er bijna geen eten was."));
    expect(cards).toEqual([
      { term: "Onderduiken", explanation: "Je verbergen voor de bezetter, bijvoorbeeld om niet te werken." },
      { term: "Hongerwinter", explanation: "De winter van 1944, toen er bijna geen eten was." },
    ]);
  });

  it("uses the heading as the title, never as a term, and joins hyphenated words", () => {
    const { cards, title } = cardsFromWords(styled("#*Hoofdstuk* #*3* ¶ Na de oorlog kwam de weder- | opbouw. Dat heet de *Marshallhulp*, geld uit Amerika voor Europa."));
    expect(title).toBe("Hoofdstuk 3");
    expect(cards.map((c) => c.term)).toEqual(["Marshallhulp"]);
    expect(cards[0]!.explanation).toContain("wederopbouw");
  });

  it("joins a paragraph the recogniser split halfway a sentence, and skips repeats and specks", () => {
    const words = styled("De *Februaristaking* was een grote staking tegen ¶ de jodenvervolging in Amsterdam. Later was er weer een *Februaristaking* in een andere stad.");
    words.push({ text: "EE", para: 9, line: 9, x0: 0, y0: 0, x1: 10, y1: 10, bold: false, italic: false, confidence: 20 });
    const { cards } = cardsFromWords(words);
    expect(cards).toEqual([{ term: "Februaristaking", explanation: "De … was een grote staking tegen de jodenvervolging in Amsterdam." }]);
  });

  it("says a photo is unclear when too many words seem to stand out", () => {
    const text = Array.from({ length: 30 }, (_, i) => (i % 3 ? `woord${i}` : `*woord${i}*`)).join(" ") + ".";
    expect(cardsFromWords(styled(text))).toMatchObject({ cards: [], unclear: true });
  });

  it("blanks every form of the term, but not inside other words", () => {
    expect(blankTerm("De VOC en de voc-tijd, niet vocaal.", "VOC")).toBe("De … en de …-tijd, niet vocaal.");
  });
});

describe("pages from real photos", () => {
  it("separates two columns the recogniser read as one line", () => {
    // Left column: "De stoommachine was nieuw." over two lines; right column: "Het verzet groeide." over two lines.
    const word = (text: string, x0: number, y0: number, line: number): PageWord => ({ text, x0, y0, x1: x0 + text.length * 10, y1: y0 + 20, para: 1, line });
    const ws = [
      word("De", 0, 0, 1), word("stoommachine", 30, 0, 1), word("Het", 400, 0, 1), word("verzet", 440, 0, 1),
      word("was", 0, 30, 2), word("nieuw.", 40, 30, 2), word("groeide.", 400, 30, 2),
      ...Array.from({ length: 8 }, (_, i) => [word("tekst", 0, 60 + i * 30, 3 + i), word("tekst", 400, 60 + i * 30, 3 + i)]).flat(),
    ];
    const text = relayout(ws).map((w) => w.text).join(" ");
    expect(text.startsWith("De stoommachine was nieuw.")).toBe(true);
    expect(text).toContain("Het verzet groeide.");
    expect(text.indexOf("Het")).toBeGreaterThan(text.indexOf("nieuw."));
  });

  it("reads a run-in heading in capitals as a term, explained by its paragraph", () => {
    const { cards } = cardsFromWords(styled("STOOMMACHINES Nog belangrijker was de uitvinding van een machine die op stoom liep. Zo konden fabrieken overal staan. ¶ AAN HET BEGIN VAN DE EEUW was alles anders."));
    expect(cards).toEqual([{ term: "Stoommachines", explanation: "Nog belangrijker was de uitvinding van een machine die op stoom liep. Zo konden fabrieken overal staan." }]);
  });
});
