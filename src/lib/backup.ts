import { FILE_FORMAT, FILE_VERSION, LIMITS } from "../config";
import { isValidDay, localDay } from "./dates";
import type { Snapshot } from "./db";
import { nextBox } from "./scheduler";
import { blanksOf, QUIZ_LIMITS } from "./quiz";
import { CONTENT_LANGS, MODES, type Box, type Card, type ContentLang, type Deck, type Grade, type Mode, type Quiz, type QuizQuestion, type Review } from "./types";

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
  const file: BackupFile = { format: FILE_FORMAT, version: FILE_VERSION, exportedAt: now.toISOString(), decks: data.decks, cards: data.cards, reviews: data.reviews };
  if (data.quizzes?.length) file.quizzes = data.quizzes;
  return file;
}

/** A shareable deck: cards only, no progress, no review log. */
export function makeShareFile(deck: Deck, cards: readonly Card[], now: Date = new Date()): BackupFile {
  const today = localDay(now);
  return makeBackup(
    {
      // Your folders are your own business: a shared list arrives without one.
      decks: [
        (() => {
          const d = { ...deck };
          delete d.folder;
          return d;
        })(),
      ],
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

/** Only small JPEG, PNG or WebP data URLs: no links to elsewhere, nothing that could run. */
function image(v: unknown, where: string): string {
  if (typeof v !== "string" || v.length > LIMITS.imageChars || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v)) throw new Invalid(where);
  return v;
}

function arr(v: unknown, where: string, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) throw new Invalid(where);
  return v;
}

function validate(raw: unknown, version: number): Snapshot {
  const root = obj(raw, "root", ["format", "version", "exportedAt", "decks", "cards", "reviews", ...(version === 1 ? [] : ["quizzes"])], ["format", "version", "decks", "cards", "reviews"]);
  if (root.exportedAt !== undefined) iso(root.exportedAt, "exportedAt");
  const v1 = version === 1;

  const deckIds = new Set<string>();
  const decks: Deck[] = arr(root.decks, "decks", LIMITS.backupDecks).map((d, i) => {
    const w = `decks[${i}]`;
    const o = v1
      ? obj(d, w, ["id", "name", "lang", "subject", "createdAt"], ["id", "name", "lang", "createdAt"])
      : obj(d, w, ["id", "name", "langFront", "langBack", "subject", "examDate", "kind", "folder", "columns", "createdAt"], ["id", "name", "langFront", "langBack", "createdAt"]);
    const langFront = lang(v1 ? o.lang : o.langFront, v1 ? `${w}.lang` : `${w}.langFront`);
    const langBack = v1 ? langFront : lang(o.langBack, `${w}.langBack`);
    if (v1 && langFront !== "nl" && langFront !== "en") throw new Invalid(`${w}.lang`);
    const deck: Deck = { id: uuid(o.id, `${w}.id`), name: str(o.name, `${w}.name`, LIMITS.deckNameChars), langFront, langBack, createdAt: iso(o.createdAt, `${w}.createdAt`) };
    const subject = optStr(o.subject, `${w}.subject`, LIMITS.labelChars);
    if (subject) deck.subject = subject;
    const folder = v1 ? undefined : optStr(o.folder, `${w}.folder`, LIMITS.labelChars);
    if (folder) deck.folder = folder;
    if (!v1 && o.examDate !== undefined) deck.examDate = day(o.examDate, `${w}.examDate`);
    if (!v1 && o.kind !== undefined) {
      if (o.kind !== "terms" && o.kind !== "words" && o.kind !== "forms") throw new Invalid(`${w}.kind`);
      if (o.kind !== "words") deck.kind = o.kind;
    }
    if (!v1 && o.columns !== undefined) {
      if (deck.kind !== "forms") throw new Invalid(`${w}.columns`);
      const cols = arr(o.columns, `${w}.columns`, LIMITS.formColumns).map((c, k) => str(c, `${w}.columns[${k}]`, LIMITS.columnChars));
      if (!cols.length) throw new Invalid(`${w}.columns`);
      deck.columns = cols;
    }
    if (deckIds.has(deck.id)) throw new Invalid(`${w}.id`);
    deckIds.add(deck.id);
    return deck;
  });

  const cardBoxes = new Map<string, Box>();
  const cardKeys = ["id", "deckId", "front", "back", "topic", "box", "due", "createdAt", "updatedAt", ...(v1 ? [] : ["hist", "lastDay", "starred", "image", "forms"])];
  const cards: Card[] = arr(root.cards, "cards", LIMITS.backupCards).map((c, i) => {
    const w = `cards[${i}]`;
    const o = obj(c, w, cardKeys, ["id", "deckId", "front", "back", "box", "due", "createdAt", "updatedAt"]);
    const card: Card = {
      id: uuid(o.id, `${w}.id`),
      deckId: uuid(o.deckId, `${w}.deckId`),
      // A card with a picture may have no front text.
      front: str(o.front, `${w}.front`, LIMITS.sideChars, o.image === undefined ? 1 : 0),
      back: str(o.back, `${w}.back`, LIMITS.sideChars),
      box: box(o.box, `${w}.box`),
      due: day(o.due, `${w}.due`),
      createdAt: iso(o.createdAt, `${w}.createdAt`),
      updatedAt: iso(o.updatedAt, `${w}.updatedAt`),
    };
    const topic = optStr(o.topic, `${w}.topic`, LIMITS.labelChars);
    if (topic) card.topic = topic;
    if (o.image !== undefined) card.image = image(o.image, `${w}.image`);
    if (o.forms !== undefined) card.forms = arr(o.forms, `${w}.forms`, LIMITS.formColumns).map((f, k) => str(f, `${w}.forms[${k}]`, LIMITS.sideChars, 0));
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

  const quizIds = new Set<string>();
  const quizzes: Quiz[] = root.quizzes === undefined ? [] : arr(root.quizzes, "quizzes", LIMITS.backupDecks).map((q, i) => {
    const quiz = parseQuiz(q, `quizzes[${i}]`);
    if (quizIds.has(quiz.id)) throw new Invalid(`quizzes[${i}].id`);
    quizIds.add(quiz.id);
    return quiz;
  });

  return quizzes.length ? { decks, cards, reviews, quizzes } : { decks, cards, reviews };
}

function parseQuiz(raw: unknown, w: string): Quiz {
  const o = obj(raw, w, ["id", "name", "subject", "folder", "questions", "createdAt", "updatedAt", "last"], ["id", "name", "questions", "createdAt", "updatedAt"]);
  const qIds = new Set<string>();
  const quiz: Quiz = {
    id: uuid(o.id, `${w}.id`),
    name: str(o.name, `${w}.name`, LIMITS.deckNameChars),
    questions: arr(o.questions, `${w}.questions`, QUIZ_LIMITS.questions).map((q, j) => {
      const question = parseQuestion(q, `${w}.questions[${j}]`);
      if (qIds.has(question.id)) throw new Invalid(`${w}.questions[${j}].id`);
      qIds.add(question.id);
      return question;
    }),
    createdAt: iso(o.createdAt, `${w}.createdAt`),
    updatedAt: iso(o.updatedAt, `${w}.updatedAt`),
  };
  const subject = optStr(o.subject, `${w}.subject`, LIMITS.labelChars);
  if (subject) quiz.subject = subject;
  const folder = optStr(o.folder, `${w}.folder`, LIMITS.labelChars);
  if (folder) quiz.folder = folder;
  if (o.last !== undefined) {
    const l = obj(o.last, `${w}.last`, ["points", "total", "at"], ["points", "total", "at"]);
    const total = l.total;
    const points = l.points;
    if (typeof total !== "number" || !Number.isInteger(total) || total < 0 || total > QUIZ_LIMITS.questions) throw new Invalid(`${w}.last.total`);
    if (typeof points !== "number" || !Number.isFinite(points) || points < 0 || points > total) throw new Invalid(`${w}.last.points`);
    quiz.last = { points, total, at: iso(l.at, `${w}.last.at`) };
  }
  return quiz;
}

function parseQuestion(raw: unknown, w: string): QuizQuestion {
  if (typeof raw !== "object" || raw === null) throw new Invalid(w);
  const type = (raw as { type?: unknown }).type;
  const text = (v: unknown, where: string) => str(v, where, QUIZ_LIMITS.text);
  switch (type) {
    case "mc": {
      const o = obj(raw, w, ["id", "type", "prompt", "options", "correct"], ["id", "type", "prompt", "options", "correct"]);
      const options = arr(o.options, `${w}.options`, QUIZ_LIMITS.options).map((x, k) => text(x, `${w}.options[${k}]`));
      if (options.length < 2) throw new Invalid(`${w}.options`);
      const correct = o.correct;
      if (typeof correct !== "number" || !Number.isInteger(correct) || correct < 0 || correct >= options.length) throw new Invalid(`${w}.correct`);
      return { id: uuid(o.id, `${w}.id`), type, prompt: text(o.prompt, `${w}.prompt`), options, correct };
    }
    case "open": {
      const o = obj(raw, w, ["id", "type", "prompt", "answer"], ["id", "type", "prompt", "answer"]);
      return { id: uuid(o.id, `${w}.id`), type, prompt: text(o.prompt, `${w}.prompt`), answer: text(o.answer, `${w}.answer`) };
    }
    case "tf": {
      const o = obj(raw, w, ["id", "type", "prompt", "answer"], ["id", "type", "prompt", "answer"]);
      return { id: uuid(o.id, `${w}.id`), type, prompt: text(o.prompt, `${w}.prompt`), answer: bool(o.answer, `${w}.answer`) };
    }
    case "cloze": {
      const o = obj(raw, w, ["id", "type", "text"], ["id", "type", "text"]);
      const t = text(o.text, `${w}.text`);
      const n = blanksOf(t).length;
      if (n < 1 || n > QUIZ_LIMITS.blanks) throw new Invalid(`${w}.text`);
      return { id: uuid(o.id, `${w}.id`), type, text: t };
    }
    case "dictee": {
      const o = obj(raw, w, ["id", "type", "text", "lang"], ["id", "type", "text", "lang"]);
      const l = lang(o.lang, `${w}.lang`);
      if (l === "xx") throw new Invalid(`${w}.lang`);
      const t = text(o.text, `${w}.text`);
      if (!t.trim()) throw new Invalid(`${w}.text`);
      return { id: uuid(o.id, `${w}.id`), type, text: t, lang: l };
    }
    default:
      throw new Invalid(`${w}.type`);
  }
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
  deck: Pick<Deck, "name" | "langFront" | "langBack" | "subject" | "examDate" | "kind" | "columns">;
  cards: { front: string; back: string; topic?: string; image?: string; forms?: string[] }[];
}

/** A shareable quiz: the questions only, without your last grade or folder. */
export function makeQuizShareFile(quiz: Quiz, now: Date = new Date()): BackupFile {
  const shared: Quiz = { ...quiz };
  delete shared.last;
  delete shared.folder;
  return makeBackup({ decks: [], cards: [], reviews: [], quizzes: [shared] }, now);
}

export interface SharedQuiz {
  quiz: Pick<Quiz, "name" | "subject" | "questions">;
}

export interface SharedFolder {
  name: string;
  decks: SharedDeck[];
  quizzes: SharedQuiz["quiz"][];
}

export type SharedItem = { kind: "deck"; data: SharedDeck } | { kind: "quiz"; data: SharedQuiz } | { kind: "folder"; data: SharedFolder };

/** A shareable folder: its lists (words only) and quizzes, each marked with the folder name. */
export function makeFolderShareFile(name: string, decks: readonly Deck[], cards: readonly Card[], quizzes: readonly Quiz[], now: Date = new Date()): BackupFile {
  const today = localDay(now);
  const ids = new Set(decks.map((d) => d.id));
  return makeBackup(
    {
      decks: decks.map((d) => ({ ...d, folder: name })),
      cards: cards
        .filter((c) => ids.has(c.deckId))
        .map((c) => {
          const out: Card = { ...c, box: 1, due: today };
          delete out.hist;
          delete out.lastDay;
          delete out.starred;
          return out;
        }),
      reviews: [],
      quizzes: quizzes.map((q) => {
        const out: Quiz = { ...q, folder: name };
        delete out.last;
        return out;
      }),
    },
    now,
  );
}

/** A shared file or link holds exactly one list, or exactly one quiz. */
export function parseSharedItem(text: string): Parsed<SharedItem> {
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  const { decks, cards, quizzes = [] } = parsed.data;
  // A folder: everything in the file carries the same folder name.
  const folders = new Set([...decks.map((d) => d.folder ?? ""), ...quizzes.map((q) => q.folder ?? "")]);
  if (folders.size === 1 && !folders.has("") && decks.length + quizzes.length > 0) {
    const name = [...folders][0]!;
    if (quizzes.some((q) => !q.questions.length) || decks.some((d) => !cards.some((c) => c.deckId === d.id))) return { ok: false, error: { code: "invalid", where: "folder" } };
    return {
      ok: true,
      data: { kind: "folder", data: { name, decks: decks.map((d) => toSharedDeck(d, cards.filter((c) => c.deckId === d.id))), quizzes: quizzes.map(toSharedQuiz) } },
    };
  }
  if (decks.length === 0 && quizzes.length === 1) {
    const q = quizzes[0]!;
    if (!q.questions.length) return { ok: false, error: { code: "invalid", where: "quizzes" } };
    return { ok: true, data: { kind: "quiz", data: { quiz: toSharedQuiz(q) } } };
  }
  if (quizzes.length) return { ok: false, error: { code: "invalid", where: "quizzes" } };
  const deck = parseShared(text);
  return deck.ok ? { ok: true, data: { kind: "deck", data: deck.data } } : deck;
}

/** A shared deck must hold exactly one deck. Progress in it is ignored. */
function toSharedDeck(d: Deck, cards: readonly Card[]): SharedDeck {
  const deck: SharedDeck["deck"] = { name: d.name, langFront: d.langFront, langBack: d.langBack };
  if (d.subject) deck.subject = d.subject;
  if (d.examDate) deck.examDate = d.examDate;
  if (d.kind) deck.kind = d.kind;
  if (d.columns) deck.columns = d.columns;
  return {
    deck,
    cards: cards.map((c) => {
      const out: SharedDeck["cards"][number] = { front: c.front, back: c.back };
      if (c.topic) out.topic = c.topic;
      if (c.image) out.image = c.image;
      if (c.forms) out.forms = c.forms;
      return out;
    }),
  };
}

function toSharedQuiz(q: Quiz): SharedQuiz["quiz"] {
  const quiz: SharedQuiz["quiz"] = { name: q.name, questions: q.questions };
  if (q.subject) quiz.subject = q.subject;
  return quiz;
}

export function parseShared(text: string): Parsed<SharedDeck> {
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  const { decks, cards } = parsed.data;
  if (decks.length !== 1) return { ok: false, error: { code: "invalid", where: "decks" } };
  if (cards.length === 0) return { ok: false, error: { code: "invalid", where: "cards" } };
  return { ok: true, data: toSharedDeck(decks[0]!, cards) };
}
