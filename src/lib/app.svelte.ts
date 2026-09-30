import { setLang } from "../i18n/index.svelte";
import { APP_NAME } from "../config";
import { backupFileName, makeBackup, type SharedDeck } from "./backup";
import { downloadText } from "./files";
import { localDay } from "./dates";
import { Store, defaultSettings, type NewCard, type Snapshot } from "./db";
import { requestPersist } from "./persist";
import { parseHash, type Route } from "./router";
import type { Box, Card, Deck, Grade, Lang, Settings, Theme } from "./types";

export type BoxCounts = [number, number, number, number, number];

class App {
  ready = $state(false);
  failed = $state(false);
  route = $state<Route>({ name: "today" });
  settings = $state<Settings>(defaultSettings());
  decks = $state.raw<Deck[]>([]);
  cards = $state.raw<Card[]>([]);
  today = $state(localDay());
  /** Short-lived message for the whole app, announced politely. */
  flash = $state("");

  private store: Store | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  private get db(): Store {
    if (!this.store) throw new Error("Database not open");
    return this.store;
  }

  async init(): Promise<void> {
    this.route = parseHash(location.hash);
    window.addEventListener("hashchange", () => {
      this.route = parseHash(location.hash);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.today = localDay();
    });
    try {
      this.store = await Store.open();
      this.settings = await this.store.getSettings(navigator.language);
      applyTheme(this.settings.theme);
      setLang(this.settings.uiLang);
      await this.reload();
      this.ready = true;
    } catch (e) {
      console.error(e);
      this.failed = true;
    }
  }

  async reload(): Promise<void> {
    const [decks, cards] = await Promise.all([this.db.listDecks(), this.db.allCards()]);
    this.decks = decks;
    this.cards = cards;
    this.settings = await this.db.getSettings(navigator.language);
  }

  showFlash(message: string): void {
    this.flash = message;
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => (this.flash = ""), 4000);
  }

  // Derived views

  deck(id: string): Deck | undefined {
    return this.decks.find((d) => d.id === id);
  }

  cardsIn(deckId?: string): Card[] {
    return deckId ? this.cards.filter((c) => c.deckId === deckId) : this.cards;
  }

  dueCount(deckId?: string): number {
    let n = 0;
    for (const c of this.cardsIn(deckId)) if (c.due <= this.today) n++;
    return n;
  }

  boxCounts(deckId?: string): BoxCounts {
    const counts: BoxCounts = [0, 0, 0, 0, 0];
    for (const c of this.cardsIn(deckId)) counts[(c.box - 1) as 0 | 1 | 2 | 3 | 4]++;
    return counts;
  }

  /** Earliest due date after today, if any. */
  nextDue(deckId?: string): string | undefined {
    let min: string | undefined;
    for (const c of this.cardsIn(deckId)) if (c.due > this.today && (!min || c.due < min)) min = c.due;
    return min;
  }

  // Settings

  async setTheme(theme: Theme): Promise<void> {
    applyTheme(theme);
    this.settings = await this.db.saveSettings({ theme });
  }

  async setUiLang(uiLang: Lang): Promise<void> {
    setLang(uiLang);
    this.settings = await this.db.saveSettings({ uiLang });
  }

  async saveSettings(patch: Partial<Settings>): Promise<void> {
    this.settings = await this.db.saveSettings(patch);
  }

  // Decks

  async createDeck(input: Pick<Deck, "name" | "lang"> & Partial<Pick<Deck, "subject">>): Promise<Deck> {
    const deck = await this.db.createDeck(input);
    this.decks = [...this.decks, deck];
    if (!this.settings.persistRequested) {
      void requestPersist();
      this.settings = await this.db.saveSettings({ persistRequested: true });
    }
    return deck;
  }

  async updateDeck(id: string, patch: Partial<Pick<Deck, "name" | "lang" | "subject">>): Promise<void> {
    const deck = await this.db.updateDeck(id, patch);
    this.decks = this.decks.map((d) => (d.id === id ? deck : d));
  }

  async deleteDeck(id: string): Promise<void> {
    await this.db.deleteDeck(id);
    this.decks = this.decks.filter((d) => d.id !== id);
    this.cards = this.cards.filter((c) => c.deckId !== id);
  }

  // Cards

  async addCards(deckId: string, inputs: readonly NewCard[]): Promise<Card[]> {
    const added = await this.db.addCards(deckId, inputs);
    this.cards = [...this.cards, ...added];
    this.settings = await this.db.getSettings(navigator.language);
    return added;
  }

  async updateCard(id: string, patch: Partial<Pick<Card, "front" | "back" | "topic">>): Promise<void> {
    const card = await this.db.updateCard(id, patch);
    this.cards = this.cards.map((c) => (c.id === id ? card : c));
    this.settings = await this.db.getSettings(navigator.language);
  }

  async deleteCard(id: string): Promise<void> {
    await this.db.deleteCard(id);
    this.cards = this.cards.filter((c) => c.id !== id);
  }

  async grade(cardId: string, grade: Grade): Promise<{ fromBox: Box; toBox: Box }> {
    const { card, review } = await this.db.grade(cardId, grade);
    this.cards = this.cards.map((c) => (c.id === cardId ? card : c));
    return { fromBox: review.fromBox, toBox: review.toBox };
  }

  /** Adds a shared deck as a new deck with fresh cards (box 1, due today). */
  async importShared(shared: SharedDeck): Promise<Deck> {
    const deck = await this.createDeck(shared.deck);
    await this.addCards(deck.id, shared.cards);
    return deck;
  }

  // Whole database

  snapshot(): Promise<Snapshot> {
    return this.db.snapshot();
  }

  async replaceAll(data: Snapshot): Promise<void> {
    await this.db.replaceAll(data);
    await this.reload();
  }

  async merge(data: Snapshot): Promise<{ decks: number; cards: number; reviews: number }> {
    const counts = await this.db.merge(data);
    await this.reload();
    return counts;
  }

  /** Downloads a full backup and resets the reminder counter. */
  async exportBackup(): Promise<void> {
    const data = await this.db.snapshot();
    downloadText(backupFileName(APP_NAME), JSON.stringify(makeBackup(data)));
    await this.markExported();
  }

  async markExported(): Promise<void> {
    this.settings = await this.db.saveSettings({ changesSinceExport: 0, reminderSnoozedAt: 0, lastExportAt: new Date().toISOString() });
  }

  async wipe(): Promise<void> {
    await this.db.wipe();
    await this.reload();
    applyTheme(this.settings.theme);
    setLang(this.settings.uiLang);
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // Two theme-color metas (light, dark). With an explicit theme both get that theme's colour.
  const [light, dark] = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (light) light.content = theme === "dark" ? "#0E1419" : "#E8EDF0";
  if (dark) dark.content = theme === "light" ? "#E8EDF0" : "#0E1419";
}

export const app = new App();
