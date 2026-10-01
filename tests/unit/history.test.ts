import { describe, expect, it } from "vitest";
import { addDays } from "../../src/lib/dates";
import { appendHist, difficulty, isHard, rebuildCaches, streak, streakInfo, weekDays } from "../../src/lib/history";
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

describe("streak freezes", () => {
  const run = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));
  const set = (...days: string[]) => new Set(days);

  it("earns a freeze per 7 days in a row, up to 2", () => {
    expect(streakInfo(set(...run("2026-09-01", 6)), "2026-09-06")).toMatchObject({ days: 6, freezes: 0, toNextFreeze: 1 });
    expect(streakInfo(set(...run("2026-09-01", 7)), "2026-09-07")).toMatchObject({ days: 7, freezes: 1, toNextFreeze: 7 });
    expect(streakInfo(set(...run("2026-09-01", 30)), "2026-09-30")).toMatchObject({ days: 30, freezes: 2, toNextFreeze: 0 });
  });

  it("uses a freeze for a missed day and keeps the streak", () => {
    const days = set(...run("2026-09-01", 7), "2026-09-09");
    expect(streakInfo(days, "2026-09-09")).toMatchObject({ days: 8, freezes: 0, frozen: ["2026-09-08"], best: 8 });
    // Missed yesterday, today not done yet: the freeze already covers yesterday.
    expect(streakInfo(set(...run("2026-09-01", 7)), "2026-09-09")).toMatchObject({ days: 7, today: false, freezes: 0, frozen: ["2026-09-08"] });
  });

  it("breaks when more days are missed than there are freezes", () => {
    expect(streakInfo(set(...run("2026-09-01", 7)), "2026-09-10")).toMatchObject({ days: 0, freezes: 0, frozen: [], best: 7 });
    expect(streakInfo(set(...run("2026-09-01", 14), "2026-09-17"), "2026-09-17")).toMatchObject({ days: 15, freezes: 0, frozen: ["2026-09-15", "2026-09-16"] });
    expect(streakInfo(set(...run("2026-09-01", 3), "2026-09-05"), "2026-09-05")).toMatchObject({ days: 1, best: 3 });
  });

  it("matches the plain streak when nothing was missed", () => {
    for (const today of ["2026-09-03", "2026-09-04", "2026-09-06"]) {
      const days = set(...run("2026-09-01", 3));
      const plain = streak(days, today);
      expect(streakInfo(days, today)).toMatchObject(plain);
    }
    expect(streakInfo(new Set(), "2026-09-01")).toMatchObject({ days: 0, freezes: 0, best: 0 });
  });
});
