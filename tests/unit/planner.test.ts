import { describe, expect, it } from "vitest";
import { calendarFile, studyPlan, weekday } from "../../src/lib/planner";

// Thursday 1 October 2026.
const today = "2026-10-01";

describe("test-week planner", () => {
  it("knows the weekday of a date", () => {
    expect(weekday("2026-10-01")).toBe(4);
    expect(weekday("2026-10-04")).toBe(0);
  });

  it("spreads the words over the days before the test and keeps the last day for a review", () => {
    const days = studyPlan([{ deckId: "fr", examDate: "2026-10-06", toLearn: 40, total: 50 }], today);
    expect(days.map((d) => d.day)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]);
    expect(days.map((d) => d.tasks.map((t) => `${t.kind}:${t.words}`).join())).toEqual(["learn:10", "learn:10", "learn:10", "learn:10", "review:50", ""]);
    expect(days.at(-1)!.exams).toEqual(["fr"]);
  });

  it("skips days off, and uses them anyway when there is no other day", () => {
    // No time on Saturday (6) and Sunday (0).
    const days = studyPlan([{ deckId: "fr", examDate: "2026-10-06", toLearn: 9, total: 9 }], today, [6, 0]);
    const plan = Object.fromEntries(days.map((d) => [d.day, d.tasks.map((t) => `${t.kind}:${t.words}`).join()]));
    expect(plan).toEqual({ "2026-10-01": "learn:5", "2026-10-02": "learn:4", "2026-10-03": "", "2026-10-04": "", "2026-10-05": "review:9", "2026-10-06": "" });
    expect(days.filter((d) => d.off).map((d) => d.day)).toEqual(["2026-10-03", "2026-10-04"]);
    const weekend = studyPlan([{ deckId: "de", examDate: "2026-10-05", toLearn: 6, total: 6 }], "2026-10-03", [6, 0]);
    expect(weekend.map((d) => d.tasks.map((t) => `${t.kind}:${t.words}`).join())).toEqual(["learn:6", "review:6", ""]);
  });

  it("follows the list's own target for today, and handles a test today or tomorrow", () => {
    const days = studyPlan([{ deckId: "fr", examDate: "2026-10-04", toLearn: 10, total: 10, todayTarget: 6 }], today);
    expect(days.map((d) => d.tasks.map((t) => t.words).join())).toEqual(["6", "4", "10", ""]);
    expect(studyPlan([{ deckId: "a", examDate: today, toLearn: 3, total: 8 }], today)[0]!.tasks).toEqual([{ deckId: "a", kind: "review", words: 8 }]);
    expect(studyPlan([{ deckId: "a", examDate: "2026-10-02", toLearn: 3, total: 8 }], today)[0]!.tasks).toEqual([{ deckId: "a", kind: "learn", words: 3 }]);
    expect(studyPlan([{ deckId: "a", examDate: "2026-09-30", toLearn: 3, total: 8 }], today)).toEqual([]);
  });

  it("plans several tests side by side", () => {
    const days = studyPlan(
      [
        { deckId: "late", examDate: "2026-10-05", toLearn: 8, total: 8 },
        { deckId: "soon", examDate: "2026-10-03", toLearn: 4, total: 4 },
      ],
      today,
    );
    expect(days[0]!.tasks).toEqual([
      { deckId: "soon", kind: "learn", words: 4 },
      { deckId: "late", kind: "learn", words: 3 },
    ]);
    expect(days[2]!.exams).toEqual(["soon"]);
    expect(days[3]!.tasks).toEqual([{ deckId: "late", kind: "review", words: 8 }]);
  });
});

describe("calendar file", () => {
  it("writes all-day events with escaping, folding, CRLF and a reminder", () => {
    const ics = calendarFile(
      "Toetsweek",
      [
        { uid: "exam-fr@klopt", day: "2026-10-06", title: "Toets: Frans; H1, woorden", remind: true },
        { uid: "learn-fr-2026-10-01@klopt", day: "2026-10-01", title: "Leren: " + "ë".repeat(60), description: "regel 1\nregel 2" },
      ],
      new Date("2026-10-01T09:30:00.123Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain("DTSTAMP:20261001T093000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261006\r\nDTEND;VALUE=DATE:20261007");
    expect(ics).toContain("SUMMARY:Toets: Frans\\; H1\\, woorden");
    expect(ics).toContain("DESCRIPTION:regel 1\\nregel 2");
    expect(ics).toContain("BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Toets: Frans\\; H1\\, woorden\r\nTRIGGER:-PT6H\r\nEND:VALARM");
    // No line over 75 octets, and unfolding gives the title back.
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:Leren: " + "ë".repeat(60));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

describe("daily reminder", () => {
  it("writes a timed, daily repeating event with an alarm at the start", () => {
    const ics = calendarFile("Klopt", [{ uid: "daily@klopt", day: "2026-10-02", title: "Even oefenen", time: "19:30", minutes: 15, daily: true, remind: true }], new Date("2026-10-02T08:00:00Z"));
    expect(ics).toContain("DTSTART:20261002T193000\r\nDTEND:20261002T194500");
    expect(ics).toContain("RRULE:FREQ=DAILY");
    expect(ics).toContain("TRIGGER:PT0M");
    const late = calendarFile("Klopt", [{ uid: "x", day: "2026-10-02", title: "Laat", time: "23:50", minutes: 15 }], new Date("2026-10-02T08:00:00Z"));
    expect(late).toContain("DTSTART:20261002T235000\r\nDTEND:20261003T000500");
  });
});
