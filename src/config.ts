/** The only place the app's display name lives. */
export const APP_NAME = "Klopt";

/** Fixed technical identifier inside backup and share files. Never change it when renaming the app. */
export const FILE_FORMAT = "klopt-backup";
export const FILE_VERSION = 2;

/**
 * The Supabase project behind the optional accounts. Left empty, accounts are switched off and nothing
 * ever leaves the device. The anon key is meant to be public: row level security in the database
 * (supabase/schema.sql) decides what each signed-in student may read and write.
 */
const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
export const ACCOUNT = {
  url: env.VITE_ACCOUNT_URL ?? "",
  anonKey: env.VITE_ACCOUNT_KEY ?? "",
} as const;

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
  /** Max length of a card picture (a JPEG data URL, about 300 kB). */
  imageChars: 400_000,
  /** Longest side of a card picture after downscaling, in pixels. */
  imagePixels: 640,
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
