/** Interface language. */
export type Lang = "nl" | "en";
/** Language of card content. "xx" means other / not a language (e.g. economics terms). */
export type ContentLang = "nl" | "en" | "fr" | "de" | "es" | "it" | "la" | "xx";
export type Grade = "fout" | "twijfel" | "goed";
export type Box = 1 | 2 | 3 | 4 | 5;
export type Theme = "system" | "light" | "dark";
export type Mode = "herhalen" | "leren" | "flashcards" | "meerkeuze" | "typen" | "dictee" | "toets" | "koppelen";

export interface Deck {
  id: string;
  name: string;
  subject?: string;
  /** Language of the front (question) side. */
  langFront: ContentLang;
  /** Language of the back (answer) side. */
  langBack: ContentLang;
  /** Date of the test this list is for (YYYY-MM-DD), to plan practice. */
  examDate?: string;
  /** "terms": a term and its explanation (history, biology), practised mostly as flashcards. Absent: words. */
  kind?: DeckKind;
  createdAt: string;
}

export type DeckKind = "words" | "terms";

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  topic?: string;
  box: Box;
  /** YYYY-MM-DD, local calendar date. */
  due: string;
  createdAt: string;
  updatedAt: string;
  /** Cache, rebuilt from the review log: last results, oldest first, one char per answer (g, t, f). */
  hist?: string;
  /** Cache, rebuilt from the review log: local day of the last answer. */
  lastDay?: string;
  /** Marked by the student to practise on purpose. */
  starred?: boolean;
}

/** Append-only. Never edited. */
export interface Review {
  id: string;
  cardId: string;
  /** ISO timestamp. */
  at: string;
  /** YYYY-MM-DD local calendar date the answer was given on; needed to replay scheduling. */
  day: string;
  grade: Grade;
  fromBox: Box;
  toBox: Box;
  mode: Mode;
  /**
   * Only the first answer to a card on a given day moves it between boxes.
   * Later answers that day (practice, repeats) are logged with counts = false and fromBox === toBox.
   */
  counts: boolean;
}

/** Cache, rebuilt from the review log: answers per local day, for the streak and daily goal. */
export interface DayStat {
  day: string;
  answers: number;
  correct: number;
}

export interface Settings {
  uiLang: Lang;
  theme: Theme;
  schemaVersion: number;
  /** Answers per day. */
  dailyGoal: number;
  /** Read words aloud automatically when a question appears (only with an on-device voice). */
  autoSpeak: boolean;
  /** Count an answer that only misses accents as right. */
  lenientAccents: boolean;
  /** Count a single small typo in a longer word as right. */
  lenientTypos: boolean;
  /** Short sounds for right and wrong, and a vibration on wrong where supported. */
  sounds: boolean;
  /** Local bookkeeping, not part of backups. */
  changesSinceExport: number;
  reminderSnoozedAt: number;
  lastExportAt?: string;
  persistRequested: boolean;
  installHintDismissed: boolean;
  /** Day on which the "goal reached" message was last shown. */
  goalCelebratedOn?: string;
  /** The look these settings were last brought up to date for (see DESIGN_VERSION in db.ts). */
  designVersion?: number;
}

export const GRADES: readonly Grade[] = ["fout", "twijfel", "goed"];
export const BOXES: readonly Box[] = [1, 2, 3, 4, 5];
export const CONTENT_LANGS: readonly ContentLang[] = ["nl", "en", "fr", "de", "es", "it", "la", "xx"];
export const MODES: readonly Mode[] = ["herhalen", "leren", "flashcards", "meerkeuze", "typen", "dictee", "toets", "koppelen"];
