import { t } from "../i18n/index.svelte";
import { href } from "./router";
import { parseScope } from "./scope";

/** Where "stop" goes after practising a scope, and what it is called. */
export function scopeExit(scope: string): { href: string; label: string } {
  const s = parseScope(scope);
  if (s.kind === "all") return { href: href.today(), label: t("practice.backHome") };
  if (s.kind === "folder") return { href: href.folder(s.name), label: t("practice.backToFolder") };
  if (s.kind === "decks") return { href: href.lists(), label: t("practice.backToLists") };
  return { href: href.deck(s.id), label: t("practice.backToList") };
}

/** What a scope is called on screen ("Frans H1", "map Toets 1", "WO2 en Economie"); null when it no longer exists. */
export function scopeName(scope: string, decks: readonly { id: string; name: string; folder?: string }[]): string | null {
  const s = parseScope(scope);
  if (s.kind === "all") return null;
  if (s.kind === "deck") return decks.find((d) => d.id === s.id)?.name ?? null;
  if (s.kind === "folder") return decks.some((d) => d.folder === s.name) ? t("scope.folder", { name: s.name }) : null;
  const names = s.ids.flatMap((id) => decks.filter((d) => d.id === id).map((d) => d.name));
  if (!names.length) return null;
  return names.length <= 2 ? names.join(t("scope.and")) : t("scope.lists", { first: names[0]!, n: names.length - 1 });
}
