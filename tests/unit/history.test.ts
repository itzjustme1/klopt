import { describe, expect, it } from "vitest";
import { appendHist, difficulty, isHard, rebuildCaches, streak, weekDays } from "../../src/lib/history";
import type { Review } from "../../src/lib/types";

describe("history", () => {
  it("keeps the last 8 results", () => {
    let h: string | undefined;
    for (const g of ["goed", "fout", "goed", "twijfel", "goed", "goed", "goed", "goed", "fout"] as const) h = appendHist(h, g);
    expect(h).toBe("fgtggggf");
  });

  it("classifies difficulty", () => {
    expect(difficulty(undefined)).toBe("nieuw");
    expect(difficulty("gggf")).toBe("vaak");
    expect(difficulty("ffgg")).toBe("vaak");
    expect(difficulty("fggg")).toBe("soms");
    expect(difficulty("gtg")).toBe("soms");
    expect(difficulty("ggg")).toBe("goed");
    expect(isHard("ggg")).toBe(false);
    expect(isHard("gtg")).toBe(true);
  });

  it("rebuilds caches and day stats from the log in time order", () => {
    const r = (id: string, cardId: string, at: string, day: string, grade: Review["grade"]): Review => ({ id, cardId, at, day, grade, fromBox: 1, toBox: 1, mode: "leren", counts: false });
    const { cards, days } = rebuildCaches([
      r("3", "a", "2026-10-02T10:00:00.000Z", "2026-10-02", "goed"),
      r("1", "a", "2026-10-01T10:00:00.000Z", "2026-10-01", "fout"),
      r("2", "b", "2026-10-01T11:00:00.000Z", "2026-10-01", "goed"),
    ]);
    expect(cards.get("a")).toEqual({ hist: "fg", lastDay: "2026-10-02" });
    expect(cards.get("b")).toEqual({ hist: "g", lastDay: "2026-10-01" });
    expect(days).toEqual([
      { day: "2026-10-01", answers: 2, correct: 1 },
      { day: "2026-10-02", answers: 1, correct: 1 },
    ]);
  });
});

describe("streak", () => {
  const set = (...d: string[]) => new Set(d);
  it("counts consecutive days ending today", () => {
    expect(streak(set("2026-09-28", "2026-09-29", "2026-09-30"), "2026-09-30")).toEqual({ days: 3, today: true });
  });
  it("keeps yesterday's streak alive until today is over", () => {
    expect(streak(set("2026-09-28", "2026-09-29"), "2026-09-30")).toEqual({ days: 2, today: false });
  });
  it("breaks after a missed day", () => {
    expect(streak(set("2026-09-27", "2026-09-28"), "2026-09-30")).toEqual({ days: 0, today: false });
    expect(streak(set("2026-09-26", "2026-09-28", "2026-09-29", "2026-09-30"), "2026-09-30").days).toBe(3);
  });
  it("runs across month, year and DST boundaries", () => {
    expect(streak(set("2026-12-30", "2026-12-31", "2027-01-01"), "2027-01-01").days).toBe(3);
    expect(streak(set("2026-10-24", "2026-10-25", "2026-10-26"), "2026-10-26").days).toBe(3);
  });
  it("lists the current week from Monday", () => {
    // 2026-09-30 is a Wednesday.
    expect(weekDays("2026-09-30")).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    // A Sunday belongs to the week that started the Monday before.
    expect(weekDays("2026-10-04")[0]).toBe("2026-09-28");
  });
});
