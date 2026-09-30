/** The only place the app's display name lives. */
export const APP_NAME = "Klopt";

/** Fixed technical identifier inside backup and share files. Never change it when renaming the app. */
export const FILE_FORMAT = "klopt-backup";
export const FILE_VERSION = 2;

export const LIMITS = {
  /** Max cards per text import. */
  importCards: 2000,
  /** Max characters per card side (import, editor, backup, share). */
  sideChars: 2000,
  /** Max raw text accepted in the import box, in characters. */
  importRawChars: 10_000_000,
  /** Max share-link fragment length before we offer a file instead. */
  shareLinkChars: 8000,
  /** Max decompressed bytes accepted from a share link. */
  shareInflatedBytes: 2_000_000,
  /** Max backup file size in bytes. */
  backupBytes: 50_000_000,
  /** Max deck name length. */
  deckNameChars: 120,
  /** Max subject / topic length. */
  labelChars: 120,
  /** Max records of each kind in a backup. */
  backupDecks: 1000,
  backupCards: 200_000,
  backupReviews: 2_000_000,
  /** Created or edited cards since the last export before we remind about a backup. */
  backupReminderChanges: 50,
} as const;
