import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { makeBackup, parseBackup } from "../../src/lib/backup";
import { Store } from "../../src/lib/db";
import { blanksOf, clozeParts, mark, questionProblem, quizGrade } from "../../src/lib/quiz";
import type { Quiz, QuizQuestion } from "../../src/lib/types";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mc: QuizQuestion = { id: id(1), type: "mc", prompt: "Wanneer was D-Day?", options: ["1942", "1944", "1945"], correct: 1 };
const tf: QuizQuestion = { id: id(2), type: "tf", prompt: "Nederland was neutraal in 1940.", answer: false };
const open: QuizQuestion = { id: id(3), type: "open", prompt: "Wat is verzet?", answer: "Strijd tegen de bezetter." };
const cloze: QuizQuestion = { id: id(4), type: "cloze", text: "De Februaristaking was in [1941] in [Amsterdam]." };

describe("fill-in text", () => {
  it("splits text and blanks; empty brackets and line breaks stay text", () => {
    expect(clozeParts("De staking was in [1941] in [Amsterdam].")).toEqual([
      { text: "De staking was in " },
      { blank: "1941" },
      { text: " in " },
      { blank: "Amsterdam" },
      { text: "." },
    ]);
    expect(blanksOf("[ a ] en [] en [b\nc]")).toEqual(["a"]);
  });
});

describe("marking", () => {
  it("marks every question type, with partial points for fill-ins", () => {
    expect(mark(mc, { type: "mc", chosen: 1 }).points).toBe(1);
    expect(mark(mc, { type: "mc", chosen: 0 }).points).toBe(0);
    expect(mark(tf, { type: "tf", chosen: false }).points).toBe(1);
    expect(mark(open, { type: "open", selfGrade: "fout" }).points).toBe(0);
    expect(mark(cloze, { type: "cloze", given: ["1941", "amsterdam"] })).toEqual({ points: 1, blanks: [true, true] });
    expect(mark(cloze, { type: "cloze", given: ["1940", "Amsterdam"] })).toEqual({ points: 0.5, blanks: [false, true] });
    // A missing accent or one typo still counts in a fill-in; an empty blank never does.
    expect(mark({ ...cloze, text: "[café]" }, { type: "cloze", given: ["cafe"] }).points).toBe(1);
    expect(mark(cloze, { type: "cloze", given: ["", ""] }).points).toBe(0);
  });

  it("turns points into a Dutch grade", () => {
    expect(quizGrade(4, 4)).toBe(10);
    expect(quizGrade(0, 4)).toBe(1);
    expect(quizGrade(2.5, 4)).toBe(6.6);
  });

  it("says what is missing before a question can be saved", () => {
    expect(questionProblem(mc)).toBeNull();
    expect(questionProblem({ ...mc, options: ["1944", ""], correct: 1 })).toBe("options");
    expect(questionProblem({ ...open, answer: " " })).toBe("empty");
    expect(questionProblem({ ...cloze, text: "Geen haken" })).toBe("blanks");
  });
});

describe("quizzes in the database and backups", () => {
  const quiz: Quiz = { id: id(9), name: "WO2", subject: "Geschiedenis", questions: [mc, tf, open, cloze], createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z", last: { points: 3.5, total: 4, at: "2026-10-01T11:00:00.000Z" } };

  it("survive a backup round trip and a wipe", async () => {
    const store = await Store.open("quiz-rt");
    await store.saveQuiz(quiz);
    const parsed = parseBackup(JSON.stringify(makeBackup(await store.snapshot())));
    expect(parsed.ok && parsed.data.quizzes).toEqual([quiz]);
    await store.wipe();
    expect(await store.allQuizzes()).toEqual([]);
    if (parsed.ok) await store.replaceAll(parsed.data);
    expect(await store.allQuizzes()).toEqual([quiz]);
  });

  it("rejects broken quizzes in a backup", () => {
    const file = (q: unknown) => JSON.stringify({ ...makeBackup({ decks: [], cards: [], reviews: [] }), quizzes: [q] });
    const bad: [unknown, string][] = [
      [{ ...quiz, questions: [{ ...mc, correct: 3 }] }, "quizzes[0].questions[0].correct"],
      [{ ...quiz, questions: [{ ...mc, options: ["x"] }] }, "quizzes[0].questions[0].options"],
      [{ ...quiz, questions: [{ ...cloze, text: "geen lege plek" }] }, "quizzes[0].questions[0].text"],
      [{ ...quiz, questions: [{ ...tf, answer: "nee" }] }, "quizzes[0].questions[0].answer"],
      [{ ...quiz, questions: [{ ...open, type: "essay" }] }, "quizzes[0].questions[0].type"],
      [{ ...quiz, questions: [mc, mc] }, "quizzes[0].questions[1].id"],
      [{ ...quiz, last: { points: 5, total: 4, at: quiz.createdAt } }, "quizzes[0].last.points"],
      [{ ...quiz, script: "<x>" }, "quizzes[0].script"],
    ];
    for (const [q, where] of bad) expect(parseBackup(file(q)), where).toMatchObject({ ok: false, error: { where } });
  });

  it("merges by newest edit", async () => {
    const store = await Store.open("quiz-merge");
    await store.saveQuiz(quiz);
    await store.merge({ decks: [], cards: [], reviews: [], quizzes: [{ ...quiz, name: "Ouder", updatedAt: "2026-09-01T00:00:00.000Z" }] });
    expect((await store.allQuizzes())[0]!.name).toBe("WO2");
    await store.merge({ decks: [], cards: [], reviews: [], quizzes: [{ ...quiz, name: "Nieuwer", updatedAt: "2026-10-02T00:00:00.000Z" }] });
    expect((await store.allQuizzes())[0]!.name).toBe("Nieuwer");
  });
});
