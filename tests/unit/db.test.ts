import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Store, defaultSettings, detectLang } from "../../src/lib/db";

let store: Store;
let n = 0;

beforeEach(async () => {
  store = await Store.open(`test-${++n}`);
});
afterEach(() => store.close());

const day = (iso: string) => new Date(iso);

describe("settings", () => {
  it("defaults from navigator.language, Dutch when unsure", () => {
    expect(detectLang("en-GB")).toBe("en");
    expect(detectLang("nl-NL")).toBe("nl");
    expect(detectLang("de-DE")).toBe("nl");
    expect(detectLang(undefined)).toBe("nl");
    expect(defaultSettings("en-US")).toMatchObject({ uiLang: "en", theme: "system", schemaVersion: 1 });
  });

  it("saves and reads back", async () => {
    await store.saveSettings({ theme: "dark", uiLang: "en" });
    expect(await store.getSettings()).toMatchObject({ theme: "dark", uiLang: "en" });
  });
});

describe("decks and cards", () => {
  it("creates cards in box 1, due today", async () => {
    const deck = await store.createDeck({ name: "Economie", lang: "nl", subject: "Economie" });
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "A" }], day("2026-10-01T10:00:00+02:00"));
    expect(card).toMatchObject({ deckId: deck.id, box: 1, due: "2026-10-01", front: "Q", back: "A" });
    expect(await store.listCards(deck.id)).toHaveLength(1);
  });

  it("rejects cards for a deck that doesn't exist", async () => {
    await expect(store.addCards("nope", [{ front: "Q", back: "A" }])).rejects.toThrow();
  });

  it("renames a deck and edits a card without touching its progress", async () => {
    const deck = await store.createDeck({ name: "Old", lang: "nl" });
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "A" }]);
    await store.grade(card!.id, "goed", day("2026-10-01T12:00:00+02:00"));
    await store.updateDeck(deck.id, { name: "New" });
    const edited = await store.updateCard(card!.id, { back: "B" });
    expect((await store.getDeck(deck.id))!.name).toBe("New");
    expect(edited).toMatchObject({ back: "B", box: 2, due: "2026-10-04" });
  });

  it("deleting a deck removes its cards and their reviews, and nothing else", async () => {
    const a = await store.createDeck({ name: "A", lang: "nl" });
    const b = await store.createDeck({ name: "B", lang: "en" });
    const [ca] = await store.addCards(a.id, [{ front: "1", back: "1" }]);
    const [cb] = await store.addCards(b.id, [{ front: "2", back: "2" }]);
    await store.grade(ca!.id, "goed");
    await store.grade(cb!.id, "fout");
    await store.deleteDeck(a.id);
    const snap = await store.snapshot();
    expect(snap.decks.map((d) => d.name)).toEqual(["B"]);
    expect(snap.cards.map((c) => c.id)).toEqual([cb!.id]);
    expect(snap.reviews.map((r) => r.cardId)).toEqual([cb!.id]);
  });

  it("deleting a card removes its reviews", async () => {
    const deck = await store.createDeck({ name: "A", lang: "nl" });
    const [c1, c2] = await store.addCards(deck.id, [
      { front: "1", back: "1" },
      { front: "2", back: "2" },
    ]);
    await store.grade(c1!.id, "goed");
    await store.grade(c2!.id, "goed");
    await store.deleteCard(c1!.id);
    expect((await store.allReviews()).map((r) => r.cardId)).toEqual([c2!.id]);
  });
});

describe("grading", () => {
  it("updates the card and appends a review with the local day", async () => {
    const deck = await store.createDeck({ name: "A", lang: "nl" });
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "A" }]);
    // 00:30 local time on 25 Oct = 22:30 UTC on 24 Oct.
    const { card: next, review } = await store.grade(card!.id, "goed", day("2026-10-24T22:30:00Z"));
    expect(next).toMatchObject({ box: 2, due: "2026-10-28" });
    expect(review).toMatchObject({ cardId: card!.id, grade: "goed", fromBox: 1, toBox: 2, day: "2026-10-25", at: "2026-10-24T22:30:00.000Z" });
    expect(await store.getCard(card!.id)).toMatchObject({ box: 2, due: "2026-10-28" });
  });

  it("keeps an append-only log that replays to the stored card state", async () => {
    const deck = await store.createDeck({ name: "A", lang: "nl" });
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "A" }], day("2026-10-01T09:00:00+02:00"));
    const steps: [string, "fout" | "twijfel" | "goed"][] = [
      ["2026-10-01T10:00:00+02:00", "goed"],
      ["2026-10-04T10:00:00+02:00", "goed"],
      ["2026-10-11T10:00:00+02:00", "fout"],
      ["2026-10-12T10:00:00+02:00", "twijfel"],
      ["2026-10-13T10:00:00+02:00", "goed"],
    ];
    for (const [at, g] of steps) await store.grade(card!.id, g, day(at));
    const log = (await store.reviewsOf(card!.id)).sort((a, b) => a.at.localeCompare(b.at));
    expect(log.map((r) => `${r.fromBox}>${r.toBox}`)).toEqual(["1>2", "2>3", "3>1", "1>1", "1>2"]);

    // Replay from scratch using only the log.
    const { review } = await import("../../src/lib/scheduler");
    let replay = { box: 1 as const as 1 | 2 | 3 | 4 | 5, due: "2026-10-01" };
    for (const r of log) replay = review(replay, r.grade, r.day);
    const stored = await store.getCard(card!.id);
    expect(replay).toEqual({ box: stored!.box, due: stored!.due });
  });
});

describe("snapshot, merge, replace, wipe", () => {
  it("replace swaps all data atomically", async () => {
    const deck = await store.createDeck({ name: "A", lang: "nl" });
    await store.addCards(deck.id, [{ front: "Q", back: "A" }]);
    const snap = await store.snapshot();
    await store.createDeck({ name: "B", lang: "nl" });
    await store.replaceAll(snap);
    expect((await store.listDecks()).map((d) => d.name)).toEqual(["A"]);
  });

  it("merge adds new records and keeps the newer card", async () => {
    const deck = await store.createDeck({ name: "A", lang: "nl" });
    const [card] = await store.addCards(deck.id, [{ front: "Q", back: "old" }], day("2026-10-01T10:00:00Z"));
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
    const deck = await store.createDeck({ name: "A", lang: "nl" });
    const cards = await store.addCards(deck.id, [
      { front: "1", back: "1" },
      { front: "2", back: "2" },
    ]);
    await store.updateCard(cards[0]!.id, { front: "x" });
    expect((await store.getSettings()).changesSinceExport).toBe(3);
  });

  it("wipe removes everything including settings", async () => {
    await store.saveSettings({ theme: "dark" });
    const deck = await store.createDeck({ name: "A", lang: "nl" });
    await store.addCards(deck.id, [{ front: "Q", back: "A" }]);
    await store.wipe();
    const snap = await store.snapshot();
    expect(snap).toEqual({ decks: [], cards: [], reviews: [] });
    expect((await store.getSettings()).theme).toBe("system");
  });

  it("persists across reopening the database", async () => {
    const name = `test-reopen-${n}`;
    const s1 = await Store.open(name);
    const deck = await s1.createDeck({ name: "Kept", lang: "nl" });
    s1.close();
    const s2 = await Store.open(name);
    expect((await s2.getDeck(deck.id))!.name).toBe("Kept");
    s2.close();
  });
});
