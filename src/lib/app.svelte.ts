import { APP_NAME } from "../config";
import { setLang, t } from "../i18n/index.svelte";
import { backupFileName, makeBackup, type SharedDeck } from "./backup";
import { localDay } from "./dates";
import { Store, defaultSettings, type DeckInput, type NewCard, type Snapshot } from "./db";
import { downloadText } from "./files";
import { difficulty, isHard, streak, type Difficulty } from "./history";
import { requestPersist } from "./persist";
import type { PracticeCard } from "./practice";
import { parseHash, type Route } from "./router";
import { buildSession } from "./session";
import type { Box, Card, DayStat, Deck, Grade, Lang, Mode, Settings, Theme } from "./types";

export type BoxCounts = [number, number, number, number, number];
export type DiffCounts = Record<Difficulty, number>;

class App {
  ready = $state(false);
  failed = $state(false);
  route = $state<Route>({ name: "today" });
  settings = $state<Settings>(defaultSettings());
  decks = $state.raw<Deck[]>([]);
  cards = $state.raw<Card[]>([]);
  days = $state.raw<DayStat[]>([]);
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
    // An app left open past midnight moves on to the new day by itself.
    setInterval(() => {
      const day = localDay();
      if (day !== this.today) this.today = day;
    }, 60_000);
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
    const [decks, cards, days] = await Promise.all([this.db.listDecks(), this.db.allCards(), this.db.allDays()]);
    this.decks = decks;
    this.cards = cards;
    this.days = days;
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

  /** Cards of a deck in list order (the order they were added). */
  sortedCards(deckId: string): Card[] {
    return this.cardsIn(deckId).toSorted((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  dueCount(deckId?: string): number {
    let n = 0;
    for (const c of this.cardsIn(deckId)) if (c.due <= this.today) n++;
    return n;
  }

  hardCount(deckId?: string): number {
    let n = 0;
    for (const c of this.cardsIn(deckId)) if (isHard(c.hist)) n++;
    return n;
  }

  boxCounts(deckId?: string): BoxCounts {
    const counts: BoxCounts = [0, 0, 0, 0, 0];
    for (const c of this.cardsIn(deckId)) counts[(c.box - 1) as 0 | 1 | 2 | 3 | 4]++;
    return counts;
  }

  diffCounts(deckId?: string): DiffCounts {
    const counts: DiffCounts = { vaak: 0, soms: 0, goed: 0, nieuw: 0 };
    for (const c of this.cardsIn(deckId)) counts[difficulty(c.hist)]++;
    return counts;
  }

  /** Share of cards that are known: answered and mostly right. */
  knownPct(deckId?: string): number {
    const cards = this.cardsIn(deckId);
    if (!cards.length) return 0;
    const known = cards.filter((c) => difficulty(c.hist) === "goed").length;
    return Math.round((known / cards.length) * 100);
  }

  /** Local day the list was last practised on, if ever. */
  lastPracticed(deckId: string): string | undefined {
    let last: string | undefined;
    for (const c of this.cardsIn(deckId)) if (c.lastDay && (!last || c.lastDay > last)) last = c.lastDay;
    return last;
  }

  /** Earliest due date after today, if any. */
  nextDue(deckId?: string): string | undefined {
    let min: string | undefined;
    for (const c of this.cardsIn(deckId)) if (c.due > this.today && (!min || c.due < min)) min = c.due;
    return min;
  }

  /** Cards for a practice session, with the languages of their list. */
  practiceCards(scope: string, which: "all" | "hard" | "due"): PracticeCard[] {
    const pool = scope === "alles" ? this.cards : this.cardsIn(scope);
    let chosen: Card[];
    if (which === "due") chosen = buildSession(pool, this.today);
    else if (which === "hard") chosen = pool.filter((c) => isHard(c.hist));
    else chosen = scope === "alles" ? pool : this.sortedCards(scope);
    const langs = new Map(this.decks.map((d) => [d.id, d]));
    return chosen.flatMap((c) => {
      const d = langs.get(c.deckId);
      return d ? [{ id: c.id, front: c.front, back: c.back, langFront: d.langFront, langBack: d.langBack }] : [];
    });
  }

  // Streak and daily goal

  answersToday(): number {
    return this.days.find((d) => d.day === this.today)?.answers ?? 0;
  }

  streak(): { days: number; today: boolean } {
    return streak(new Set(this.days.filter((d) => d.answers > 0).map((d) => d.day)), this.today);
  }

  bestStreak(): number {
    const days = this.days.filter((d) => d.answers > 0).map((d) => d.day).sort();
    let best = 0;
    let run = 0;
    let prev = "";
    for (const d of days) {
      run = prev && new Date(`${d}T12:00:00Z`).getTime() - new Date(`${prev}T12:00:00Z`).getTime() === 86_400_000 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    return best;
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

  async createDeck(input: DeckInput): Promise<Deck> {
    const deck = await this.db.createDeck(input);
    this.decks = [...this.decks, deck];
    if (!this.settings.persistRequested) {
      void requestPersist();
      this.settings = await this.db.saveSettings({ persistRequested: true });
    }
    return deck;
  }

  async updateDeck(id: string, patch: Partial<DeckInput>): Promise<void> {
    const deck = await this.db.updateDeck(id, patch);
    this.decks = this.decks.map((d) => (d.id === id ? deck : d));
  }

  /** Copies a list with all its words and fresh progress. */
  async duplicateDeck(id: string, name: string): Promise<Deck> {
    const src = this.deck(id);
    if (!src) throw new Error("Deck not found");
    const copy = await this.createDeck({ name, langFront: src.langFront, langBack: src.langBack, ...(src.subject ? { subject: src.subject } : {}) });
    await this.addCards(
      copy.id,
      this.sortedCards(id).map((c) => ({ front: c.front, back: c.back, ...(c.topic ? { topic: c.topic } : {}) })),
    );
    return copy;
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

  async saveDeckCards(deckId: string, rows: readonly (NewCard & { id?: string })[]): Promise<void> {
    await this.db.saveDeckCards(deckId, rows);
    const fresh = await this.db.listCards(deckId);
    this.cards = [...this.cards.filter((c) => c.deckId !== deckId), ...fresh];
    this.settings = await this.db.getSettings(navigator.language);
  }

  async deleteCard(id: string): Promise<void> {
    await this.db.deleteCard(id);
    this.cards = this.cards.filter((c) => c.id !== id);
  }

  /** Records an answer. Shows a one-time message when the daily goal is reached. */
  async grade(cardId: string, grade: Grade, mode: Mode): Promise<{ fromBox: Box; toBox: Box; counts: boolean }> {
    const { card, review } = await this.db.grade(cardId, grade, mode);
    this.cards = this.cards.map((c) => (c.id === cardId ? card : c));
    const day = review.day;
    const stat = this.days.find((d) => d.day === day);
    const next = { day, answers: (stat?.answers ?? 0) + 1, correct: (stat?.correct ?? 0) + (grade === "goed" ? 1 : 0) };
    this.days = stat ? this.days.map((d) => (d.day === day ? next : d)) : [...this.days, next];
    if (next.answers >= this.settings.dailyGoal && this.settings.goalCelebratedOn !== day) {
      this.showFlash(t("result.goalDone"));
      void this.saveSettings({ goalCelebratedOn: day });
    }
    return { fromBox: review.fromBox, toBox: review.toBox, counts: review.counts };
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
  if (light) light.content = theme === "dark" ? "#0F1422" : "#F4F6FB";
  if (dark) dark.content = theme === "light" ? "#F4F6FB" : "#0F1422";
}

export const app = new App();
