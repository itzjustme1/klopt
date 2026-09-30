import { APP_NAME } from "../config";
import type { Lang } from "../lib/types";
import { en } from "./en";
import { nl } from "./nl";
import type { Messages, Plural, PluralKey, StringKey, Vars } from "./types";

export const locales: Record<Lang, Messages> = { nl, en };

const state = $state({ lang: "nl" as Lang });

export function getLang(): Lang {
  return state.lang;
}

export function setLang(lang: Lang): void {
  state.lang = lang;
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

export function interpolate(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (name === "app") return APP_NAME;
    const v = vars[name];
    return v === undefined ? whole : String(v);
  });
}

export function translate(lang: Lang, key: StringKey, vars?: Vars): string {
  return interpolate(locales[lang][key] as string, vars);
}

export function translatePlural(lang: Lang, key: PluralKey, n: number, vars: Vars = {}): string {
  const forms = locales[lang][key] as Plural;
  const rule = new Intl.PluralRules(lang).select(n);
  return interpolate(rule === "one" ? forms.one : forms.other, { n: formatNumber(lang, n), ...vars });
}

export function formatNumber(lang: Lang, n: number): string {
  return new Intl.NumberFormat(lang).format(n);
}

/** Reactive helpers for components. */
export const t = (key: StringKey, vars?: Vars): string => translate(state.lang, key, vars);
export const tp = (key: PluralKey, n: number, vars?: Vars): string => translatePlural(state.lang, key, n, vars);
export const num = (n: number): string => formatNumber(state.lang, n);
