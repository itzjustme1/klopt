import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { FILE_FORMAT, LIMITS } from "../../src/config";
import { backupFileName, makeBackup, makeShareFile, parseBackup, parseShared } from "../../src/lib/backup";
import { Store } from "../../src/lib/db";
import { demoCards } from "../../src/lib/demo";

async function seeded(name: string) {
  const store = await Store.open(name);
  const deck = await store.createDeck({ name: "Economie", langFront: "nl", langBack: "nl", subject: "Economie" });
  const cards = await store.addCards(deck.id, demoCards("nl"));
  await store.updateCard(cards[0]!.id, { topic: "Elasticiteit" });
  await store.grade(cards[0]!.id, "goed");
  await store.grade(cards[0]!.id, "fout", "leren");
  await store.grade(cards[1]!.id, "fout");
  const en = await store.createDeck({ name: "English <b>", langFront: "en", langBack: "nl" });
  await store.addCards(en.id, demoCards("en"));
  return store;
}

const good = () => JSON.parse(JSON.stringify(makeBackup({
  decks: [{ id: "11111111-1111-4111-8111-111111111111", name: "D", langFront: "fr", langBack: "nl", createdAt: "2026-10-01T10:00:00.000Z" }],
  cards: [{ id: "22222222-2222-4222-8222-222222222222", deckId: "11111111-1111-4111-8111-111111111111", front: "f", back: "b", box: 2, due: "2026-10-04", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z" }],
  reviews: [
    { id: "33333333-3333-4333-8333-333333333333", cardId: "22222222-2222-4222-8222-222222222222", at: "2026-10-01T10:00:00.000Z", day: "2026-10-01", grade: "goed", fromBox: 1, toBox: 2, mode: "leren", counts: true },
    { id: "55555555-5555-4555-8555-555555555555", cardId: "22222222-2222-4222-8222-222222222222", at: "2026-10-01T10:01:00.000Z", day: "2026-10-01", grade: "fout", fromBox: 2, toBox: 2, mode: "leren", counts: false },
  ],
})));

describe("backup round trip", () => {
  it("export then import into an empty database gives identical data", async () => {
    const a = await seeded("rt-a");
    const snap = await a.snapshot();
    const text = JSON.stringify(makeBackup(snap));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const b = await Store.open("rt-b");
    await b.replaceAll(parsed.data);
    const snapB = await b.snapshot();
    const sort = <T extends { id: string }>(xs: T[]) => [...xs].sort((x, y) => x.id.localeCompare(y.id));
    expect(sort(snapB.decks)).toEqual(sort(snap.decks));
    expect(sort(snapB.cards)).toEqual(sort(snap.cards));
    expect(sort(snapB.reviews)).toEqual(sort(snap.reviews));
    expect(snap.reviews).toHaveLength(3);
    expect(snap.reviews.filter((r) => !r.counts)).toHaveLength(1);
    a.close();
    b.close();
  });

  it("merge into a database that already has the data changes nothing", async () => {
    const a = await seeded("rt-c");
    const snap = await a.snapshot();
    const parsed = parseBackup(JSON.stringify(makeBackup(snap)));
    if (!parsed.ok) throw new Error("expected ok");
    expect(await a.merge(parsed.data)).toEqual({ decks: 0, cards: 0, reviews: 0 });
    a.close();
  });

  it("names files by date", () => {
    expect(backupFileName("Klopt", new Date(2026, 9, 1, 12))).toBe("klopt-backup-2026-10-01.json");
    expect(backupFileName("Klopt", new Date(), "deck", "Economie H5: markten!")).toBe("klopt-economie-h5-markten.json");
  });
});

describe("parseBackup rejects bad input", () => {
  const reject = (text: string) => {
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
    return r.ok ? null : r.error;
  };
  const withChange = (fn: (b: ReturnType<typeof good>) => void) => {
    const b = good();
    fn(b);
    return JSON.stringify(b);
  };

  it("accepts the valid fixture", () => {
    expect(parseBackup(JSON.stringify(good())).ok).toBe(true);
  });

  it("rejects non-JSON, JSON that isn't an object, and the wrong format", () => {
    expect(reject("not json")).toEqual({ code: "notJson" });
    expect(reject("[1,2]")).toEqual({ code: "notJson" });
    expect(reject("null")).toEqual({ code: "notJson" });
    expect(reject(JSON.stringify({ ...good(), format: "anki" }))).toEqual({ code: "format" });
  });

  it("rejects a newer version and a nonsense version", () => {
    expect(reject(withChange((b) => (b.version = 99)))).toEqual({ code: "version" });
    expect(reject(withChange((b) => (b.version = "1" as unknown as number)))?.code).toBe("invalid");
    expect(reject(withChange((b) => (b.version = 0)))?.code).toBe("invalid");
  });

  it("rejects oversize files before parsing", () => {
    expect(reject(" ".repeat(LIMITS.backupBytes + 1))).toEqual({ code: "tooBig" });
  });

  it.each<[string, (b: ReturnType<typeof good>) => void, string]>([
    ["unknown top-level key", (b) => ((b as unknown as Record<string, unknown>).evil = 1), "root.evil"],
    ["unknown card key", (b) => ((b.cards[0] as unknown as Record<string, unknown>).html = "<b>"), "cards[0].html"],
    ["missing deck name", (b) => delete (b.decks[0] as Partial<(typeof b.decks)[0]>).name, "decks[0].name"],
    ["empty deck name", (b) => (b.decks[0]!.name = ""), "decks[0].name"],
    ["deck name too long", (b) => (b.decks[0]!.name = "x".repeat(LIMITS.deckNameChars + 1)), "decks[0].name"],
    ["bad language", (b) => (b.decks[0]!.langFront = "klingon" as "nl"), "decks[0].langFront"],
    ["missing back language", (b) => delete (b.decks[0] as Partial<(typeof b.decks)[0]>).langBack, "decks[0].langBack"],
    ["bad mode", (b) => (b.reviews[0]!.mode = "cheat" as "leren"), "reviews[0].mode"],
    ["counts not a boolean", (b) => (b.reviews[0]!.counts = "yes" as unknown as boolean), "reviews[0].counts"],
    ["non-counting review that moves the box", (b) => (b.reviews[1]!.toBox = 1), "reviews[1].toBox"],
    ["bad history cache", (b) => ((b.cards[0] as unknown as Record<string, unknown>).hist = "<script>"), "cards[0].hist"],
    ["bad id", (b) => (b.decks[0]!.id = "1; DROP TABLE"), "decks[0].id"],
    ["box out of range", (b) => (b.cards[0]!.box = 6 as 5), "cards[0].box"],
    ["box as string", (b) => (b.cards[0]!.box = "2" as unknown as 2), "cards[0].box"],
    ["impossible due date", (b) => (b.cards[0]!.due = "2026-02-30"), "cards[0].due"],
    ["due as timestamp", (b) => (b.cards[0]!.due = "2026-10-04T00:00:00Z"), "cards[0].due"],
    ["card side too long", (b) => (b.cards[0]!.front = "x".repeat(LIMITS.sideChars + 1)), "cards[0].front"],
    ["card side not a string", (b) => (b.cards[0]!.back = { toString: "x" } as unknown as string), "cards[0].back"],
    ["card in unknown deck", (b) => (b.cards[0]!.deckId = "99999999-9999-4999-8999-999999999999"), "cards[0].deckId"],
    ["duplicate card id", (b) => b.cards.push({ ...b.cards[0]! }), "cards[1].id"],
    ["review for unknown card", (b) => (b.reviews[0]!.cardId = "99999999-9999-4999-8999-999999999999"), "reviews[0].cardId"],
    ["review with inconsistent boxes", (b) => (b.reviews[0]!.toBox = 5), "reviews[0].toBox"],
    ["review with bad grade", (b) => (b.reviews[0]!.grade = "perfect" as "goed"), "reviews[0].grade"],
    ["bad timestamp", (b) => (b.reviews[0]!.at = "yesterday"), "reviews[0].at"],
    ["decks not an array", (b) => ((b as unknown as Record<string, unknown>).decks = {}), "decks"],
    ["prototype pollution key", (b) => Object.defineProperty(b.decks[0], "__proto__", { value: { x: 1 }, enumerable: true }), "decks[0].__proto__"],
  ])("rejects %s", (_name, change, where) => {
    expect(reject(withChange(change))).toEqual({ code: "invalid", where });
  });

  it("rejects too many records", () => {
    const b = good();
    b.decks = Array.from({ length: LIMITS.backupDecks + 1 }, () => b.decks[0]!);
    expect(reject(JSON.stringify(b))).toEqual({ code: "invalid", where: "decks" });
  });

  it("keeps HTML in text fields as plain strings", () => {
    const r = parseBackup(withChange((b) => (b.cards[0]!.front = "<script>alert(1)</script>")));
    expect(r.ok && r.data.cards[0]!.front).toBe("<script>alert(1)</script>");
  });
});

describe("shared deck files", () => {
  it("strip progress and require exactly one deck", async () => {
    const store = await seeded("share-a");
    const [deck] = await store.listDecks();
    const cards = await store.listCards(deck!.id);
    const file = makeShareFile(deck!, cards);
    expect(file.reviews).toEqual([]);
    expect(file.cards.every((c) => c.box === 1 && c.hist === undefined && c.lastDay === undefined)).toBe(true);

    const r = parseShared(JSON.stringify(file));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.deck).toEqual({ name: "Economie", langFront: "nl", langBack: "nl", subject: "Economie" });
      expect(r.data.cards).toHaveLength(3);
      expect(r.data.cards[0]).not.toHaveProperty("box");
    }

    const full = makeBackup(await store.snapshot());
    expect(parseShared(JSON.stringify(full))).toEqual({ ok: false, error: { code: "invalid", where: "decks" } });
    expect(parseShared(JSON.stringify({ ...file, cards: [] }))).toEqual({ ok: false, error: { code: "invalid", where: "cards" } });
    expect(FILE_FORMAT).toBe("klopt-backup");
    store.close();
  });
});

describe("version 1 files", () => {
  const v1 = {
    format: "klopt-backup",
    version: 1,
    exportedAt: "2026-09-30T10:00:00.000Z",
    decks: [{ id: "11111111-1111-4111-8111-111111111111", name: "Oud", lang: "en", createdAt: "2026-09-01T10:00:00.000Z" }],
    cards: [{ id: "22222222-2222-4222-8222-222222222222", deckId: "11111111-1111-4111-8111-111111111111", front: "f", back: "b", box: 2, due: "2026-10-04", createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z" }],
    reviews: [{ id: "33333333-3333-4333-8333-333333333333", cardId: "22222222-2222-4222-8222-222222222222", at: "2026-10-01T10:00:00.000Z", day: "2026-10-01", grade: "goed", fromBox: 1, toBox: 2 }],
  };

  it("are still accepted and converted", () => {
    const r = parseBackup(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.decks[0]).toMatchObject({ langFront: "en", langBack: "en" });
    expect(r.data.reviews[0]).toMatchObject({ mode: "herhalen", counts: true });
  });

  it("reject v2 fields and v1 languages that never existed", () => {
    const withMode = { ...v1, reviews: [{ ...v1.reviews[0], mode: "leren" }] };
    expect(parseBackup(JSON.stringify(withMode))).toEqual({ ok: false, error: { code: "invalid", where: "reviews[0].mode" } });
    const french = { ...v1, decks: [{ ...v1.decks[0], lang: "fr" }] };
    expect(parseBackup(JSON.stringify(french))).toEqual({ ok: false, error: { code: "invalid", where: "decks[0].lang" } });
  });
});

describe("term lists", () => {
  it("keeps the kind of a term list through backup and sharing, and rejects unknown kinds", async () => {
    const terms = good();
    terms.decks[0].kind = "terms";
    const parsed = parseBackup(JSON.stringify(terms));
    expect(parsed.ok && parsed.data.decks[0]!.kind).toBe("terms");
    const words = good();
    words.decks[0].kind = "words";
    const w = parseBackup(JSON.stringify(words));
    expect(w.ok && "kind" in w.data.decks[0]!).toBe(false);
    const bad = good();
    bad.decks[0].kind = "quiz";
    expect(parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false, error: { where: "decks[0].kind" } });

    const store = await Store.open("terms-share");
    const deck = await store.createDeck({ name: "WO2", langFront: "xx", langBack: "xx", kind: "terms" });
    const cards = await store.addCards(deck.id, [{ front: "Verzet", back: "Strijd tegen de bezetter." }]);
    const shared = parseShared(JSON.stringify(makeShareFile(deck, cards)));
    expect(shared.ok && shared.data.deck.kind).toBe("terms");
    // Turning it back into words drops the field.
    expect(await store.updateDeck(deck.id, { kind: "words" })).not.toHaveProperty("kind");
  });
});
