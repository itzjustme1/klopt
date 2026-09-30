import { describe, expect, it } from "vitest";
import { examPlan, forecast, isKnown } from "../../src/lib/plan";
import type { Box } from "../../src/lib/types";

const c = (hist: string | undefined, box: Box, lastDay?: string) => ({ hist, box, lastDay });

describe("examPlan", () => {
  const cards = [c(undefined, 1), c("f", 1), c("gg", 2, "2026-10-01"), c("fgg", 2), c("ggg", 3), c(undefined, 1), c("t", 1), c(undefined, 1)];

  it("knows which words are known", () => {
    expect(isKnown(c("gg", 2))).toBe(true);
    expect(isKnown(c("g", 1))).toBe(false);
    expect(isKnown(c("fgg", 3))).toBe(false);
  });

  it("spreads the unknown words over the days left", () => {
    // 6 still unknown, plus 1 learned earlier today: today's target is based on the 7.
    expect(examPlan(cards, "2026-10-01", "2026-10-05")).toEqual({ daysLeft: 4, toLearn: 6, target: 5, doneToday: 1 });
    expect(examPlan(cards, "2026-10-01", "2026-10-02")).toMatchObject({ daysLeft: 1, target: 7 });
    expect(examPlan(cards, "2026-10-01", "2026-10-01")).toMatchObject({ daysLeft: 0, target: 7 });
  });

  it("asks at least five a day, or everything that is left", () => {
    const many = Array.from({ length: 40 }, () => c(undefined, 1));
    expect(examPlan(many, "2026-10-01", "2026-10-31")!.target).toBe(5);
    expect(examPlan(many, "2026-10-01", "2026-10-05")!.target).toBe(10);
    expect(examPlan([c(undefined, 1), c("gg", 2)], "2026-10-01", "2026-10-31")!.target).toBe(1);
  });

  it("keeps today's target fixed while the student practises", () => {
    const morning = Array.from({ length: 12 }, () => c(undefined, 1));
    expect(examPlan(morning, "2026-10-01", "2026-10-04")).toMatchObject({ toLearn: 12, target: 5, doneToday: 0 });
    // Ten words learned today: the target stays 5 and today's work counts.
    const evening = [...Array.from({ length: 10 }, () => c("g", 2, "2026-10-01")), c(undefined, 1), c(undefined, 1)];
    expect(examPlan(evening, "2026-10-01", "2026-10-04")).toMatchObject({ toLearn: 2, target: 5, doneToday: 10 });
  });

  it("has nothing left when everything is known, and no plan after the test", () => {
    expect(examPlan([c("gg", 2), c("ggg", 4)], "2026-10-01", "2026-10-10")).toMatchObject({ toLearn: 0, target: 0 });
    expect(examPlan(cards, "2026-10-06", "2026-10-05")).toBeNull();
  });

  it("counts across the DST change", () => {
    expect(examPlan(cards, "2026-10-24", "2026-10-26")!.daysLeft).toBe(2);
  });
});

describe("forecast", () => {
  it("counts due cards per day, with overdue ones today", () => {
    const due = (d: string) => ({ due: d });
    const f = forecast([due("2026-09-20"), due("2026-10-01"), due("2026-10-02"), due("2026-10-02"), due("2026-10-07"), due("2026-10-08")], "2026-10-01");
    expect(f.map((x) => x.count)).toEqual([2, 2, 0, 0, 0, 0, 1]);
    expect(f[0]!.day).toBe("2026-10-01");
    expect(f[6]!.day).toBe("2026-10-07");
  });
});
