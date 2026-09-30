import { describe, expect, it } from "vitest";
import { addDays, diffDays, formatDay, isValidDay, localDay } from "../../src/lib/dates";

describe("addDays", () => {
  it("adds within a month", () => {
    expect(addDays("2026-10-01", 3)).toBe("2026-10-04");
    expect(addDays("2026-10-01", 0)).toBe("2026-10-01");
  });
  it("rolls over months", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-31", 30)).toBe("2026-03-02");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
  });
  it("rolls over years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-12-20", 14)).toBe("2027-01-03");
  });
  it("handles leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });
  it("supports negative offsets", () => {
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });
  it("crosses the 2026-10-25 DST change without shifting", () => {
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
    expect(addDays("2026-10-24", 7)).toBe("2026-10-31");
    expect(addDays("2026-10-10", 30)).toBe("2026-11-09");
    // Spring change too.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
  });
  it("walks every day of 2026 to 2027 one at a time without skipping or repeating", () => {
    let d = "2026-01-01";
    for (let i = 0; i < 730; i++) {
      const next = addDays(d, 1);
      expect(diffDays(d, next)).toBe(1);
      expect(next > d).toBe(true);
      d = next;
    }
    expect(d).toBe("2028-01-01");
  });
  it("rejects invalid input", () => {
    expect(() => addDays("2026-1-1", 1)).toThrow();
    expect(() => addDays("", 1)).toThrow();
  });
});

describe("localDay", () => {
  it("runs in Europe/Amsterdam for these tests", () => {
    expect(process.env.TZ).toBe("Europe/Amsterdam");
    // Offset differs before and after the October change, proving DST is active in this process.
    expect(new Date(2026, 9, 24, 12).getTimezoneOffset()).toBe(-120);
    expect(new Date(2026, 9, 26, 12).getTimezoneOffset()).toBe(-60);
  });
  it("uses the local calendar date, not UTC", () => {
    // 00:30 local on 25 Oct is 22:30 UTC on 24 Oct.
    expect(localDay(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25");
    // 23:30 local on 31 Dec is 22:30 UTC on 31 Dec.
    expect(localDay(new Date("2026-12-31T22:30:00Z"))).toBe("2026-12-31");
    expect(localDay(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
  it("gives consecutive days around the DST night", () => {
    const hours = [0, 1, 2, 3, 4, 23];
    for (const h of hours) {
      expect(localDay(new Date(2026, 9, 25, h, 30))).toBe("2026-10-25");
    }
  });
});

describe("isValidDay", () => {
  it("accepts real dates only", () => {
    expect(isValidDay("2026-10-01")).toBe(true);
    expect(isValidDay("2028-02-29")).toBe(true);
    expect(isValidDay("2027-02-29")).toBe(false);
    expect(isValidDay("2026-13-01")).toBe(false);
    expect(isValidDay("2026-10-1")).toBe(false);
    expect(isValidDay("2026-10-01T00:00")).toBe(false);
    expect(isValidDay(20261001)).toBe(false);
    expect(isValidDay(null)).toBe(false);
  });
});

describe("diffDays / formatDay", () => {
  it("counts days across DST and years", () => {
    expect(diffDays("2026-10-24", "2026-10-26")).toBe(2);
    expect(diffDays("2026-12-31", "2027-01-01")).toBe(1);
    expect(diffDays("2026-10-02", "2026-10-01")).toBe(-1);
  });
  it("formats without timezone shift", () => {
    expect(formatDay("2026-10-25", "nl")).toBe("25 oktober");
    expect(formatDay("2026-10-25", "en")).toBe("October 25");
  });
});
