/**
 * Practice session engine. Pure: no DOM, no storage, injectable randomness.
 * The screen asks for `current`, shows it, and reports one outcome per question with `answer()`.
 */
import { isTypeable, normalize } from "./answer";
import type { ContentLang, Grade, Mode } from "./types";
import type { Rng } from "./session";

export type Direction = "front" | "back" | "mixed";
export type Kind = "flash" | "mc" | "type" | "dictee";

export interface PracticeCard {
  id: string;
  front: string;
  back: string;
  langFront: ContentLang;
  langBack: ContentLang;
  /** From a term list: its back is an explanation, which is never typed. */
  terms?: boolean;
}

export interface Question {
  /** Unique per question shown, for keyed rendering. */
  key: number;
  card: PracticeCard;
  kind: Kind;
  prompt: string;
  promptLang: ContentLang;
  answer: string;
  answerLang: ContentLang;
  options?: string[];
  /** 1 for the first time this card is asked in the session. */
  attempt: number;
}

export interface Mistake {
  card: PracticeCard;
  prompt: string;
  answer: string;
  given?: string;
}

export interface PracticeConfig {
  mode: Mode;
  direction: Direction;
  /** For dictee: languages the device can pronounce. */
  canSpeak?: (lang: ContentLang) => boolean;
  /** Keep the given order instead of shuffling (the Leitner queue is already ordered by box). */
  keepOrder?: boolean;
}

interface Item {
  card: PracticeCard;
  /** Which side is shown. */
  ask: "front" | "back";
  /** Leren: 0 = multiple choice, 1 = recall. */
  level: number;
  attempts: number;
}

/** Positions ahead where a missed card comes back in "leren". */
const LEARN_GAP = 3;

/** Everything needed to continue a session later, as plain JSON. */
export interface PracticeSnapshot {
  v: 1;
  mode: Mode;
  total: number;
  done: number;
  right: number;
  wrong: number;
  first: [string, Grade][];
  mistakes: { cardId: string; prompt: string; answer: string; given?: string }[];
  queue: { cardId: string; ask: "front" | "back"; level: number; attempts: number }[];
}

export class Practice {
  readonly mode: Mode;
  total: number;
  /** Cards finished (mastered, or answered once in single-pass modes). */
  done = 0;
  /** All answers given, like StudyGo's tick and cross counters. */
  right = 0;
  wrong = 0;
  current: Question | null = null;
  /** First-attempt grade per card id. */
  readonly first = new Map<string, Grade>();
  readonly mistakes: Mistake[] = [];

  private queue: Item[];
  private readonly pool: Record<"front" | "back", string[]>;
  private key = 0;

  constructor(
    cards: readonly PracticeCard[],
    private readonly config: PracticeConfig,
    private readonly rng: Rng = Math.random,
  ) {
    this.mode = config.mode;
    const usable = config.mode === "dictee" ? cards.filter((c) => this.dicteeSide(c) !== null) : cards;
    this.total = usable.length;
    this.pool = { front: uniq(cards.map((c) => c.front)), back: uniq(cards.map((c) => c.back)) };
    const items = usable.map((card) => ({ card, ask: this.pickSide(), level: 0, attempts: 0 }));
    this.queue = config.keepOrder ? items : shuffle(items, rng);
    this.next();
  }

  get finished(): boolean {
    return this.current === null;
  }

  get remaining(): number {
    return this.total - this.done;
  }

  /** Dutch school grade from first attempts: goed = 1, twijfel = 0.5, fout = 0. */
  get cijfer(): number {
    if (this.first.size === 0) return 1;
    let points = 0;
    for (const g of this.first.values()) points += g === "goed" ? 1 : g === "twijfel" ? 0.5 : 0;
    return Math.round((1 + (9 * points) / this.first.size) * 10) / 10;
  }

  /** Records the outcome of the current question and moves on. */
  answer(grade: Grade, given?: string): void {
    const q = this.current;
    if (!q) return;
    const item = this.queue.shift()!;
    item.attempts++;
    if (!this.first.has(q.card.id)) {
      this.first.set(q.card.id, grade);
      if (grade !== "goed") this.mistakes.push({ card: q.card, prompt: q.prompt, answer: q.answer, ...(given ? { given } : {}) });
    }
    if (grade === "goed") this.right++;
    else this.wrong++;

    switch (this.mode) {
      case "leren":
        this.learn(item, grade, q.kind);
        break;
      case "meerkeuze":
      case "toets":
        this.done++;
        break;
      default:
        // herhalen, flashcards, typen, dictee: wrong cards come back at the end until right.
        if (grade === "fout") this.queue.push(item);
        else this.done++;
    }
    this.next();
  }

  private learn(item: Item, grade: Grade, kind: Kind): void {
    if (grade === "goed" && (item.level >= 1 || kind !== "mc")) {
      this.done++;
      return;
    }
    if (grade === "goed") item.level = 1;
    else if (grade === "fout") item.level = 0;
    // twijfel keeps the level: ask again later.
    this.queue.splice(Math.min(LEARN_GAP, this.queue.length), 0, item);
  }

  snapshot(): PracticeSnapshot {
    return {
      v: 1,
      mode: this.mode,
      total: this.total,
      done: this.done,
      right: this.right,
      wrong: this.wrong,
      first: [...this.first.entries()],
      mistakes: this.mistakes.map((m) => ({ cardId: m.card.id, prompt: m.prompt, answer: m.answer, ...(m.given ? { given: m.given } : {}) })),
      queue: this.queue.map((i) => ({ cardId: i.card.id, ask: i.ask, level: i.level, attempts: i.attempts })),
    };
  }

  /**
   * Continues a saved session with the current cards. Words deleted since are dropped;
   * returns null when the snapshot doesn't fit (other mode, or nothing left to ask).
   */
  static restore(cards: readonly PracticeCard[], config: PracticeConfig, snap: PracticeSnapshot, rng: Rng = Math.random): Practice | null {
    if (snap.v !== 1 || snap.mode !== config.mode) return null;
    const byId = new Map(cards.map((c) => [c.id, c]));
    const queue = snap.queue.flatMap((i) => {
      const card = byId.get(i.cardId);
      return card ? [{ card, ask: i.ask, level: i.level, attempts: i.attempts }] : [];
    });
    if (!queue.length) return null;
    const p = new Practice(cards, { ...config, keepOrder: true }, rng);
    p.queue = queue;
    p.total = snap.total;
    p.done = snap.done;
    p.right = snap.right;
    p.wrong = snap.wrong;
    p.first.clear();
    for (const [id, g] of snap.first) p.first.set(id, g);
    p.mistakes.length = 0;
    for (const m of snap.mistakes) {
      const card = byId.get(m.cardId);
      if (card) p.mistakes.push({ card, prompt: m.prompt, answer: m.answer, ...(m.given ? { given: m.given } : {}) });
    }
    p.next();
    return p;
  }

  private next(): void {
    const item = this.queue[0];
    if (!item) {
      this.current = null;
      return;
    }
    this.current = this.build(item);
  }

  private build(item: Item): Question {
    const { card } = item;
    const answerSide = item.ask === "front" ? "back" : "front";
    let prompt = card[item.ask];
    let promptLang = item.ask === "front" ? card.langFront : card.langBack;
    let answer = card[answerSide];
    let answerLang = answerSide === "front" ? card.langFront : card.langBack;
    let kind = this.kindFor(item, answer);

    if (this.mode === "dictee") {
      const side = this.dicteeSide(card)!;
      prompt = answer = card[side];
      promptLang = answerLang = side === "front" ? card.langFront : card.langBack;
      kind = "dictee";
    }

    const q: Question = { key: ++this.key, card, kind, prompt, promptLang, answer, answerLang, attempt: item.attempts + 1 };
    if (kind === "mc") q.options = this.options(answer, answerSide);
    return q;
  }

  private kindFor(item: Item, answer: string): Kind {
    // An explanation is checked by flipping, however short; the term itself can still be typed.
    const typeable = isTypeable(answer) && !(item.card.terms && item.ask === "front");
    const mcPossible = this.pool[item.ask === "front" ? "back" : "front"].length >= 4;
    switch (this.mode) {
      case "flashcards":
        return "flash";
      case "meerkeuze":
        return mcPossible ? "mc" : "flash";
      case "leren":
        if (item.level === 0 && mcPossible) return "mc";
        return typeable ? "type" : "flash";
      case "toets":
        return typeable ? "type" : mcPossible ? "mc" : "flash";
      default:
        // herhalen, typen
        return typeable ? "type" : "flash";
    }
  }

  private options(answer: string, side: "front" | "back"): string[] {
    const target = normalize(answer);
    const distractors = shuffle(
      this.pool[side].filter((a) => normalize(a) !== target),
      this.rng,
    ).slice(0, 3);
    return shuffle([answer, ...distractors], this.rng);
  }

  private pickSide(): "front" | "back" {
    if (this.config.direction === "mixed") return this.rng() < 0.5 ? "front" : "back";
    return this.config.direction;
  }

  /** The side to dictate: the foreign-language side the device can pronounce. */
  private dicteeSide(card: PracticeCard): "front" | "back" | null {
    const can = this.config.canSpeak ?? (() => false);
    const ok = (lang: ContentLang) => lang !== "xx" && can(lang);
    const frontOk = ok(card.langFront) && isTypeable(card.front);
    const backOk = ok(card.langBack) && isTypeable(card.back);
    if (frontOk && backOk) return card.langFront === "nl" ? "back" : "front";
    if (frontOk) return "front";
    if (backOk) return "back";
    return null;
  }
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    const k = normalize(s);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
