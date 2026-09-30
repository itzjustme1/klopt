import { describe, expect, it } from "vitest";
import { Practice, type PracticeCard } from "../../src/lib/practice";
import type { Grade } from "../../src/lib/types";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

const words: PracticeCard[] = [
  ["la maison", "het huis"],
  ["le chien", "de hond"],
  ["l'école", "de school"],
  ["le livre", "het boek"],
  ["la fenêtre", "het raam"],
].map(([front, back], i) => ({ id: `c${i}`, front: front!, back: back!, langFront: "fr", langBack: "nl" }));

const long: PracticeCard[] = [0, 1, 2].map((i) => ({
  id: `l${i}`,
  front: `Begrip ${i}`,
  back: `Een heel lange uitleg van het begrip nummer ${i} die niet te typen is.`,
  langFront: "nl",
  langBack: "nl",
}));

/** Answers every question with `grade(question)` until the session ends; returns how many questions were asked. */
function run(p: Practice, grade: (q: NonNullable<Practice["current"]>) => Grade, max = 500): number {
  let n = 0;
  while (p.current && n < max) {
    p.answer(grade(p.current));
    n++;
  }
  return n;
}

describe("Practice", () => {
  it("leren asks multiple choice first, then recall, and finishes when everything is known", () => {
    const p = new Practice(words, { mode: "leren", direction: "front" }, seeded(1));
    const kinds: string[] = [];
    const asked = run(p, (q) => {
      kinds.push(q.kind);
      return "goed";
    });
    expect(p.finished).toBe(true);
    expect(asked).toBe(10);
    expect(kinds.filter((k) => k === "mc")).toHaveLength(5);
    expect(kinds.filter((k) => k === "type")).toHaveLength(5);
    expect(p.done).toBe(5);
  });

  it("leren brings a missed word back until it is right", () => {
    const p = new Practice(words, { mode: "leren", direction: "front" }, seeded(2));
    let missed = 0;
    run(p, (q) => {
      if (q.card.id === "c0" && missed < 2) {
        missed++;
        return "fout";
      }
      return "goed";
    });
    expect(p.finished).toBe(true);
    expect(p.first.get("c0")).toBe("fout");
    expect(p.mistakes.map((m) => m.card.id)).toEqual(["c0"]);
    expect(p.wrong).toBe(2);
  });

  it("multiple choice has four distinct options including the answer", () => {
    const p = new Practice(words, { mode: "meerkeuze", direction: "front" }, seeded(3));
    run(p, (q) => {
      expect(q.kind).toBe("mc");
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      return "goed";
    });
    expect(p.done).toBe(5);
  });

  it("falls back from multiple choice when there are fewer than four answers", () => {
    const p = new Practice(words.slice(0, 3), { mode: "meerkeuze", direction: "front" }, seeded(4));
    expect(p.current?.kind).toBe("flash");
  });

  it("typen repeats wrong answers at the end until right", () => {
    const p = new Practice(words, { mode: "typen", direction: "front" }, seeded(5));
    const seen = new Map<string, number>();
    run(p, (q) => {
      const n = (seen.get(q.card.id) ?? 0) + 1;
      seen.set(q.card.id, n);
      return q.card.id === "c1" && n === 1 ? "fout" : "goed";
    });
    expect(seen.get("c1")).toBe(2);
    expect(p.current).toBeNull();
  });

  it("toets asks everything once, gives no second chances, and computes a Dutch grade", () => {
    const p = new Practice(words, { mode: "toets", direction: "front" }, seeded(6));
    const answers: Grade[] = ["goed", "goed", "fout", "twijfel", "goed"];
    let i = 0;
    const asked = run(p, () => answers[i++]!);
    expect(asked).toBe(5);
    // (1 + 1 + 0 + 0.5 + 1) / 5 = 0.7 -> 1 + 9 * 0.7 = 7.3
    expect(p.cijfer).toBe(7.3);
  });

  it("gives 10 for a perfect test and 1 for all wrong", () => {
    const perfect = new Practice(words, { mode: "toets", direction: "front" }, seeded(7));
    run(perfect, () => "goed");
    expect(perfect.cijfer).toBe(10);
    const none = new Practice(words, { mode: "toets", direction: "front" }, seeded(8));
    run(none, () => "fout");
    expect(none.cijfer).toBe(1);
  });

  it("uses self-check for answers too long to type", () => {
    const p = new Practice(long, { mode: "typen", direction: "front" }, seeded(9));
    expect(p.current?.kind).toBe("flash");
  });

  it("asks the other side when the direction is back", () => {
    const p = new Practice(words, { mode: "typen", direction: "back" }, seeded(10));
    const q = p.current!;
    expect(q.prompt).toBe(q.card.back);
    expect(q.answer).toBe(q.card.front);
    expect(q.promptLang).toBe("nl");
    expect(q.answerLang).toBe("fr");
  });

  it("mixes directions when asked to", () => {
    const p = new Practice(words, { mode: "flashcards", direction: "mixed" }, seeded(11));
    const sides = new Set<string>();
    run(p, (q) => {
      sides.add(q.prompt === q.card.front ? "front" : "back");
      return "goed";
    });
    expect(sides.size).toBe(2);
  });

  it("dictee dictates the foreign side and needs a voice", () => {
    const withVoice = new Practice(words, { mode: "dictee", direction: "front", canSpeak: (l) => l === "fr" }, seeded(12));
    expect(withVoice.total).toBe(5);
    expect(withVoice.current).toMatchObject({ kind: "dictee", promptLang: "fr" });
    expect(withVoice.current!.prompt).toBe(withVoice.current!.answer);
    const noVoice = new Practice(words, { mode: "dictee", direction: "front", canSpeak: () => false }, seeded(13));
    expect(noVoice.total).toBe(0);
    expect(noVoice.finished).toBe(true);
  });

  it("keeps the given order for the review queue", () => {
    const p = new Practice(words, { mode: "herhalen", direction: "front", keepOrder: true }, seeded(14));
    const order: string[] = [];
    run(p, (q) => {
      order.push(q.card.id);
      return "goed";
    });
    expect(order).toEqual(["c0", "c1", "c2", "c3", "c4"]);
  });

  it("handles an empty session", () => {
    const p = new Practice([], { mode: "leren", direction: "front" });
    expect(p.finished).toBe(true);
    expect(p.total).toBe(0);
    expect(p.cijfer).toBe(1);
  });
});
