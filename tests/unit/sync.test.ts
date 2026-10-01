import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { Store } from "../../src/lib/db";
import { EMPTY_SYNC, merge, syncOnce, type PushRow, type Remote, type RemoteRow, type SyncState } from "../../src/lib/sync";

/** An in-memory account: what Supabase's records table does, with the server setting the time. */
class FakeAccount implements Remote {
  rows = new Map<string, RemoteRow>();
  private clock = 0;
  async pull(since: string | null): Promise<RemoteRow[]> {
    return [...this.rows.values()].filter((r) => !since || r.updated_at > since).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  }
  async push(rows: PushRow[]): Promise<RemoteRow[]> {
    return rows.map((r) => {
      const stored: RemoteRow = { ...JSON.parse(JSON.stringify(r)), updated_at: new Date(Date.UTC(2026, 9, 1) + ++this.clock * 1000).toISOString() };
      this.rows.set(`${r.kind}:${r.id}`, stored);
      return stored;
    });
  }
}

let n = 0;
async function device(account: FakeAccount) {
  const store = await Store.open(`sync-${++n}`);
  let state: SyncState = EMPTY_SYNC;
  return {
    store,
    async sync() {
      const r = await syncOnce(await store.snapshot(), account, state, async (merged) => {
        await store.replaceAll(merged);
        return true;
      });
      state = r.state;
      return r;
    },
  };
}

const at = (h: number) => new Date(Date.UTC(2026, 9, 1, h));

describe("sync", () => {
  it("brings lists, cards, answers and quizzes to a second device, and nothing more on a second round", async () => {
    const account = new FakeAccount();
    const a = await device(account);
    const deck = await a.store.createDeck({ name: "Frans", langFront: "fr", langBack: "nl" });
    const [card] = await a.store.addCards(deck.id, [{ front: "la maison", back: "het huis" }]);
    await a.store.grade(card!.id, "goed");
    await a.store.saveQuiz({ id: "11111111-1111-4111-8111-111111111111", name: "Q", questions: [{ id: "22222222-2222-4222-8222-222222222222", type: "tf", prompt: "x", answer: true }], createdAt: at(1).toISOString(), updatedAt: at(1).toISOString() });
    expect((await a.sync()).pushed).toBe(4);

    const b = await device(account);
    await b.sync();
    const snap = await b.store.snapshot();
    expect(snap.decks.map((d) => d.name)).toEqual(["Frans"]);
    expect(snap.cards[0]).toMatchObject({ front: "la maison", box: 2 });
    expect(snap.reviews).toHaveLength(1);
    expect(snap.quizzes).toHaveLength(1);
    // The streak cache is rebuilt from the answers.
    expect((await b.store.allDays()).length).toBe(1);

    expect(await a.sync()).toMatchObject({ pulled: 0, pushed: 0 });
    expect(await b.sync()).toMatchObject({ pushed: 0 });
  });

  it("keeps every answer from both devices and replays the box from them", async () => {
    const account = new FakeAccount();
    const a = await device(account);
    const deck = await a.store.createDeck({ name: "Frans", langFront: "fr", langBack: "nl" });
    const [card] = await a.store.addCards(deck.id, [{ front: "le chien", back: "de hond" }], at(1));
    await a.sync();
    const b = await device(account);
    await b.sync();
    // Offline, on two different days: right on A, wrong on B a day later.
    await a.store.grade(card!.id, "goed", "leren", at(10));
    await b.store.grade(card!.id, "fout", "leren", new Date(at(10).getTime() + 86_400_000));
    await a.sync();
    await b.sync();
    await a.sync();
    for (const d of [a, b]) {
      const s = await d.store.snapshot();
      expect(s.reviews).toHaveLength(2);
      // Right moves it to box 2, the later wrong answer back to 1.
      expect(s.cards[0]!.box).toBe(1);
    }
  });

  it("lets the newest edit of a card win, and carries deletions over", async () => {
    const account = new FakeAccount();
    const a = await device(account);
    const deck = await a.store.createDeck({ name: "Frans", langFront: "fr", langBack: "nl" });
    const [card, other] = await a.store.addCards(deck.id, [{ front: "la fenetre", back: "het raam" }, { front: "le livre", back: "het boek" }], at(1));
    await a.sync();
    const b = await device(account);
    await b.sync();

    await b.store.updateCard(card!.id, { front: "la fenêtre" }, at(5));
    await a.store.updateCard(card!.id, { front: "la fenetre!" }, at(3));
    await a.store.deleteCard(other!.id);
    await a.sync();
    await b.sync();
    await a.sync();
    for (const d of [a, b]) {
      const s = await d.store.snapshot();
      expect(s.cards.map((c) => c.front)).toEqual(["la fenêtre"]);
    }

    await b.store.deleteDeck(deck.id);
    await b.sync();
    await a.sync();
    expect((await a.store.snapshot()).decks).toEqual([]);
    expect((await a.store.snapshot()).cards).toEqual([]);
  });

  it("refuses data from the account that is not valid, and leaves the device alone", async () => {
    const local = { decks: [], cards: [], reviews: [], quizzes: [] };
    const bad: RemoteRow[] = [
      { kind: "deck", id: "d", data: { id: "not-a-uuid", name: "x", langFront: "fr", langBack: "nl", createdAt: at(1).toISOString() }, deleted: false, updated_at: at(1).toISOString() },
    ];
    expect(() => merge(local, bad, EMPTY_SYNC)).toThrow(/Invalid data/);
    const script: RemoteRow[] = [
      { kind: "deck", id: "11111111-1111-4111-8111-111111111111", data: { id: "11111111-1111-4111-8111-111111111111", name: "x", langFront: "fr", langBack: "nl", createdAt: at(1).toISOString(), onload: "alert(1)" }, deleted: false, updated_at: at(1).toISOString() },
    ];
    expect(() => merge(local, script, EMPTY_SYNC)).toThrow(/Invalid data/);
  });

  it("does not overwrite answers given while a sync was running", async () => {
    const account = new FakeAccount();
    const a = await device(account);
    const deck = await a.store.createDeck({ name: "Frans", langFront: "fr", langBack: "nl" });
    await a.store.addCards(deck.id, [{ front: "être", back: "zijn" }]);
    await a.sync();
    const b = await device(account);
    const before = await b.store.snapshot();
    const r = await syncOnce(before, account, EMPTY_SYNC, async () => false);
    expect(r.applied).toBe(false);
    expect(r.state).toEqual(EMPTY_SYNC);
  });
});
