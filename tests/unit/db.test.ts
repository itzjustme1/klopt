import "fake-indexeddb/auto";
import { openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Store, defaultSettings, detectLang, type DeckInput } from "../../src/lib/db";
import { review as schedule } from "../../src/lib/scheduler";
import type { Box, Review } from "../../src/lib/types";

let store: Store;
let n = 0;

beforeEach(async () => {
  store = await Store.open(`test-${++n}`);
});
afterEach(() => store.close());

const at = (iso: string) => new Date(iso);
const fr: DeckInput = { name: "Frans H1", langFront: "fr", langBack: "nl", subject: "Frans" };
const nl: DeckInput = { name: "Economie", langFront: "nl", langBack: "nl" };

describe("settings", () => {
  it("defaults from navigator.language, Dutch when unsure", () => {
    expect(detectLang("en-GB")).toBe("en");
    expect(detectLang("nl-NL")).toBe("nl");
    expect(detectLang("de-DE")).toBe("nl");
    expect(detectLang(undefined)).toBe("nl");
    expect(defaultSettings("en-US")).toMatchObject({ uiLang: "en", theme: "system", schemaVersion: 2, dailyGoal: 20, autoSpeak: false });
  });

  it("saves and reads back", async () => {
    await store.saveSettings({ theme: "dark", uiLang: "en", dailyGoal: 50 });
    expect(await store.getSettings()).toMatchObject({ theme: "dark", uiLang: "en", dailyGoal: 50 });
  });
});

describe("decks and cards", () => {
  it("stores two languages per deck and creates cards in box 1, due today", async () => {
    const deck = await store.createDeck(fr);
    expect(deck).toMatchObject({ langFront: "fr", langBack: "nl", subject: "Frans" });
    const [card] = await store.addCards(deck.id, [{ front: "la maison", back: "het huis" }], at("2026-10-01T10:00:00+02:00"));
    expect(card).toMatchObject({ deckId: deck.id, box: 1, due: "2026-10-01" });
    expect(card).not.toHaveProperty("hist");
  });

  it("keeps the order cards were added in", async () => {
    const deck = await store.createDeck(fr);
    await store.addCards(deck.id, ["a", "b", "c", "d"].map((x) => ({ front: x, back: x })));
    expect((await store.listCards(deck.id)).map((c) => c.front)).toEqual(["a", "b", "c", "d"]);
  });

  it("rejects cards for a deck that doesn't exist", async () => {
    await expect(store.addCards("nope", [{ front: "Q", back: "A" }])).rejects.toThrow();
  });

  it("editing text keeps progress", async () => {
    const deck = await store.createDeck(fr);
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "A" }]);
    await store.grade(card!.id, "goed", "leren", at("2026-10-01T12:00:00+02:00"));
    const edited = await store.updateCard(card!.id, { back: "B" });
    expect(edited).toMatchObject({ back: "B", box: 2, due: "2026-10-04", hist: "g" });
  });

  it("saveDeckCards updates changed rows, adds new ones and deletes missing ones with their reviews", async () => {
    const deck = await store.createDeck(fr);
    const [a, b, c] = await store.addCards(deck.id, [
      { front: "a", back: "1" },
      { front: "b", back: "2" },
      { front: "c", back: "3" },
    ]);
    await store.grade(c!.id, "goed");
    const result = await store.saveDeckCards(deck.id, [
      { id: a!.id, front: "a", back: "1" },
      { id: b!.id, front: "b", back: "two" },
      { front: "d", back: "4" },
    ]);
    expect(result).toEqual({ added: 1, updated: 1, removed: 1 });
    const cards = await store.listCards(deck.id);
    expect(cards.map((x) => `${x.front}=${x.back}`)).toEqual(["a=1", "b=two", "d=4"]);
    expect(await store.reviewsOf(c!.id)).toEqual([]);
  });

  it("deleting a deck removes its cards and their reviews, and nothing else", async () => {
    const a = await store.createDeck(fr);
    const b = await store.createDeck(nl);
    const [ca] = await store.addCards(a.id, [{ front: "1", back: "1" }]);
    const [cb] = await store.addCards(b.id, [{ front: "2", back: "2" }]);
    await store.grade(ca!.id, "goed");
    await store.grade(cb!.id, "fout");
    await store.deleteDeck(a.id);
    const snap = await store.snapshot();
    expect(snap.decks.map((d) => d.name)).toEqual(["Economie"]);
    expect(snap.cards.map((c) => c.id)).toEqual([cb!.id]);
    expect(snap.reviews.map((r) => r.cardId)).toEqual([cb!.id]);
  });
});

describe("grading", () => {
  it("updates the card, appends a review with the local day and mode, and counts the day", async () => {
    const deck = await store.createDeck(fr);
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "A" }]);
    // 00:30 local time on 25 Oct = 22:30 UTC on 24 Oct.
    const { card: next, review } = await store.grade(card!.id, "goed", "typen", at("2026-10-24T22:30:00Z"));
    expect(next).toMatchObject({ box: 2, due: "2026-10-28", hist: "g", lastDay: "2026-10-25" });
    expect(review).toMatchObject({ grade: "goed", fromBox: 1, toBox: 2, day: "2026-10-25", mode: "typen", counts: true });
    expect(await store.allDays()).toEqual([{ day: "2026-10-25", answers: 1, correct: 1 }]);
  });

  it("only the first answer of the day moves the card; later ones are logged but don't count", async () => {
    const deck = await store.createDeck(fr);
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "A" }]);
    const day = "2026-10-01T";
    await store.grade(card!.id, "fout", "leren", at(`${day}10:00:00+02:00`));
    const r2 = await store.grade(card!.id, "goed", "leren", at(`${day}10:01:00+02:00`));
    const r3 = await store.grade(card!.id, "goed", "leren", at(`${day}10:02:00+02:00`));
    expect(r2.review).toMatchObject({ counts: false, fromBox: 1, toBox: 1 });
    expect(r3.card).toMatchObject({ box: 1, due: "2026-10-02", hist: "fgg" });
    // Next day it counts again.
    const r4 = await store.grade(card!.id, "goed", "herhalen", at("2026-10-02T09:00:00+02:00"));
    expect(r4.review).toMatchObject({ counts: true, fromBox: 1, toBox: 2 });
    expect(await store.allDays()).toEqual([
      { day: "2026-10-01", answers: 3, correct: 2 },
      { day: "2026-10-02", answers: 1, correct: 1 },
    ]);
  });

  it("the review log replays to the stored card state", async () => {
    const deck = await store.createDeck(fr);
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "A" }], at("2026-10-01T09:00:00+02:00"));
    const steps: [string, "fout" | "twijfel" | "goed"][] = [
      ["2026-10-01T10:00:00+02:00", "goed"],
      ["2026-10-01T10:05:00+02:00", "fout"],
      ["2026-10-04T10:00:00+02:00", "goed"],
      ["2026-10-11T10:00:00+02:00", "fout"],
      ["2026-10-12T10:00:00+02:00", "twijfel"],
      ["2026-10-25T01:30:00+02:00", "goed"],
      ["2026-10-25T23:30:00+01:00", "goed"],
    ];
    for (const [iso, g] of steps) await store.grade(card!.id, g, "leren", at(iso));
    const log = (await store.reviewsOf(card!.id)).sort((a, b) => a.at.localeCompare(b.at));
    let replay: { box: Box; due: string } = { box: 1, due: "2026-10-01" };
    for (const r of log) if (r.counts) replay = schedule(replay, r.grade, r.day);
    const stored = await store.getCard(card!.id);
    expect(replay).toEqual({ box: stored!.box, due: stored!.due });
    expect(log.map((r) => r.counts)).toEqual([true, false, true, true, true, true, false]);
  });
});

describe("snapshot, merge, replace, wipe", () => {
  it("replace swaps all data and rebuilds caches from the log", async () => {
    const deck = await store.createDeck(fr);
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "A" }]);
    await store.grade(card!.id, "fout", "typen", at("2026-10-01T10:00:00+02:00"));
    const snap = await store.snapshot();
    // Tamper with the cache: replace must rebuild it from the reviews.
    snap.cards = snap.cards.map((c) => ({ ...c, hist: "ggggg", lastDay: "2020-01-01" }));
    await store.createDeck(nl);
    await store.replaceAll(snap);
    expect((await store.listDecks()).map((d) => d.name)).toEqual(["Frans H1"]);
    expect(await store.getCard(card!.id)).toMatchObject({ hist: "f", lastDay: "2026-10-01" });
    expect(await store.allDays()).toEqual([{ day: "2026-10-01", answers: 1, correct: 0 }]);
  });

  it("merge adds new records, keeps the newer card text, and rebuilds caches", async () => {
    const deck = await store.createDeck(fr);
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "old" }], at("2026-10-01T10:00:00Z"));
    const snap = await store.snapshot();
    const newer = { ...card!, back: "new", updatedAt: "2026-10-02T10:00:00.000Z" };
    const older = { ...card!, back: "older", updatedAt: "2026-09-01T10:00:00.000Z" };
    let result = await store.merge({ ...snap, cards: [newer] });
    expect(result).toEqual({ decks: 0, cards: 1, reviews: 0 });
    expect((await store.getCard(card!.id))!.back).toBe("new");
    result = await store.merge({ ...snap, cards: [older] });
    expect(result.cards).toBe(0);
    expect((await store.getCard(card!.id))!.back).toBe("new");
  });

  it("counts changes for the backup reminder", async () => {
    const deck = await store.createDeck(fr);
    const cards = await store.addCards(deck.id, [
      { front: "1", back: "1" },
      { front: "2", back: "2" },
    ]);
    await store.updateCard(cards[0]!.id, { front: "x" });
    expect((await store.getSettings()).changesSinceExport).toBe(3);
  });

  it("wipe removes everything including settings and day stats", async () => {
    await store.saveSettings({ theme: "dark" });
    const deck = await store.createDeck(fr);
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "A" }]);
    await store.grade(card!.id, "goed");
    await store.wipe();
    expect(await store.snapshot()).toEqual({ decks: [], cards: [], reviews: [] });
    expect(await store.allDays()).toEqual([]);
    expect((await store.getSettings()).theme).toBe("system");
  });

  it("persists across reopening the database", async () => {
    const name = `test-reopen-${n}`;
    const s1 = await Store.open(name);
    const deck = await s1.createDeck(fr);
    s1.close();
    const s2 = await Store.open(name);
    expect((await s2.getDeck(deck.id))!.name).toBe("Frans H1");
    s2.close();
  });
});

describe("migration from schema 1", () => {
  it("upgrades decks, reviews and cards and fills the day stats", async () => {
    const name = `test-migrate-${n}`;
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore("decks", { keyPath: "id" });
        const cards = db.createObjectStore("cards", { keyPath: "id" });
        cards.createIndex("deckId", "deckId");
        cards.createIndex("due", "due");
        const reviews = db.createObjectStore("reviews", { keyPath: "id" });
        reviews.createIndex("cardId", "cardId");
        db.createObjectStore("meta");
      },
    });
    const deckId = "11111111-1111-4111-8111-111111111111";
    const cardId = "22222222-2222-4222-8222-222222222222";
    await v1.put("decks", { id: deckId, name: "Oud", lang: "en", subject: "Engels", createdAt: "2026-09-01T10:00:00.000Z" });
    await v1.put("cards", { id: cardId, deckId, front: "house", back: "huis", box: 2, due: "2026-09-05", createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z" });
    const oldReviews: Omit<Review, "mode" | "counts">[] = [
      { id: "33333333-3333-4333-8333-333333333333", cardId, at: "2026-09-01T11:00:00.000Z", day: "2026-09-01", grade: "fout", fromBox: 1, toBox: 1 },
      { id: "44444444-4444-4444-8444-444444444444", cardId, at: "2026-09-02T11:00:00.000Z", day: "2026-09-02", grade: "goed", fromBox: 1, toBox: 2 },
    ];
    for (const r of oldReviews) await v1.put("reviews", r);
    v1.close();

    const s = await Store.open(name);
    expect(await s.getDeck(deckId)).toEqual({ id: deckId, name: "Oud", langFront: "en", langBack: "en", subject: "Engels", createdAt: "2026-09-01T10:00:00.000Z" });
    expect(await s.getCard(cardId)).toMatchObject({ box: 2, hist: "fg", lastDay: "2026-09-02" });
    const reviews = await s.reviewsOf(cardId);
    expect(reviews.every((r) => r.mode === "herhalen" && r.counts === true)).toBe(true);
    expect(await s.allDays()).toEqual([
      { day: "2026-09-01", answers: 1, correct: 0 },
      { day: "2026-09-02", answers: 1, correct: 1 },
    ]);
    s.close();
  });
});
