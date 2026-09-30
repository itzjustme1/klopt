import type { ContentLang } from "./types";

/** Characters that are hard to type on a laptop keyboard, per language. */
export const ACCENTS: Partial<Record<ContentLang, string[]>> = {
  fr: ["é", "è", "ê", "ë", "à", "â", "ç", "î", "ï", "ô", "û", "ù", "ü", "œ"],
  de: ["ä", "ö", "ü", "ß"],
  es: ["á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡"],
  it: ["à", "è", "é", "ì", "ò", "ù"],
  nl: ["é", "ë", "ï", "ö", "ü"],
  la: ["ā", "ē", "ī", "ō", "ū"],
};

/** Inserts text at the caret of an input and keeps the caret after it. */
export function insertAtCaret(el: HTMLInputElement | HTMLTextAreaElement, text: string): string {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const value = el.value.slice(0, start) + text + el.value.slice(end);
  el.value = value;
  const at = start + text.length;
  el.setSelectionRange(at, at);
  return value;
}
