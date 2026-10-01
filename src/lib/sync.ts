/**
 * Sync between this device and the account, local-first.
 *
 * - The device keeps working without a connection; a sync pushes what changed here and pulls what
 *   changed elsewhere since the last time.
 * - Lists, cards and quizzes: the newest edit wins (cards and quizzes by their own updatedAt, lists by
 *   the server's time). A deletion travels as a tombstone.
 * - Answers (reviews) are append-only, so both sides simply keep the union. A card's box and due date
 *   are then replayed from the combined log, which stays the single source of truth.
 * - Everything pulled goes through the same strict validation as a backup file before it is used.
 */
import { FILE_FORMAT, FILE_VERSION } from "../config";
import { parseBackup } from "./backup";
import type { Snapshot } from "./db";
import { review as schedule } from "./scheduler";
import type { Card, Deck, Quiz, Review } from "./types";

export type RecordKind = "deck" | "card" | "review" | "quiz";

export interface RemoteRow {
  kind: RecordKind;
  id: string;
  data: unknown;
  deleted: boolean;
  /** Set by the server; the order of changes. */
  updated_at: string;
}

export interface PushRow {
  kind: RecordKind;
  id: string;
  data: unknown;
  deleted: boolean;
}

export interface Remote {
  /** Rows changed after `since` (all rows when null), oldest first. */
  pull(since: string | null): Promise<RemoteRow[]>;
  /** Stores rows; returns them with the server's updated_at. */
  push(rows: PushRow[]): Promise<RemoteRow[]>;
}

export interface SyncState {
  /** updated_at of the newest row seen. */
  cursor: string | null;
  /** What each record looked like at the last sync, by "kind:id". */
  hashes: Record<string, string>;
}

export const EMPTY_SYNC: SyncState = { cursor: null, hashes: {} };

type AnyRecord = Deck | Card | Review | Quiz;

/** The part of a record that counts as a change. Caches and the box/due derived from answers do not. */
function syncable(kind: RecordKind, r: AnyRecord): AnyRecord {
  if (kind !== "card") return r;
  const c = { ...(r as Card) };
  delete c.hist;
  delete c.lastDay;
  return c;
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** A short fingerprint (FNV-1a, 52 bits) of a record's syncable content. */
export function fingerprint(kind: RecordKind, r: AnyRecord): string {
  const content = { ...syncable(kind, r) } as Record<string, unknown>;
  if (kind === "card") {
    // Box and due date follow from the answers, which sync on their own.
    delete content.box;
    delete content.due;
  }
  const s = stable(content);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return `${h1.toString(36)}${(h2 & 0xfffff).toString(36)}`;
}

function records(s: Snapshot): Map<string, { kind: RecordKind; id: string; data: AnyRecord }> {
  const out = new Map<string, { kind: RecordKind; id: string; data: AnyRecord }>();
  for (const d of s.decks) out.set(`deck:${d.id}`, { kind: "deck", id: d.id, data: d });
  for (const c of s.cards) out.set(`card:${c.id}`, { kind: "card", id: c.id, data: c });
  for (const r of s.reviews) out.set(`review:${r.id}`, { kind: "review", id: r.id, data: r });
  for (const q of s.quizzes ?? []) out.set(`quiz:${q.id}`, { kind: "quiz", id: q.id, data: q });
  return out;
}

function editedAt(kind: RecordKind, data: unknown): string {
  if ((kind === "card" || kind === "quiz") && data && typeof data === "object" && typeof (data as { updatedAt?: unknown }).updatedAt === "string") {
    return (data as { updatedAt: string }).updatedAt;
  }
  return "";
}

/** Box and due date of every answered card, replayed from the answers that count, in order. */
export function replayBoxes(cards: readonly Card[], reviews: readonly Review[]): Card[] {
  const byCard = new Map<string, Review[]>();
  for (const r of reviews) if (r.counts) (byCard.get(r.cardId) ?? byCard.set(r.cardId, []).get(r.cardId)!).push(r);
  return cards.map((c) => {
    const log = byCard.get(c.id);
    if (!log?.length) return c;
    log.sort((a, b) => a.at.localeCompare(b.at));
    let state = { box: 1 as Card["box"], due: c.due };
    for (const r of log) state = schedule(state, r.grade, r.day);
    return state.box === c.box && state.due === c.due ? c : { ...c, box: state.box, due: state.due };
  });
}

export interface Merge {
  /** The local data after taking in what was pulled, already validated; null when nothing came in. */
  merged: Snapshot | null;
  push: PushRow[];
}

/**
 * Decides what to push and what the local data becomes. Pure: no IO, so it can be tested on its own.
 * Throws when the combined data would not be a valid backup (the local data is then left alone).
 */
export function merge(local: Snapshot, pulled: readonly RemoteRow[], state: SyncState): Merge {
  const mine = records(local);
  // Local changes since the last sync.
  const changed = new Set<string>();
  for (const [key, r] of mine) if (state.hashes[key] !== fingerprint(r.kind, r.data)) changed.add(key);
  const deleted = new Set(Object.keys(state.hashes).filter((key) => !mine.has(key)));

  // Remote changes: keep the newest row per record.
  const theirs = new Map<string, RemoteRow>();
  for (const row of pulled) {
    const key = `${row.kind}:${row.id}`;
    const prev = theirs.get(key);
    if (!prev || row.updated_at >= prev.updated_at) theirs.set(key, row);
  }

  const result = new Map(mine);
  let incoming = false;
  for (const [key, row] of theirs) {
    // Ignore an echo of what this device already has.
    const here = mine.get(key);
    if (!row.deleted && here && fingerprint(row.kind, here.data) === fingerprint(row.kind, row.data as AnyRecord)) continue;
    if (deleted.has(key) && row.deleted) {
      deleted.delete(key);
      continue;
    }
    const localWins =
      (changed.has(key) || deleted.has(key)) &&
      // Both sides changed it: cards and quizzes compare their own edit time; for the rest this device's
      // pending change wins, because it reaches the server after the other one.
      (row.kind === "card" || row.kind === "quiz" ? editedAt(row.kind, here?.data) >= editedAt(row.kind, row.data) : true);
    if (localWins) continue;
    incoming = true;
    changed.delete(key);
    deleted.delete(key);
    if (row.deleted) result.delete(key);
    else result.set(key, { kind: row.kind, id: row.id, data: row.data as AnyRecord });
  }

  const push: PushRow[] = [];
  for (const key of changed) {
    const r = result.get(key);
    if (r) push.push({ kind: r.kind, id: r.id, data: syncable(r.kind, r.data), deleted: false });
  }
  for (const key of deleted) {
    const [kind, ...rest] = key.split(":");
    push.push({ kind: kind as RecordKind, id: rest.join(":"), data: null, deleted: true });
  }

  if (!incoming) return { merged: null, push };

  // Rebuild a snapshot, drop anything whose list or card is gone, and validate it like a backup.
  const all = [...result.values()];
  const decks = all.filter((r) => r.kind === "deck").map((r) => r.data as Deck);
  const deckIds = new Set(decks.map((d) => d.id));
  const cards = all.filter((r) => r.kind === "card").map((r) => r.data as Card).filter((c) => deckIds.has(c.deckId));
  const cardIds = new Set(cards.map((c) => c.id));
  const reviews = all
    .filter((r) => r.kind === "review")
    .map((r) => r.data as Review)
    .filter((r) => cardIds.has(r.cardId))
    .sort((a, b) => a.at.localeCompare(b.at));
  const quizzes = all.filter((r) => r.kind === "quiz").map((r) => r.data as Quiz);
  const candidate = { format: FILE_FORMAT, version: FILE_VERSION, decks, cards: replayBoxes(cards, reviews), reviews, quizzes };
  const parsed = parseBackup(JSON.stringify(candidate));
  if (!parsed.ok) throw new Error(`Invalid data from the account (${"where" in parsed.error ? parsed.error.where : parsed.error.code})`);
  return { merged: { ...parsed.data, quizzes: parsed.data.quizzes ?? [] }, push };
}

/** The state after a successful sync of `final`. */
export function nextState(final: Snapshot, rows: readonly RemoteRow[], prev: SyncState): SyncState {
  const hashes: Record<string, string> = {};
  for (const [key, r] of records(final)) hashes[key] = fingerprint(r.kind, r.data);
  let cursor = prev.cursor;
  for (const r of rows) if (!cursor || r.updated_at > cursor) cursor = r.updated_at;
  return { cursor, hashes };
}

/**
 * One full sync round. `apply` writes the merged data locally (only called when something came in) and
 * returns false when the local data changed in the meantime; the round then counts as not done, and
 * the next one picks everything up again (pushes are idempotent).
 */
export async function syncOnce(
  local: Snapshot,
  remote: Remote,
  state: SyncState,
  apply: (merged: Snapshot) => Promise<boolean>,
): Promise<{ state: SyncState; pulled: number; pushed: number; applied: boolean }> {
  const pulled = await remote.pull(state.cursor);
  const { merged, push } = merge(local, pulled, state);
  const stored: RemoteRow[] = [];
  for (let i = 0; i < push.length; i += 500) stored.push(...(await remote.push(push.slice(i, i + 500))));
  if (merged && !(await apply(merged))) return { state, pulled: pulled.length, pushed: push.length, applied: false };
  return { state: nextState(merged ?? local, [...pulled, ...stored], state), pulled: pulled.length, pushed: push.length, applied: true };
}

/** True when two snapshots hold the same records (ignoring caches). */
export function sameContent(a: Snapshot, b: Snapshot): boolean {
  const ra = records(a);
  const rb = records(b);
  if (ra.size !== rb.size) return false;
  for (const [key, r] of ra) {
    const o = rb.get(key);
    if (!o || fingerprint(r.kind, r.data) !== fingerprint(o.kind, o.data)) return false;
  }
  return true;
}
