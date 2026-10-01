import type { IconName } from "../components/Icon.svelte";
import type { Mode } from "./types";

export const MODE_ICON: Record<Mode, IconName> = {
  herhalen: "review",
  leren: "learn",
  flashcards: "cards",
  meerkeuze: "choice",
  typen: "type",
  dictee: "listen",
  toets: "test",
  koppelen: "match",
  vervoegen: "rows",
  spelling: "spell",
};
