import { LIMITS } from "../config";
import { t } from "../i18n/index.svelte";
import type { StringKey } from "../i18n/types";
import type { BackupError } from "./backup";
import type { SkipReason } from "./importText";

export function backupErrorText(e: BackupError | { code: "read" }): string {
  switch (e.code) {
    case "tooBig":
      return t("backup.err.tooBig", { mb: Math.round(LIMITS.backupBytes / 1_000_000) });
    case "notJson":
      return t("backup.err.notJson");
    case "format":
      return t("backup.err.format");
    case "version":
      return t("backup.err.version");
    case "read":
      return t("backup.err.read");
    case "invalid":
      return t("backup.err.invalid", { where: e.where });
  }
}

const SKIP_KEYS: Record<SkipReason, StringKey> = {
  noSeparator: "import.err.noSeparator",
  emptyFront: "import.err.emptyFront",
  emptyBack: "import.err.emptyBack",
  tooLong: "import.err.tooLong",
  duplicate: "import.err.duplicate",
};

export function skipText(line: number, reason: SkipReason): string {
  return t(SKIP_KEYS[reason], { line, n: LIMITS.sideChars });
}
