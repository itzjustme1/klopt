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
