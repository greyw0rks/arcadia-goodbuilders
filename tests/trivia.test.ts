import { afterEach, describe, expect, it } from "vitest";
import { TRIVIA_QUESTION_BANK } from "../lib/question-bank";
import { TRIVIA_GAMES, TRIVIA_MIX } from "../lib/trivia-catalog";
import { QUESTION_DIFFICULTIES } from "../lib/question-types";
import { selectTriviaQuestions } from "../lib/trivia-selection";
import { ProgressStore } from "../lib/progress-store";
import { GameStore } from "../lib/game-store";
const stores: ProgressStore[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });
describe("four independent trivia banks", () => {
  it("keeps reviewed film credits and independently checked advanced maths answers", () => {
    const answer = (id: string) => {
      const question = TRIVIA_QUESTION_BANK.find(q => q.id === id)!;
      return question.options[question.answerIndex];
    };
    expect(answer("movies-q2875-p57")).toBe("Victor Fleming");
    expect(answer("movies-q18604504-p1040")).toBe("John Gilroy");
    expect(answer("movies-q172975-p58")).toBe("William Monahan");
    expect(TRIVIA_QUESTION_BANK.find(q => q.id === "movies-q486239-p86")?.prompt).toContain("Saw (2004)");
    expect(TRIVIA_QUESTION_BANK.some(q => q.id === "movies-q153723-p86")).toBe(false);
    for (const [family, expected] of ["9", "1/20", "24", "6", "20", "4", "4", "6", "13/2", "62"].entries()) {
      expect(answer(`maths-extreme-${family + 1}-1`)).toBe(expected);
    }
  });
  it("contains 500 complete questions per game and 125 at each difficulty", () => {
    for (const game of TRIVIA_GAMES) {
      const bank = TRIVIA_QUESTION_BANK.filter(q => q.game === game.id);
      expect(bank).toHaveLength(500);
      expect(game.count).toBe(bank.length);
      expect(new Set(bank.map(q => q.prompt.toLowerCase())).size).toBe(500);
      for (const difficulty of QUESTION_DIFFICULTIES) expect(bank.filter(q => q.difficulty === difficulty)).toHaveLength(125);
      expect(bank.every(q => q.source && q.explanation && q.options.length === 4)).toBe(true);
    }
  });
  it("keeps selected subjects and difficulty, shuffles answers and reproduces stored seeds", () => {
    const originals = new Map(TRIVIA_QUESTION_BANK.map(q => [q.id, q]));
    for (const game of TRIVIA_GAMES) for (const difficulty of ["mixed", ...QUESTION_DIFFICULTIES] as const) {
      for (let seed = 0; seed < 12; seed++) {
        const selection = { game: game.id, difficulty };
        const questions = selectTriviaQuestions(String(seed), selection);
        expect(questions).toHaveLength(10);
        expect(questions).toEqual(selectTriviaQuestions(String(seed), selection));
        expect(new Set(questions.map(q => q.id)).size).toBe(10);
        expect(questions.every(q => q.game === game.id)).toBe(true);
        expect(questions.map(q => q.difficulty)).toEqual(difficulty === "mixed" ? [...TRIVIA_MIX] : Array(10).fill(difficulty));
        for (const question of questions) {
          const original = originals.get(question.id)!;
          expect(question.options[question.answerIndex]).toBe(original.options[original.answerIndex]);
        }
      }
    }
  }, 30_000);
  it("resumes a private round without identity RPC and cannot award daily or tournament XP", async () => {
    const db = new ProgressStore({ url: "file::memory:" }); stores.push(db);
    const games = new GameStore(db);
    const now = Date.parse("2026-10-31T12:00:00Z");
    const selection = { game: "maths", difficulty: "extreme" } as const;
    const game = await games.start("player", "arcade", "verified-root", false, now, selection);
    expect(game).toMatchObject({ total: 10, practice: true, secondsPerQuestion: 10, trivia: null });
    expect(await games.actionRoot("player", game.id, async () => { throw new Error("RPC offline"); })).toBeNull();
    expect((await games.start("player", "arcade", "verified-root", false, now + 1000, selection)).id).toBe(game.id);
    await expect(games.act("other", null, game.id, "read", undefined, undefined, now)).rejects.toMatchObject({ status: 403 });
    for (let i = 0; i < 10; i++) {
      await games.act("player", null, game.id, "answer", i, 0, now);
      await games.act("player", null, game.id, "next", i, undefined, now);
    }
    const completed = await games.act("player", null, game.id, "finish", undefined, undefined, now);
    expect(completed.phase).toBe("complete"); expect(completed.result?.creditedXp).toBe(0);
    expect((await db.get("player")).xp).toBe(0);
    expect((await games.competition(null, now)).collectiveXp).toBe(0);
    expect((await games.start("player", "arcade", "verified-root", false, now, selection)).id).not.toBe(game.id);
    expect((await games.start("player", "arcade", "verified-root", false, now)).total).toBe(10);
  });
  it("fails rather than mixing another subject into a depleted bank", () => {
    expect(() => selectTriviaQuestions("empty", { game: "movies", difficulty: "extreme" }, TRIVIA_QUESTION_BANK.filter(q => q.game !== "movies"))).toThrow();
  });
});
