import { describe, expect, it } from "vitest";
import { DAYS, answerCard, nextBox, review } from "../../src/lib/scheduler";
import type { Box, Grade } from "../../src/lib/types";

const card = (box: Box) => ({ id: "c", box, due: "2026-09-01" });

describe("scheduler", () => {
  it("uses the intervals 1, 3, 7, 14, 30", () => {
    expect(DAYS).toEqual([1, 3, 7, 14, 30]);
  });

  it.each<[Box, Grade, Box, string]>([
    [1, "goed", 2, "2026-10-04"],
    [4, "fout", 1, "2026-10-02"],
    [5, "goed", 5, "2026-10-31"],
    [3, "twijfel", 3, "2026-10-08"],
  ])("box %i graded %s on 2026-10-01 goes to box %i, due %s", (box, grade, toBox, due) => {
    const next = review(card(box), grade, "2026-10-01");
    expect(next.box).toBe(toBox);
    expect(next.due).toBe(due);
  });

  it("keeps other fields and does not mutate the input", () => {
    const c = { ...card(2), front: "x" };
    const next = review(c, "goed", "2026-10-01");
    expect(next.front).toBe("x");
    expect(c.box).toBe(2);
  });

  it("fout always resets to box 1, twijfel never moves", () => {
    for (const b of [1, 2, 3, 4, 5] as Box[]) {
      expect(nextBox(b, "fout")).toBe(1);
      expect(nextBox(b, "twijfel")).toBe(b);
    }
  });

  it("grading a box-5 card goed repeatedly stays in box 5, 30 days each time", () => {
    let c = card(5);
    let today = "2026-10-01";
    const dues: string[] = [];
    for (let i = 0; i < 4; i++) {
      c = review(c, "goed", today);
      expect(c.box).toBe(5);
      dues.push(c.due);
      today = c.due;
    }
    expect(dues).toEqual(["2026-10-31", "2026-11-30", "2026-12-30", "2027-01-29"]);
  });

  it("climbs from box 1 to 5 with goed", () => {
    let c = card(1);
    const boxes: number[] = [];
    for (let i = 0; i < 5; i++) {
      c = review(c, "goed", "2026-10-01");
      boxes.push(c.box);
    }
    expect(boxes).toEqual([2, 3, 4, 5, 5]);
  });

  it("schedules correctly across the 2026-10-25 DST change", () => {
    expect(review(card(1), "goed", "2026-10-24").due).toBe("2026-10-27");
    expect(review(card(3), "goed", "2026-10-20").due).toBe("2026-11-03");
    expect(review(card(1), "fout", "2026-10-24").due).toBe("2026-10-25");
    expect(review(card(1), "fout", "2026-10-25").due).toBe("2026-10-26");
  });

  it("matches the reference implementation for every box, grade and a year of start dates", () => {
    // Reference from the brief, run with local dates at noon so it is not affected by the test's own DST handling.
    const refAdd = (date: string, n: number) => {
      const [y, m, d] = date.split("-").map(Number);
      const t = new Date(y!, m! - 1, d!, 12);
      t.setDate(t.getDate() + n);
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    };
    let day = "2026-01-01";
    for (let i = 0; i < 366; i++) {
      for (const b of [1, 2, 3, 4, 5] as Box[]) {
        for (const g of ["fout", "twijfel", "goed"] as Grade[]) {
          const box = g === "fout" ? 1 : g === "goed" ? Math.min(5, b + 1) : b;
          expect(review(card(b), g, day)).toMatchObject({ box, due: refAdd(day, DAYS[box - 1]!) });
        }
      }
      day = refAdd(day, 1);
    }
  });
});

describe("answerCard", () => {
  it("counts only the first answer of the day", () => {
    const first = answerCard({ box: 2 as Box, due: "2026-10-01" }, "goed", "2026-10-01");
    expect(first).toMatchObject({ counts: true, fromBox: 2, toBox: 3, card: { box: 3, due: "2026-10-08", lastDay: "2026-10-01" } });
    const second = answerCard(first.card, "fout", "2026-10-01");
    expect(second).toMatchObject({ counts: false, fromBox: 3, toBox: 3, card: { box: 3, due: "2026-10-08" } });
    const nextDay = answerCard(second.card, "fout", "2026-10-02");
    expect(nextDay).toMatchObject({ counts: true, toBox: 1, card: { due: "2026-10-03", lastDay: "2026-10-02" } });
  });
});
