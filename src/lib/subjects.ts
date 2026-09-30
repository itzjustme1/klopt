import type { Lang } from "./types";

/** Subject suggestions for the list editor, in the interface language. Free text is always allowed. */
export const SUBJECTS: Record<Lang, string[]> = {
  nl: ["Nederlands", "Engels", "Frans", "Duits", "Spaans", "Latijn", "Grieks", "Economie", "Bedrijfseconomie", "Informatica", "Geschiedenis", "Aardrijkskunde", "Biologie", "Scheikunde", "Natuurkunde", "Wiskunde", "Maatschappijleer", "Filosofie", "Kunst"],
  en: ["Dutch", "English", "French", "German", "Spanish", "Latin", "Greek", "Economics", "Business economics", "Computer science", "History", "Geography", "Biology", "Chemistry", "Physics", "Mathematics", "Social studies", "Philosophy", "Art"],
};
