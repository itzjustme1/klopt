import { describe, expect, it } from "vitest";
import { FILE_FORMAT, FILE_VERSION } from "../../src/config";
import { parseBackup } from "../../src/lib/backup";
import { blanksOf } from "../../src/lib/quiz";
import { generateQuiz, type GenLabels } from "../../src/lib/quizgen";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const labels: GenLabels = {
  whichTerm: "Welk begrip past bij deze uitleg?",
  whatMeans: (t) => `Wat betekent ${t}?`,
  translate: (w) => `Vertaal: ${w}`,
  pairing: (t, e) => `${t} betekent: ${e}`,
};

const terms = [
  ["Blitzkrieg", "De Duitsers gebruikten de …, een snelle aanval."],
  ["collaboratie", "Samenwerken met de bezetter."],
  ["verzet", "Strijd tegen de bezetter."],
  ["Februaristaking", "Deze … was een staking in 1941."],
  ["Hongerwinter", "De winter van 1944 op 1945 zonder eten."],
].map(([front, back]) => ({ front: front!, back: back! }));

/** A generated quiz must pass the same strict check as a backup or a shared quiz. */
function valid(questions: unknown[]) {
  const file = { format: FILE_FORMAT, version: FILE_VERSION, decks: [], cards: [], reviews: [], quizzes: [{ id: newId(), name: "T", questions, createdAt: "2026-10-02T10:00:00.000Z", updatedAt: "2026-10-02T10:00:00.000Z" }] };
  return parseBackup(JSON.stringify(file));
}

describe("practice test from a list", () => {
  it("mixes question types for a term list, with the right answers", () => {
    const qs = generateQuiz({ kind: "terms" }, terms, labels, newId, seeded(1));
    expect(qs).toHaveLength(5);
    expect(new Set(qs.map((q) => q.type)).size).toBeGreaterThanOrEqual(3);
    for (const q of qs) {
      if (q.type === "mc") {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        const card = terms.find((t) => q.prompt.includes(t.back) || q.prompt.includes(t.front))!;
        expect([card.front, card.back]).toContain(q.options[q.correct]);
      }
      if (q.type === "cloze") expect(blanksOf(q.text).length).toBeGreaterThan(0);
      if (q.type === "tf") {
        const card = terms.find((t) => q.prompt.startsWith(`${t.front} betekent`))!;
        expect(q.answer).toBe(q.prompt.endsWith(card.back));
      }
    }
    expect(valid(qs).ok).toBe(true);
  });

  it("asks translations both ways and fill-ins for a word list", () => {
    const words = [["la maison", "het huis"], ["le chien", "de hond"], ["le livre", "het boek"], ["la pomme", "de appel"], ["l'école", "de school"], ["le chat", "de kat"]].map(([front, back]) => ({ front: front!, back: back! }));
    const qs = generateQuiz({}, words, labels, newId, seeded(2));
    expect(qs.map((q) => q.type).sort()).toEqual(["cloze", "cloze", "mc", "mc", "mc", "mc"]);
    const cloze = qs.find((q) => q.type === "cloze")!;
    expect(cloze.type === "cloze" && cloze.text).toMatch(/^.+ = \[.+\]$/);
    expect(valid(qs).ok).toBe(true);
  });

  it("asks verb forms for a verb list, and never more than the maximum", () => {
    const verbs = Array.from({ length: 30 }, (_, i) => ({ front: `verbe${i}`, back: `werkwoord${i}`, forms: ["suis", "es", "", "sommes", "êtes", "sont"] }));
    const qs = generateQuiz({ kind: "forms", columns: ["je", "tu", "il", "nous", "vous", "ils"] }, verbs, labels, newId, seeded(3), 12);
    expect(qs).toHaveLength(12);
    for (const q of qs) expect(q.type === "cloze" && /^verbe\d+ \((je|tu|nous|vous|ils)\): \[(suis|es|sommes|êtes|sont)\]$/.test(q.text)).toBe(true);
  });

  it("works with a tiny list (no multiple choice under 4 cards) and strips brackets", () => {
    const qs = generateQuiz({}, [{ front: "a [b]", back: "c" }, { front: "d", back: "e" }], labels, newId, seeded(4));
    expect(qs.every((q) => q.type === "cloze")).toBe(true);
    expect(qs.map((q) => q.type === "cloze" && q.text).sort()).toEqual(["a b = [c]", "d = [e]"]);
    expect(generateQuiz({}, [], labels, newId)).toEqual([]);
  });
});
