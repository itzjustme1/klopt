/** The only module that touches IndexedDB. */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { localDay } from "./dates";
import { review as schedule } from "./scheduler";
import type { Card, Deck, Grade, Lang, Review, Settings } from "./types";

export const SCHEMA_VERSION = 1;

interface KloptDB extends DBSchema {
  decks: { key: string; value: Deck };
  cards: { key: string; value: Card; indexes: { deckId: string; due: string } };
  reviews: { key: string; value: Review; indexes: { cardId: string } };
  meta: { key: string; value: Settings };
}

export interface Snapshot {
  decks: Deck[];
  cards: Card[];
  reviews: Review[];
}

const SETTINGS_KEY = "settings";

export function detectLang(navLang: string | undefined): Lang {
  return navLang?.toLowerCase().startsWith("en") ? "en" : "nl";
}

export function defaultSettings(navLang?: string): Settings {
  return {
    uiLang: detectLang(navLang),
    theme: "system",
    schemaVersion: SCHEMA_VERSION,
    changesSinceExport: 0,
    reminderSnoozedAt: 0,
    persistRequested: false,
    installHintDismissed: false,
  };
}

export type NewCard = Pick<Card, "front" | "back"> & Partial<Pick<Card, "topic">>;

export function newId(): string {
  return crypto.randomUUID();
}

/** A fresh card: box 1, due today. */
export function makeCard(deckId: string, input: NewCard, now: Date = new Date()): Card {
  const iso = now.toISOString();
  const card: Card = { id: newId(), deckId, front: input.front, back: input.back, box: 1, due: localDay(now), createdAt: iso, updatedAt: iso };
  if (input.topic) card.topic = input.topic;
  return card;
}

export class Store {
  private constructor(private readonly db: IDBPDatabase<KloptDB>) {}

  static async open(name = "klopt"): Promise<Store> {
    const db = await openDB<KloptDB>(name, SCHEMA_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("decks", { keyPath: "id" });
          const cards = db.createObjectStore("cards", { keyPath: "id" });
          cards.createIndex("deckId", "deckId");
          cards.createIndex("due", "due");
          const reviews = db.createObjectStore("reviews", { keyPath: "id" });
          reviews.createIndex("cardId", "cardId");
          db.createObjectStore("meta");
        }
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
    return { ...defaultSettings(navLang), ...stored };
  }

  async saveSettings(patch: Partial<Settings>, navLang?: string): Promise<Settings> {
    const tx = this.db.transaction("meta", "readwrite");
    const current = { ...defaultSettings(navLang), ...(await tx.store.get(SETTINGS_KEY)) };
    const next = { ...current, ...patch };
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

  async createDeck(input: Pick<Deck, "name" | "lang"> & Partial<Pick<Deck, "subject">>, now: Date = new Date()): Promise<Deck> {
    const deck: Deck = { id: newId(), name: input.name, lang: input.lang, createdAt: now.toISOString() };
    if (input.subject) deck.subject = input.subject;
    await this.db.add("decks", deck);
    return deck;
  }

  async updateDeck(id: string, patch: Partial<Pick<Deck, "name" | "lang" | "subject">>): Promise<Deck> {
    const tx = this.db.transaction("decks", "readwrite");
    const deck = await tx.store.get(id);
    if (!deck) throw new Error("Deck not found");
    const next: Deck = { ...deck, ...patch };
    if (!next.subject) delete next.subject;
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
    const cards = inputs.map((input) => makeCard(deckId, input, now));
    for (const card of cards) await tx.objectStore("cards").add(card);
    await tx.done;
    await this.countChanges(cards.length);
    return cards;
  }

  /** Edits text only; box and due stay as they are. */
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

  /** Deletes the card and its reviews. */
  async deleteCard(id: string): Promise<void> {
    const tx = this.db.transaction(["cards", "reviews"], "readwrite");
    await deleteReviewsOf(tx.objectStore("reviews"), id);
    await tx.objectStore("cards").delete(id);
    await tx.done;
  }

  /** Applies a grade: updates the card and appends to the review log in one transaction. */
  async grade(cardId: string, grade: Grade, now: Date = new Date()): Promise<{ card: Card; review: Review }> {
    const tx = this.db.transaction(["cards", "reviews"], "readwrite");
    const card = await tx.objectStore("cards").get(cardId);
    if (!card) throw new Error("Card not found");
    const day = localDay(now);
    const next = schedule(card, grade, day);
    const entry: Review = { id: newId(), cardId, at: now.toISOString(), day, grade, fromBox: card.box, toBox: next.box };
    await tx.objectStore("cards").put(next);
    await tx.objectStore("reviews").add(entry);
    await tx.done;
    return { card: next, review: entry };
  }

  // Reviews

  allReviews(): Promise<Review[]> {
    return this.db.getAll("reviews");
  }

  reviewsOf(cardId: string): Promise<Review[]> {
    return this.db.getAllFromIndex("reviews", "cardId", cardId);
  }

  // Whole-database operations

  async snapshot(): Promise<Snapshot> {
    const tx = this.db.transaction(["decks", "cards", "reviews"], "readonly");
    const [decks, cards, reviews] = await Promise.all([
      tx.objectStore("decks").getAll(),
      tx.objectStore("cards").getAll(),
      tx.objectStore("reviews").getAll(),
    ]);
    await tx.done;
    return { decks, cards, reviews };
  }

  /** Wipes all decks, cards and reviews and writes the given data, atomically. */
  async replaceAll(data: Snapshot): Promise<void> {
    const tx = this.db.transaction(["decks", "cards", "reviews"], "readwrite");
    await Promise.all([tx.objectStore("decks").clear(), tx.objectStore("cards").clear(), tx.objectStore("reviews").clear()]);
    for (const d of data.decks) await tx.objectStore("decks").put(d);
    for (const c of data.cards) await tx.objectStore("cards").put(c);
    for (const r of data.reviews) await tx.objectStore("reviews").put(r);
    await tx.done;
  }

  /**
   * Adds records that don't exist yet. For a card on both sides, the later updatedAt wins.
   * Reviews are a union by id. Returns counts of what was written.
   */
  async merge(data: Snapshot): Promise<{ decks: number; cards: number; reviews: number }> {
    const tx = this.db.transaction(["decks", "cards", "reviews"], "readwrite");
    const counts = { decks: 0, cards: 0, reviews: 0 };
    for (const d of data.decks) {
      if (!(await tx.objectStore("decks").getKey(d.id))) {
        await tx.objectStore("decks").put(d);
        counts.decks++;
      }
    }
    for (const c of data.cards) {
      const existing = await tx.objectStore("cards").get(c.id);
      if (!existing || c.updatedAt > existing.updatedAt) {
        await tx.objectStore("cards").put(c);
        counts.cards++;
      }
    }
    for (const r of data.reviews) {
      if (!(await tx.objectStore("reviews").getKey(r.id))) {
        await tx.objectStore("reviews").put(r);
        counts.reviews++;
      }
    }
    await tx.done;
    return counts;
  }

  /** Deletes everything, including settings. */
  async wipe(): Promise<void> {
    const tx = this.db.transaction(["decks", "cards", "reviews", "meta"], "readwrite");
    await Promise.all(["decks", "cards", "reviews", "meta"].map((s) => tx.objectStore(s as "decks").clear()));
    await tx.done;
  }
}

async function deleteReviewsOf(
  store: { index(name: "cardId"): { getAllKeys(q: string): Promise<string[]> }; delete(key: string): Promise<void> },
  cardId: string,
): Promise<void> {
  const keys = await store.index("cardId").getAllKeys(cardId);
  for (const k of keys) await store.delete(k);
}
