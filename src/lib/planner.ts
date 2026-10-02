/**
 * The test-week planner: spreads the words still to learn for every upcoming test over the days before
 * it, skipping the weekdays the student has no time, and keeps the last day before a test for a review.
 * Pure: no storage, no clock.
 */
import { addDays, diffDays } from "./dates";

export interface PlanExam {
  deckId: string;
  examDate: string;
  /** Words not known yet. */
  toLearn: number;
  /** All words in the list, for the review the day before. */
  total: number;
  /** Today's target from the list's own plan (examPlan), so both screens say the same. */
  todayTarget?: number;
}

export interface PlanTask {
  deckId: string;
  kind: "learn" | "review";
  words: number;
}

export interface PlanDay {
  day: string;
  /** A weekday the student marked as having no time. */
  off: boolean;
  tasks: PlanTask[];
  /** Lists with their test on this day. */
  exams: string[];
}

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD day. */
export function weekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

export function studyPlan(exams: readonly PlanExam[], today: string, daysOff: readonly number[] = []): PlanDay[] {
  const upcoming = exams.filter((e) => e.examDate >= today);
  if (!upcoming.length) return [];
  const last = upcoming.reduce((m, e) => (e.examDate > m ? e.examDate : m), today);
  const days: PlanDay[] = Array.from({ length: diffDays(today, last) + 1 }, (_, i) => {
    const day = addDays(today, i);
    return { day, off: daysOff.includes(weekday(day)), tasks: [], exams: [] };
  });
  const at = (day: string) => days[diffDays(today, day)]!;

  for (const e of upcoming.toSorted((a, b) => a.examDate.localeCompare(b.examDate))) {
    at(e.examDate).exams.push(e.deckId);
    if (e.examDate === today) {
      // The test is today: one last look.
      at(today).tasks.push({ deckId: e.deckId, kind: "review", words: e.total });
      continue;
    }
    const before = days.filter((d) => d.day < e.examDate);
    // When every day before the test is a day off, the days off are used anyway.
    let study = before.filter((d) => !d.off);
    if (!study.length) study = before;
    const reviewDay = study.length >= 2 ? study.at(-1)! : null;
    const learnDays = reviewDay ? study.slice(0, -1) : study;

    let left = e.toLearn;
    for (let i = 0; i < learnDays.length && left > 0; i++) {
      const d = learnDays[i]!;
      const even = Math.ceil(left / (learnDays.length - i));
      const words = Math.min(left, d.day === today && e.todayTarget !== undefined ? Math.max(e.todayTarget, even) : even);
      if (words > 0) d.tasks.push({ deckId: e.deckId, kind: "learn", words });
      left -= words;
    }
    if (reviewDay && e.total > 0) reviewDay.tasks.push({ deckId: e.deckId, kind: "review", words: e.total });
  }
  return days;
}

export interface CalendarEvent {
  /** Stable, so importing the file again updates events instead of doubling them. */
  uid: string;
  day: string;
  title: string;
  description?: string;
  /** A reminder at 18:00 the evening before (all-day events), or at the start (timed events). */
  remind?: boolean;
  /** "HH:MM": a timed event in the device's own time zone instead of an all-day one. */
  time?: string;
  /** Length of a timed event in minutes. */
  minutes?: number;
  /** Repeats every day. */
  daily?: boolean;
}

/** Escapes text for an iCalendar property value (RFC 5545 §3.3.11). */
function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets, never inside a UTF-8 character (RFC 5545 §3.1). */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (size + n > limit) {
      out.push(cur);
      cur = "";
      size = 0;
    }
    cur += ch;
    size += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const compact = (day: string) => day.replaceAll("-", "");

/** An iCalendar file with all-day events, for Apple Calendar, Google Calendar and Outlook. */
export function calendarFile(name: string, events: readonly CalendarEvent[], now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Klopt//Toetsweek//NL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsText(name)}`];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if (e.time && /^\d{2}:\d{2}$/.test(e.time)) {
      // Floating local time: the calendar shows it at that hour wherever the student is.
      const [hh, mm] = e.time.split(":").map(Number) as [number, number];
      const end = hh * 60 + mm + (e.minutes ?? 15);
      const t = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}${String(m % 60).padStart(2, "0")}00`;
      lines.push(`DTSTART:${compact(e.day)}T${t(hh * 60 + mm)}`, `DTEND:${compact(end >= 1440 ? addDays(e.day, 1) : e.day)}T${t(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(e.day)}`, `DTEND;VALUE=DATE:${compact(addDays(e.day, 1))}`);
    }
    if (e.daily) lines.push("RRULE:FREQ=DAILY");
    lines.push(`SUMMARY:${icsText(e.title)}`, "TRANSP:TRANSPARENT");
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`);
    if (e.remind) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(e.title)}`, `TRIGGER:${e.time ? "PT0M" : "-PT6H"}`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
