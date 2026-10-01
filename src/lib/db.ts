/** The only module that touches IndexedDB. */
import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from "idb";
import { localDay } from "./dates";
import { appendHist, rebuildCaches } from "./history";
import { answerCard } from "./scheduler";
import type { Card, ContentLang, Box, DayStat, Deck, Grade, Lang, Mode, Quiz, Review, Settings } from "./types";

export const SCHEMA_VERSION = 3;

interface KloptDB extends DBSchema {
  decks: { key: string; value: Deck };
  cards: { key: string; value: Card; indexes: { deckId: string; due: string } };
  reviews: { key: string; value: Review; indexes: { cardId: string } };
  days: { key: string; value: DayStat };
  meta: { key: string; value: Settings };
  quizzes: { key: string; value: Quiz };
}

export interface Snapshot {
  decks: Deck[];
  cards: Card[];
  reviews: Review[];
  /** Absent in files from before quizzes existed. */
  quizzes?: Quiz[];
}

const SETTINGS_KEY = "settings";
/**
 * Version 3 of the look (the StudyGo app in navy) is dark by default. Settings from an older look move
 * to it once; light or "system" chosen after that stays.
 */
export const DESIGN_VERSION = 3;

export function detectLang(navLang: string | undefined): Lang {
  return navLang?.toLowerCase().startsWith("en") ? "en" : "nl";
}

export function defaultSettings(navLang?: string): Settings {
  return {
    uiLang: detectLang(navLang),
    theme: "dark",
    schemaVersion: SCHEMA_VERSION,
    designVersion: DESIGN_VERSION,
    dailyGoal: 20,
    autoSpeak: false,
    lenientAccents: false,
    lenientTypos: false,
    sounds: true,
    changesSinceExport: 0,
    reminderSnoozedAt: 0,
    persistRequested: false,
    installHintDismissed: false,
  };
}

export type NewCard = Pick<Card, "front" | "back"> & Partial<Pick<Card, "topic" | "image" | "forms">>;
export type DeckInput = Pick<Deck, "name" | "langFront" | "langBack"> & Partial<Pick<Deck, "subject" | "examDate" | "kind" | "folder" | "columns">>;

/**
 * Random UUID v4. crypto.randomUUID only exists in secure contexts (https or localhost), so opening
 * the dev server from a phone over the local network (http://192.168…) falls back to getRandomValues.
 */
export function newId(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : uuidFromRandom();
}

export function uuidFromRandom(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** A fresh card: box 1, due today. */
export function makeCard(deckId: string, input: NewCard, now: Date = new Date()): Card {
  const iso = now.toISOString();
  const card: Card = { id: newId(), deckId, front: input.front, back: input.back, box: 1, due: localDay(now), createdAt: iso, updatedAt: iso };
  if (input.topic) card.topic = input.topic;
  if (input.image) card.image = input.image;
  if (input.forms?.some((f) => f)) card.forms = [...input.forms];
  return card;
}

type UpgradeTx = IDBPTransaction<KloptDB, ("decks" | "cards" | "reviews" | "days" | "meta")[], "versionchange">;

/** v1 → v2: two languages per deck, mode + counts on reviews, per-card caches, per-day stats. */
async function migrateV1(tx: UpgradeTx): Promise<void> {
  const decks = tx.objectStore("decks");
  for (let cur = await decks.openCursor(); cur; cur = await cur.continue()) {
    const old = cur.value as Deck & { lang?: ContentLang };
    const lang = old.lang ?? "nl";
    const next: Deck = { id: old.id, name: old.name, langFront: lang, langBack: lang, createdAt: old.createdAt };
    if (old.subject) next.subject = old.subject;
    await cur.update(next);
  }
  const reviewsStore = tx.objectStore("reviews");
  const reviews: Review[] = [];
  for (let cur = await reviewsStore.openCursor(); cur; cur = await cur.continue()) {
    const r = { ...(cur.value as Review), mode: "herhalen" as Mode, counts: true };
    reviews.push(r);
    await cur.update(r);
  }
  const caches = rebuildCaches(reviews);
  const cards = tx.objectStore("cards");
  for (let cur = await cards.openCursor(); cur; cur = await cur.continue()) {
    const c = caches.cards.get(cur.value.id);
    if (c) await cur.update({ ...cur.value, ...c });
  }
  const days = tx.objectStore("days");
  for (const d of caches.days) await days.put(d);
}

export class Store {
  /** Timestamp of the last answer written, to keep the log strictly ordered. */
  private lastAnswerMs = 0;

  private constructor(private readonly db: IDBPDatabase<KloptDB>) {}

  static async open(name = "klopt"): Promise<Store> {
    const db = await openDB<KloptDB>(name, SCHEMA_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore("decks", { keyPath: "id" });
          const cards = db.createObjectStore("cards", { keyPath: "id" });
          cards.createIndex("deckId", "deckId");
          cards.createIndex("due", "due");
          const reviews = db.createObjectStore("reviews", { keyPath: "id" });
          reviews.createIndex("cardId", "cardId");
          db.createObjectStore("meta");
        }
        if (oldVersion < 2) {
          db.createObjectStore("days", { keyPath: "day" });
          if (oldVersion >= 1) await migrateV1(tx as unknown as UpgradeTx);
        }
        if (oldVersion < 3) db.createObjectStore("quizzes", { keyPath: "id" });
      },
    });
    return new Store(db);
  }

  close(): void {
    this.db.close();
  }

  // Settings

  async getSettings(navLang?: string): Promise<Settings> {
    const stored = await this.db.get("meta", SETTINGS_KEY);
    if (stored && (stored.designVersion ?? 1) < DESIGN_VERSION) {
      return this.saveSettings({ designVersion: DESIGN_VERSION, theme: "dark" }, navLang);
    }
    return { ...defaultSettings(navLang), ...stored, schemaVersion: SCHEMA_VERSION };
  }

  async saveSettings(patch: Partial<Settings>, navLang?: string): Promise<Settings> {
    const tx = this.db.transaction("meta", "readwrite");
    const current = { ...defaultSettings(navLang), ...(await tx.store.get(SETTINGS_KEY)) };
    const next = { ...current, ...patch, schemaVersion: SCHEMA_VERSION };
    await tx.store.put(next, SETTINGS_KEY);
    await tx.done;
    return next;
  }

  async countChanges(n: number): Promise<void> {
    if (n <= 0) return;
    const tx = this.db.transaction("meta", "readwrite");
    const current = { ...defaultSettings(), ...(await tx.store.get(SETTINGS_KEY)) };
    current.changesSinceExport += n;
    await tx.store.put(current, SETTINGS_KEY);
    await tx.done;
  }

  // Decks

  async listDecks(): Promise<Deck[]> {
    const decks = await this.db.getAll("decks");
    return decks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getDeck(id: string): Promise<Deck | undefined> {
    return this.db.get("decks", id);
  }

  async createDeck(input: DeckInput, now: Date = new Date()): Promise<Deck> {
    const deck: Deck = { id: newId(), name: input.name, langFront: input.langFront, langBack: input.langBack, createdAt: now.toISOString() };
    if (input.subject) deck.subject = input.subject;
    if (input.examDate) deck.examDate = input.examDate;
    if (input.kind === "terms" || input.kind === "forms") deck.kind = input.kind;
    if (input.kind === "forms" && input.columns?.length) deck.columns = [...input.columns];
    if (input.folder) deck.folder = input.folder;
    await this.db.add("decks", deck);
    return deck;
  }

  async updateDeck(id: string, patch: Partial<DeckInput>): Promise<Deck> {
    const tx = this.db.transaction("decks", "readwrite");
    const deck = await tx.store.get(id);
    if (!deck) throw new Error("Deck not found");
    const next: Deck = { ...deck, ...patch };
    if (!next.subject) delete next.subject;
    if (!next.examDate) delete next.examDate;
    if (next.kind !== "terms" && next.kind !== "forms") delete next.kind;
    if (next.kind !== "forms" || !next.columns?.length) delete next.columns;
    if (!next.folder) delete next.folder;
    await tx.store.put(next);
    await tx.done;
    return next;
  }

  /** Deletes the deck, its cards and their reviews. */
  async deleteDeck(id: string): Promise<void> {
    const tx = this.db.transaction(["decks", "cards", "reviews"], "readwrite");
    const cardIds = await tx.objectStore("cards").index("deckId").getAllKeys(id);
    for (const cardId of cardIds) {
      await deleteReviewsOf(tx.objectStore("reviews"), cardId);
      await tx.objectStore("cards").delete(cardId);
    }
    await tx.objectStore("decks").delete(id);
    await tx.done;
  }

  // Cards

  allCards(): Promise<Card[]> {
    return this.db.getAll("cards");
  }

  async listCards(deckId: string): Promise<Card[]> {
    const cards = await this.db.getAllFromIndex("cards", "deckId", deckId);
    return cards.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  getCard(id: string): Promise<Card | undefined> {
    return this.db.get("cards", id);
  }

  async addCards(deckId: string, inputs: readonly NewCard[], now: Date = new Date()): Promise<Card[]> {
    const tx = this.db.transaction(["decks", "cards"], "readwrite");
    if (!(await tx.objectStore("decks").get(deckId))) throw new Error("Deck not found");
    // Keep the given order after the existing cards: each card gets a createdAt one millisecond apart.
    const base = orderBase(await tx.objectStore("cards").index("deckId").getAll(deckId), now);
    const cards = inputs.map((input, i) => makeCard(deckId, input, new Date(base + i)));
    for (const card of cards) await tx.objectStore("cards").add(card);
    await tx.done;
    await this.countChanges(cards.length);
    return cards;
  }

  /** Edits text only; box, due and history stay as they are. */
  async updateCard(id: string, patch: Partial<Pick<Card, "front" | "back" | "topic">>, now: Date = new Date()): Promise<Card> {
    const tx = this.db.transaction("cards", "readwrite");
    const card = await tx.store.get(id);
    if (!card) throw new Error("Card not found");
    const next: Card = { ...card, ...patch, updatedAt: now.toISOString() };
    if (!next.topic) delete next.topic;
    await tx.store.put(next);
    await tx.done;
    await this.countChanges(1);
    return next;
  }

  /**
   * Replaces a deck's cards with an edited list in one transaction: rows with an id are updated
   * (only if their text changed), rows without one are created, missing ids are deleted with their reviews.
   */
  async saveDeckCards(
    deckId: string,
    rows: readonly (NewCard & { id?: string })[],
    now: Date = new Date(),
  ): Promise<{ added: number; updated: number; removed: number }> {
    const tx = this.db.transaction(["decks", "cards", "reviews"], "readwrite");
    if (!(await tx.objectStore("decks").get(deckId))) throw new Error("Deck not found");
    const cards = tx.objectStore("cards");
    const existing = new Map((await cards.index("deckId").getAll(deckId)).map((c) => [c.id, c]));
    const keep = new Set<string>();
    let added = 0;
    let updated = 0;
    let i = 0;
    const base = orderBase([...existing.values()], now);
    for (const row of rows) {
      const old = row.id ? existing.get(row.id) : undefined;
      if (old) {
        keep.add(old.id);
        if (old.front !== row.front || old.back !== row.back || (old.topic ?? "") !== (row.topic ?? "") || (old.image ?? "") !== (row.image ?? "") || (old.forms ?? []).join("\u0000") !== (row.forms ?? []).join("\u0000")) {
          const next: Card = { ...old, front: row.front, back: row.back, updatedAt: now.toISOString() };
          if (row.topic) next.topic = row.topic;
          else delete next.topic;
          if (row.image) next.image = row.image;
          else delete next.image;
          if (row.forms?.some((f) => f)) next.forms = [...row.forms];
          else delete next.forms;
          await cards.put(next);
          updated++;
        }
      } else {
        await cards.add(makeCard(deckId, row, new Date(base + i++)));
        added++;
      }
    }
    let removed = 0;
    for (const id of existing.keys()) {
      if (keep.has(id)) continue;
      await deleteReviewsOf(tx.objectStore("reviews"), id);
      await cards.delete(id);
      removed++;
    }
    await tx.done;
    await this.countChanges(added + updated);
    return { added, updated, removed };
  }

  /** Marks or unmarks a card. Counts as an edit (so a merge keeps the newest), not as a new word for the backup reminder. */
  async setStarred(id: string, starred: boolean, now: Date = new Date()): Promise<Card> {
    const tx = this.db.transaction("cards", "readwrite");
    const card = await tx.store.get(id);
    if (!card) throw new Error("Card not found");
    const next: Card = { ...card, updatedAt: now.toISOString() };
    if (starred) next.starred = true;
    else delete next.starred;
    await tx.store.put(next);
    await tx.done;
    return next;
  }

  /** Deletes the card and its reviews. */
  async deleteCard(id: string): Promise<void> {
    const tx = this.db.transaction(["cards", "reviews"], "readwrite");
    await deleteReviewsOf(tx.objectStore("reviews"), id);
    await tx.objectStore("cards").delete(id);
    await tx.done;
  }

  /**
   * Records one answer: updates the card (box and due only for the first answer of the day),
   * appends to the review log and bumps the day's stats, all in one transaction.
   */
  async grade(cardId: string, grade: Grade, mode: Mode = "herhalen", now: Date = new Date()): Promise<{ card: Card; review: Review }> {
    const tx = this.db.transaction(["cards", "reviews", "days"], "readwrite");
    const card = await tx.objectStore("cards").get(cardId);
    if (!card) throw new Error("Card not found");
    const day = localDay(now);
    // Two answers in the same millisecond (or a clock that jitters back a little) would make the log's
    // order ambiguous when it is replayed; nudge the timestamp so every answer is strictly later.
    let ms = now.getTime();
    if (ms <= this.lastAnswerMs && this.lastAnswerMs - ms < 1000) ms = this.lastAnswerMs + 1;
    this.lastAnswerMs = Math.max(this.lastAnswerMs, ms);
    const step = answerCard(card, grade, day);
    const next: Card = { ...step.card, hist: appendHist(card.hist, grade), lastDay: day };
    const entry: Review = { id: newId(), cardId, at: new Date(ms).toISOString(), day, grade, fromBox: step.fromBox, toBox: step.toBox, mode, counts: step.counts };
    const stat = (await tx.objectStore("days").get(day)) ?? { day, answers: 0, correct: 0 };
    stat.answers++;
    if (grade === "goed") stat.correct++;
    await tx.objectStore("cards").put(next);
    await tx.objectStore("reviews").add(entry);
    await tx.objectStore("days").put(stat);
    await tx.done;
    return { card: next, review: entry };
  }

  // Reviews and stats

  allReviews(): Promise<Review[]> {
    return this.db.getAll("reviews");
  }

  reviewsOf(cardId: string): Promise<Review[]> {
    return this.db.getAllFromIndex("reviews", "cardId", cardId);
  }

  allDays(): Promise<DayStat[]> {
    return this.db.getAll("days");
  }

  // Whole-database operations

  async snapshot(): Promise<Snapshot> {
    const tx = this.db.transaction(["decks", "cards", "reviews", "quizzes"], "readonly");
    const [decks, cards, reviews, quizzes] = await Promise.all([
      tx.objectStore("decks").getAll(),
      tx.objectStore("cards").getAll(),
      tx.objectStore("reviews").getAll(),
      tx.objectStore("quizzes").getAll(),
    ]);
    await tx.done;
    return { decks, cards, reviews, quizzes };
  }

  // Quizzes

  async allQuizzes(): Promise<Quiz[]> {
    const quizzes = await this.db.getAll("quizzes");
    return quizzes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Creates or replaces a quiz. */
  async saveQuiz(quiz: Quiz): Promise<void> {
    await this.db.put("quizzes", quiz);
  }

  async deleteQuiz(id: string): Promise<void> {
    await this.db.delete("quizzes", id);
  }

  /** Wipes all decks, cards and reviews and writes the given data, atomically. Caches are rebuilt from the log. */
  async replaceAll(data: Snapshot): Promise<void> {
    const tx = this.db.transaction(["decks", "cards", "reviews", "days", "quizzes"], "readwrite");
    await Promise.all(["decks", "cards", "reviews", "days", "quizzes"].map((s) => tx.objectStore(s as "decks").clear()));
    const caches = rebuildCaches(data.reviews);
    for (const q of data.quizzes ?? []) await tx.objectStore("quizzes").put(q);
    for (const d of data.decks) await tx.objectStore("decks").put(d);
    for (const c of data.cards) await tx.objectStore("cards").put(withCaches(c, caches.cards.get(c.id)));
    for (const r of data.reviews) await tx.objectStore("reviews").put(r);
    for (const d of caches.days) await tx.objectStore("days").put(d);
    await tx.done;
  }

  /**
   * Adds records that don't exist yet. For a card on both sides, the later updatedAt wins.
   * Reviews are a union by id. Caches are rebuilt afterwards. Returns counts of what was written.
   */
  async merge(data: Snapshot): Promise<{ decks: number; cards: number; reviews: number }> {
    const tx = this.db.transaction(["decks", "cards", "reviews", "days", "quizzes"], "readwrite");
    const counts = { decks: 0, cards: 0, reviews: 0 };
    for (const q of data.quizzes ?? []) {
      const existing = await tx.objectStore("quizzes").get(q.id);
      if (!existing || q.updatedAt > existing.updatedAt) await tx.objectStore("quizzes").put(q);
    }
    for (const d of data.decks) {
      if (!(await tx.objectStore("decks").getKey(d.id))) {
        await tx.objectStore("decks").put(d);
        counts.decks++;
      }
    }
    for (const c of data.cards) {
      const existing = await tx.objectStore("cards").get(c.id);
      if (!existing || c.updatedAt > existing.updatedAt) {
        await tx.objectStore("cards").put(existing ? { ...c, box: existing.box, due: existing.due } : c);
        counts.cards++;
      }
    }
    for (const r of data.reviews) {
      if (!(await tx.objectStore("reviews").getKey(r.id))) {
        await tx.objectStore("reviews").put(r);
        counts.reviews++;
      }
    }
    // Rebuild caches for everything from the combined log.
    const reviews = await tx.objectStore("reviews").getAll();
    const caches = rebuildCaches(reviews);
    await tx.objectStore("days").clear();
    for (const d of caches.days) await tx.objectStore("days").put(d);
    for (let cur = await tx.objectStore("cards").openCursor(); cur; cur = await cur.continue()) {
      await cur.update(withCaches(cur.value, caches.cards.get(cur.value.id)));
    }
    await tx.done;
    return counts;
  }

  /** Deletes everything, including settings. */
  async wipe(): Promise<void> {
    const stores = ["decks", "cards", "reviews", "days", "meta", "quizzes"] as const;
    const tx = this.db.transaction([...stores], "readwrite");
    await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
    await tx.done;
  }
}

/** First timestamp for new cards so they sort after every existing card of the deck. */
function orderBase(existing: readonly Card[], now: Date): number {
  let latest = 0;
  for (const c of existing) latest = Math.max(latest, Date.parse(c.createdAt));
  return Math.max(now.getTime(), latest + 1);
}

function withCaches(card: Card, cache: Pick<Card, "hist" | "lastDay"> | undefined): Card {
  const out: Card = { ...card };
  delete out.hist;
  delete out.lastDay;
  if (cache?.hist) out.hist = cache.hist;
  if (cache?.lastDay) out.lastDay = cache.lastDay;
  return out;
}

async function deleteReviewsOf(
  store: { index(name: "cardId"): { getAllKeys(q: string): Promise<string[]> }; delete(key: string): Promise<void> },
  cardId: string,
): Promise<void> {
  const keys = await store.index("cardId").getAllKeys(cardId);
  for (const k of keys) await store.delete(k);
}

export type { Box };
