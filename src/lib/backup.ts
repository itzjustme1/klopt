import { FILE_FORMAT, FILE_VERSION, LIMITS } from "../config";
import { isValidDay, localDay } from "./dates";
import type { Snapshot } from "./db";
import { nextBox } from "./scheduler";
import { CONTENT_LANGS, MODES, type Box, type Card, type ContentLang, type Deck, type Grade, type Mode, type Review } from "./types";

export interface BackupFile extends Snapshot {
  format: typeof FILE_FORMAT;
  version: number;
  exportedAt: string;
}

export type BackupError =
  | { code: "tooBig" }
  | { code: "notJson" }
  | { code: "format" }
  | { code: "version" }
  | { code: "invalid"; where: string };

export type Parsed<T> = { ok: true; data: T } | { ok: false; error: BackupError };

export function makeBackup(data: Snapshot, now: Date = new Date()): BackupFile {
  return { format: FILE_FORMAT, version: FILE_VERSION, exportedAt: now.toISOString(), decks: data.decks, cards: data.cards, reviews: data.reviews };
}

/** A shareable deck: cards only, no progress, no review log. */
export function makeShareFile(deck: Deck, cards: readonly Card[], now: Date = new Date()): BackupFile {
  const today = localDay(now);
  return makeBackup(
    {
      decks: [deck],
      cards: cards.map((c) => {
        const out: Card = { ...c, box: 1, due: today };
        delete out.hist;
        delete out.lastDay;
        delete out.starred;
        return out;
      }),
      reviews: [],
    },
    now,
  );
}

export function backupFileName(appName: string, now: Date = new Date(), kind: "backup" | "deck" = "backup", deckName = ""): string {
  const base = appName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (kind === "deck") {
    const slug = deckName.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "stapel";
    return `${base}-${slug}.json`;
  }
  return `${base}-backup-${localDay(now)}.json`;
}

// Validation. Every field is checked; unknown keys are rejected so nothing unexpected is stored.

class Invalid extends Error {
  constructor(readonly where: string) {
    super(where);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

type Obj = Record<string, unknown>;

function obj(v: unknown, where: string, allowed: readonly string[], required: readonly string[]): Obj {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Invalid(where);
  for (const k of Object.keys(v)) if (!allowed.includes(k)) throw new Invalid(`${where}.${k}`);
  for (const k of required) if (!(k in v)) throw new Invalid(`${where}.${k}`);
  return v as Obj;
}

function str(v: unknown, where: string, max: number, min = 1): string {
  if (typeof v !== "string" || v.length < min || v.length > max) throw new Invalid(where);
  return v;
}

function optStr(v: unknown, where: string, max: number): string | undefined {
  if (v === undefined) return undefined;
  return str(v, where, max, 0) || undefined;
}

function uuid(v: unknown, where: string): string {
  if (typeof v !== "string" || !UUID.test(v)) throw new Invalid(where);
  return v.toLowerCase();
}

function iso(v: unknown, where: string): string {
  if (typeof v !== "string" || !ISO.test(v) || Number.isNaN(Date.parse(v))) throw new Invalid(where);
  return v;
}

function day(v: unknown, where: string): string {
  if (!isValidDay(v)) throw new Invalid(where);
  return v;
}

function box(v: unknown, where: string): Box {
  if (v !== 1 && v !== 2 && v !== 3 && v !== 4 && v !== 5) throw new Invalid(where);
  return v;
}

function lang(v: unknown, where: string): ContentLang {
  if (typeof v !== "string" || !(CONTENT_LANGS as readonly string[]).includes(v)) throw new Invalid(where);
  return v as ContentLang;
}

function mode(v: unknown, where: string): Mode {
  if (typeof v !== "string" || !(MODES as readonly string[]).includes(v)) throw new Invalid(where);
  return v as Mode;
}

function bool(v: unknown, where: string): boolean {
  if (typeof v !== "boolean") throw new Invalid(where);
  return v;
}

function grade(v: unknown, where: string): Grade {
  if (v !== "fout" && v !== "twijfel" && v !== "goed") throw new Invalid(where);
  return v;
}

function arr(v: unknown, where: string, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) throw new Invalid(where);
  return v;
}

function validate(raw: unknown, version: number): Snapshot {
  const root = obj(raw, "root", ["format", "version", "exportedAt", "decks", "cards", "reviews"], ["format", "version", "decks", "cards", "reviews"]);
  if (root.exportedAt !== undefined) iso(root.exportedAt, "exportedAt");
  const v1 = version === 1;

  const deckIds = new Set<string>();
  const decks: Deck[] = arr(root.decks, "decks", LIMITS.backupDecks).map((d, i) => {
    const w = `decks[${i}]`;
    const o = v1
      ? obj(d, w, ["id", "name", "lang", "subject", "createdAt"], ["id", "name", "lang", "createdAt"])
      : obj(d, w, ["id", "name", "langFront", "langBack", "subject", "createdAt"], ["id", "name", "langFront", "langBack", "createdAt"]);
    const langFront = lang(v1 ? o.lang : o.langFront, v1 ? `${w}.lang` : `${w}.langFront`);
    const langBack = v1 ? langFront : lang(o.langBack, `${w}.langBack`);
    if (v1 && langFront !== "nl" && langFront !== "en") throw new Invalid(`${w}.lang`);
    const deck: Deck = { id: uuid(o.id, `${w}.id`), name: str(o.name, `${w}.name`, LIMITS.deckNameChars), langFront, langBack, createdAt: iso(o.createdAt, `${w}.createdAt`) };
    const subject = optStr(o.subject, `${w}.subject`, LIMITS.labelChars);
    if (subject) deck.subject = subject;
    if (deckIds.has(deck.id)) throw new Invalid(`${w}.id`);
    deckIds.add(deck.id);
    return deck;
  });

  const cardBoxes = new Map<string, Box>();
  const cardKeys = ["id", "deckId", "front", "back", "topic", "box", "due", "createdAt", "updatedAt", ...(v1 ? [] : ["hist", "lastDay", "starred"])];
  const cards: Card[] = arr(root.cards, "cards", LIMITS.backupCards).map((c, i) => {
    const w = `cards[${i}]`;
    const o = obj(c, w, cardKeys, ["id", "deckId", "front", "back", "box", "due", "createdAt", "updatedAt"]);
    const card: Card = {
      id: uuid(o.id, `${w}.id`),
      deckId: uuid(o.deckId, `${w}.deckId`),
      front: str(o.front, `${w}.front`, LIMITS.sideChars),
      back: str(o.back, `${w}.back`, LIMITS.sideChars),
      box: box(o.box, `${w}.box`),
      due: day(o.due, `${w}.due`),
      createdAt: iso(o.createdAt, `${w}.createdAt`),
      updatedAt: iso(o.updatedAt, `${w}.updatedAt`),
    };
    const topic = optStr(o.topic, `${w}.topic`, LIMITS.labelChars);
    if (topic) card.topic = topic;
    // Caches are validated but not trusted: they are rebuilt from the review log on import.
    if (o.hist !== undefined && (typeof o.hist !== "string" || !/^[gtf]{0,8}$/.test(o.hist))) throw new Invalid(`${w}.hist`);
    if (o.lastDay !== undefined) day(o.lastDay, `${w}.lastDay`);
    if (o.starred !== undefined) {
      if (bool(o.starred, `${w}.starred`)) card.starred = true;
    }
    if (!deckIds.has(card.deckId)) throw new Invalid(`${w}.deckId`);
    if (cardBoxes.has(card.id)) throw new Invalid(`${w}.id`);
    cardBoxes.set(card.id, card.box);
    return card;
  });

  const reviewIds = new Set<string>();
  const reviewKeys = ["id", "cardId", "at", "day", "grade", "fromBox", "toBox", ...(v1 ? [] : ["mode", "counts"])];
  const reviews: Review[] = arr(root.reviews, "reviews", LIMITS.backupReviews).map((r, i) => {
    const w = `reviews[${i}]`;
    const o = obj(r, w, reviewKeys, reviewKeys);
    const review: Review = {
      id: uuid(o.id, `${w}.id`),
      cardId: uuid(o.cardId, `${w}.cardId`),
      at: iso(o.at, `${w}.at`),
      day: day(o.day, `${w}.day`),
      grade: grade(o.grade, `${w}.grade`),
      fromBox: box(o.fromBox, `${w}.fromBox`),
      toBox: box(o.toBox, `${w}.toBox`),
      mode: v1 ? "herhalen" : mode(o.mode, `${w}.mode`),
      counts: v1 ? true : bool(o.counts, `${w}.counts`),
    };
    if (!cardBoxes.has(review.cardId)) throw new Invalid(`${w}.cardId`);
    const expected = review.counts ? nextBox(review.fromBox, review.grade) : review.fromBox;
    if (expected !== review.toBox) throw new Invalid(`${w}.toBox`);
    if (reviewIds.has(review.id)) throw new Invalid(`${w}.id`);
    reviewIds.add(review.id);
    return review;
  });

  return { decks, cards, reviews };
}

/** Strictly parses a backup or shared-deck file. Never throws. */
export function parseBackup(text: string): Parsed<Snapshot> {
  if (text.length > LIMITS.backupBytes) return { ok: false, error: { code: "tooBig" } };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: { code: "notJson" } };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, error: { code: "notJson" } };
  const head = raw as Obj;
  if (head.format !== FILE_FORMAT) return { ok: false, error: { code: "format" } };
  if (typeof head.version !== "number" || !Number.isInteger(head.version) || head.version < 1) return { ok: false, error: { code: "invalid", where: "version" } };
  if (head.version > FILE_VERSION) return { ok: false, error: { code: "version" } };
  try {
    return { ok: true, data: validate(raw, head.version) };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: { code: "invalid", where: e.where } };
    return { ok: false, error: { code: "invalid", where: "root" } };
  }
}

export interface SharedDeck {
  deck: Pick<Deck, "name" | "langFront" | "langBack" | "subject">;
  cards: { front: string; back: string; topic?: string }[];
}

/** A shared deck must hold exactly one deck. Progress in it is ignored. */
export function parseShared(text: string): Parsed<SharedDeck> {
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  const { decks, cards } = parsed.data;
  if (decks.length !== 1) return { ok: false, error: { code: "invalid", where: "decks" } };
  if (cards.length === 0) return { ok: false, error: { code: "invalid", where: "cards" } };
  const d = decks[0]!;
  const deck: SharedDeck["deck"] = { name: d.name, langFront: d.langFront, langBack: d.langBack };
  if (d.subject) deck.subject = d.subject;
  return {
    ok: true,
    data: {
      deck,
      cards: cards.map((c) => {
        const out: SharedDeck["cards"][number] = { front: c.front, back: c.back };
        if (c.topic) out.topic = c.topic;
        return out;
      }),
    },
  };
}
