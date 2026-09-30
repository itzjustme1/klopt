import { describe, expect, it } from "vitest";
import { LIMITS } from "../../src/config";
import { decodeShare, encodeShare } from "../../src/lib/share";
import type { Card, Deck } from "../../src/lib/types";
import { demoCards } from "../../src/lib/demo";

const deck: Deck = { id: "11111111-1111-4111-8111-111111111111", name: "Economie <i>", langFront: "nl", langBack: "nl", subject: "Economie", createdAt: "2026-10-01T10:00:00.000Z" };
const cards = (n: number, text = (i: number) => demoCards("nl")[i % 3]!): Card[] =>
  Array.from({ length: n }, (_, i) => ({
    id: crypto.randomUUID(),
    deckId: deck.id,
    ...text(i),
    box: 4,
    due: "2026-11-01",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  }));

async function gzipB64(text: string) {
  const buf = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  return Buffer.from(buf).toString("base64url");
}

describe("share links", () => {
  it("round-trip a small deck and drop progress", async () => {
    const payload = await encodeShare(deck, cards(3));
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    const r = await decodeShare(payload!);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.deck.name).toBe("Economie <i>");
      expect(r.data.cards.map((c) => c.front)).toEqual(demoCards("nl").map((c) => c.front));
    }
  });

  it("returns null when the link would be too long", async () => {
    const unique = (i: number) => ({ front: `Vraag ${i} ${crypto.randomUUID()}`, back: `Antwoord ${crypto.randomUUID()}` });
    expect(await encodeShare(deck, cards(400, unique))).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["not base64url", "abc+/="],
    ["garbage bytes", "AAAAAAAAAAAA"],
    ["too long", "A".repeat(200_001)],
  ])("rejects %s", async (_name, payload) => {
    expect((await decodeShare(payload)).ok).toBe(false);
  });

  it("rejects valid gzip of invalid JSON and of a non-deck", async () => {
    expect((await decodeShare(await gzipB64("{not json"))).ok).toBe(false);
    expect((await decodeShare(await gzipB64(JSON.stringify({ format: "klopt-backup", version: 1, decks: [], cards: [], reviews: [] })))).ok).toBe(false);
  });

  it("rejects a gzip bomb without inflating it fully", async () => {
    const bomb = await gzipB64(" ".repeat(LIMITS.shareInflatedBytes + 10));
    expect(bomb.length).toBeLessThan(10_000);
    expect(await decodeShare(bomb)).toEqual({ ok: false, error: { code: "invalid", where: "link" } });
  });

  it("rejects invalid UTF-8", async () => {
    const buf = new Uint8Array(await new Response(new Blob([new Uint8Array([0xff, 0xfe, 0xfd])]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
    expect((await decodeShare(Buffer.from(buf).toString("base64url"))).ok).toBe(false);
  });
});
