import { APP_NAME, LIMITS } from "../config";
import { setLang, t } from "../i18n/index.svelte";
import { backupFileName, makeBackup, type SharedDeck, type SharedFolder, type SharedQuiz } from "./backup";
import { localDay } from "./dates";
import { Store, defaultSettings, detectLang, newId, type DeckInput, type NewCard, type Snapshot } from "./db";
import { downloadText } from "./files";
import { setPendingImport, sharedTextFromUrl } from "./handoff";
import { difficulty, isHard, streak, type Difficulty } from "./history";
import { requestPersist } from "./persist";
import type { PracticeCard } from "./practice";
import { parseHash, type Count, type Route, type Which } from "./router";
import { buildSession } from "./session";
import type { Box, Card, DayStat, Deck, Grade, Lang, Mode, Quiz, Settings, Theme } from "./types";
import { getSelection } from "./selection";

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
  quizzes = $state.raw<Quiz[]>([]);
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
    // Text shared into the app from another app (Android share sheet) goes to the paste screen.
    const shared = sharedTextFromUrl(location.search);
    if (shared !== null) {
      setPendingImport({ text: shared, langFront: "en", langBack: detectLang(navigator.language), source: "share" });
      history.replaceState(null, "", `${location.pathname}#/importeren`);
    }
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
    const [decks, cards, days, quizzes] = await Promise.all([this.db.listDecks(), this.db.allCards(), this.db.allDays(), this.db.allQuizzes()]);
    this.quizzes = quizzes;
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

  starredCount(deckId?: string): number {
    let n = 0;
    for (const c of this.cardsIn(deckId)) if (c.starred) n++;
    return n;
  }

  /**
   * Cards for a practice session, with the languages of their list. With a count, the words that need
   * practice most are picked first: often wrong, sometimes wrong, never practised, then the rest.
   */
  practiceCards(scope: string, which: Which, count: Count = "all"): PracticeCard[] {
    const pool = scope === "alles" ? this.cards : this.cardsIn(scope);
    let chosen: Card[];
    if (which === "due") chosen = buildSession(pool, this.today);
    else if (which === "hard") chosen = pool.filter((c) => isHard(c.hist));
    else if (which === "starred") chosen = pool.filter((c) => c.starred);
    else if (which === "selectie") {
      const ids = new Set(getSelection(scope));
      chosen = ids.size ? this.sortedCards(scope).filter((c) => ids.has(c.id)) : this.sortedCards(scope);
    }
    else chosen = scope === "alles" ? pool : this.sortedCards(scope);
    if (count !== "all" && which !== "due" && chosen.length > count) chosen = pickForPractice(chosen, count);
    const langs = new Map(this.decks.map((d) => [d.id, d]));
    return chosen.flatMap((c) => {
      const d = langs.get(c.deckId);
      return d ? [{ id: c.id, front: c.front, back: c.back, langFront: d.langFront, langBack: d.langBack, ...(d.kind === "terms" ? { terms: true } : {}), ...(c.image ? { image: c.image } : {}) }] : [];
    });
  }

  /** Recently practised first; lists never practised after them, newest first. */
  byRecent(decks: readonly Deck[] = this.decks): Deck[] {
    const last = new Map(decks.map((d) => [d.id, this.lastPracticed(d.id) ?? ""]));
    return decks.toSorted((a, b) => last.get(b.id)!.localeCompare(last.get(a.id)!) || b.createdAt.localeCompare(a.createdAt));
  }

  /** Lists grouped by school subject (lists without one go under `other`), busiest first. */
  subjects(other: string): { name: string; decks: Deck[]; words: number; known: number }[] {
    // No prototype, so a subject called "__proto__" or "constructor" is just a name.
    const groups: Record<string, Deck[]> = Object.create(null);
    for (const d of this.decks) {
      const key = d.subject?.trim() || other;
      (groups[key] ??= []).push(d);
    }
    return Object.entries(groups)
      .map(([name, decks]) => {
        const cards = decks.flatMap((d) => this.cardsIn(d.id));
        const known = cards.length ? Math.round((cards.filter((c) => difficulty(c.hist) === "goed").length / cards.length) * 100) : 0;
        return { name, decks, words: cards.length, known };
      })
      .sort((a, b) => b.words - a.words || a.name.localeCompare(b.name));
  }

  /** Lists with a test today or later, soonest first. */
  upcomingExams(): Deck[] {
    return this.decks.filter((d) => d.examDate && d.examDate >= this.today).toSorted((a, b) => a.examDate!.localeCompare(b.examDate!));
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
    const copy = await this.createDeck({ name, langFront: src.langFront, langBack: src.langBack, ...(src.subject ? { subject: src.subject } : {}), ...(src.kind ? { kind: src.kind } : {}) });
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

  // Folders ("mappen"): a name on lists and quizzes. A folder exists while something is in it.

  folders(): { name: string; decks: Deck[]; quizzes: Quiz[] }[] {
    const names = new Set([...this.decks.map((d) => d.folder), ...this.quizzes.map((q) => q.folder)].filter((f): f is string => !!f));
    return [...names]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => ({ name, decks: this.decks.filter((d) => d.folder === name), quizzes: this.quizzes.filter((q) => q.folder === name) }));
  }

  /** Puts lists and quizzes in a folder ("" takes them out). */
  async moveToFolder(items: { decks?: readonly string[]; quizzes?: readonly string[] }, folder: string): Promise<void> {
    const name = folder.trim().slice(0, LIMITS.labelChars);
    for (const id of items.decks ?? []) {
      const next = await this.db.updateDeck(id, { folder: name });
      this.decks = this.decks.map((d) => (d.id === id ? next : d));
    }
    for (const id of items.quizzes ?? []) {
      const q = this.quiz(id);
      if (!q) continue;
      const next: Quiz = { ...q };
      if (name) next.folder = name;
      else delete next.folder;
      await this.db.saveQuiz(next);
      this.quizzes = this.quizzes.map((x) => (x.id === id ? next : x));
    }
  }

  async renameFolder(from: string, to: string): Promise<void> {
    const f = this.folders().find((x) => x.name === from);
    if (f) await this.moveToFolder({ decks: f.decks.map((d) => d.id), quizzes: f.quizzes.map((q) => q.id) }, to);
  }

  // Quizzes

  quiz(id: string): Quiz | undefined {
    return this.quizzes.find((q) => q.id === id);
  }

  /** Saves a new or edited quiz; returns it with its id. */
  async saveQuiz(input: Pick<Quiz, "name" | "questions"> & Partial<Pick<Quiz, "id" | "subject">>): Promise<Quiz> {
    const now = new Date().toISOString();
    const existing = input.id ? this.quiz(input.id) : undefined;
    const quiz: Quiz = { ...existing, id: existing?.id ?? newId(), name: input.name, questions: input.questions, createdAt: existing?.createdAt ?? now, updatedAt: now };
    if (input.subject) quiz.subject = input.subject;
    else delete quiz.subject;
    // Changed questions make an old score meaningless.
    if (existing && JSON.stringify(existing.questions) !== JSON.stringify(input.questions)) delete quiz.last;
    await this.db.saveQuiz(quiz);
    this.quizzes = existing ? this.quizzes.map((q) => (q.id === quiz.id ? quiz : q)) : [...this.quizzes, quiz];
    return quiz;
  }

  async recordQuizResult(id: string, points: number, total: number): Promise<void> {
    const q = this.quiz(id);
    if (!q) return;
    const next: Quiz = { ...q, last: { points, total, at: new Date().toISOString() } };
    await this.db.saveQuiz(next);
    this.quizzes = this.quizzes.map((x) => (x.id === id ? next : x));
  }

  async deleteQuiz(id: string): Promise<void> {
    await this.db.deleteQuiz(id);
    this.quizzes = this.quizzes.filter((q) => q.id !== id);
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

  async setStarred(id: string, starred: boolean): Promise<void> {
    const card = await this.db.setStarred(id, starred);
    this.cards = this.cards.map((c) => (c.id === id ? card : c));
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
  /** Adds a received quiz as your own, with fresh ids. */
  async importSharedQuiz(shared: SharedQuiz["quiz"], folder = ""): Promise<Quiz> {
    const quiz = await this.saveQuiz({ name: shared.name, subject: shared.subject ?? "", questions: shared.questions.map((q) => ({ ...q, id: newId() })) });
    if (folder) await this.moveToFolder({ quizzes: [quiz.id] }, folder);
    return this.quiz(quiz.id) ?? quiz;
  }

  /** Adds a received folder: all its lists and quizzes, in a folder with that name. */
  async importSharedFolder(shared: SharedFolder): Promise<void> {
    for (const d of shared.decks) await this.importShared(d, shared.name);
    for (const q of shared.quizzes) await this.importSharedQuiz(q, shared.name);
  }

  async importShared(shared: SharedDeck, folder = ""): Promise<Deck> {
    const deck = await this.createDeck({ ...shared.deck, ...(folder ? { folder } : {}) });
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

/** The theme of the last visit, kept in this browser so the first paint is already right. */
const THEME_KEY = "klopt-theme";
/** The browser bar takes the page colour (--bg in light and dark). */
const BAR_COLOR = { light: "#F2F5FB", dark: "#0B1736" } as const;

export function applyTheme(theme: Theme, remember = true): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Two theme-color metas (light, dark). With an explicit theme both get that theme's colour.
  const [light, dark] = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (light) light.content = theme === "dark" ? BAR_COLOR.dark : BAR_COLOR.light;
  if (dark) dark.content = theme === "light" ? BAR_COLOR.light : BAR_COLOR.dark;
  if (!remember) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the page starts light and switches once the settings have loaded.
  }
}

/** Applies the theme of the last visit before the settings have loaded from IndexedDB. */
export function applyCachedTheme(): void {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    if (theme === "system" || theme === "light" || theme === "dark") applyTheme(theme, false);
  } catch {
    // Storage blocked: keep the default from index.html.
  }
}

const RANK: Record<Difficulty, number> = { vaak: 0, soms: 1, nieuw: 2, goed: 3 };

/** The `count` cards that need practice most, shuffled within each difficulty group. */
export function pickForPractice<T extends Pick<Card, "hist" | "box">>(cards: readonly T[], count: number, rng: () => number = Math.random): T[] {
  const keyed = cards.map((c) => ({ c, k: RANK[difficulty(c.hist)] * 10 + c.box + rng() * 0.5 }));
  keyed.sort((a, b) => a.k - b.k);
  return keyed.slice(0, count).map((x) => x.c);
}

export const app = new App();
