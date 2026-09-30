import type { IconName } from "../components/Icon.svelte";
import type { Mode } from "./types";

/** Colour per practice mode (1–8, the --ic-N tokens), the same on every screen. */
export const MODE_COLOR: Record<Mode, number> = {
  herhalen: 7,
  leren: 1,
  flashcards: 2,
  meerkeuze: 3,
  typen: 5,
  dictee: 4,
  toets: 8,
  koppelen: 6,
};

export const MODE_ICON: Record<Mode, IconName> = {
  herhalen: "review",
  leren: "learn",
  flashcards: "cards",
  meerkeuze: "choice",
  typen: "type",
  dictee: "listen",
  toets: "test",
  koppelen: "match",
};
