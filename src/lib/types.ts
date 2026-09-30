export type Lang = "nl" | "en";
export type Grade = "fout" | "twijfel" | "goed";
export type Box = 1 | 2 | 3 | 4 | 5;
export type Theme = "system" | "light" | "dark";

export interface Deck {
  id: string;
  name: string;
  lang: Lang;
  subject?: string;
  createdAt: string;
}

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
}

/** Append-only. Never edited. */
export interface Review {
  id: string;
  cardId: string;
  /** ISO timestamp. */
  at: string;
  /** YYYY-MM-DD local calendar date the review happened on; needed to replay scheduling. */
  day: string;
  grade: Grade;
  fromBox: Box;
  toBox: Box;
}

export interface Settings {
  uiLang: Lang;
  theme: Theme;
  schemaVersion: number;
  /** Local bookkeeping, not part of backups. */
  changesSinceExport: number;
  reminderSnoozedAt: number;
  lastExportAt?: string;
  persistRequested: boolean;
  installHintDismissed: boolean;
}

export const GRADES: readonly Grade[] = ["fout", "twijfel", "goed"];
export const BOXES: readonly Box[] = [1, 2, 3, 4, 5];
