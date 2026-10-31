import { describe, expect, it } from "vitest";
import { EXPANDED_DAILY_BANK_FROM, QUESTION_BANK, getDailyQuestions, toPublicQuestion } from "../lib/questions";
import { CLASSIC_QUESTION_BANK, LEGACY_QUESTION_BANK } from "../lib/question-bank";
import { QUESTION_CATEGORIES, QUESTION_DIFFICULTIES } from "../lib/question-types";

describe("daily questions", () => {
  it("selects a deterministic five-question challenge", () => {
    const first = getDailyQuestions("2026-10-30");
    const second = getDailyQuestions("2026-10-30");

    expect(first).toHaveLength(5);
    expect(second.map((question) => question.id)).toEqual(first.map((question) => question.id));
    expect(new Set(first.map((question) => question.id)).size).toBe(5);
  });

  it("does not expose the answer key in public questions", () => {
    for (const question of QUESTION_BANK) {
      expect(Object.keys(toPublicQuestion(question)).sort()).toEqual(["id", "options", "prompt"]);
    }
  });

  it("has complete, unique, playable content at every difficulty", () => {
    expect(QUESTION_BANK).toHaveLength(2150);
    expect(CLASSIC_QUESTION_BANK).toHaveLength(150);
    expect(new Set(QUESTION_BANK.map((question) => question.id)).size).toBe(QUESTION_BANK.length);
    for (const game of [undefined, "general", "maths", "crypto", "movies"]) {
      const bank = QUESTION_BANK.filter(question => question.game === game);
      expect(new Set(bank.map(question => question.prompt.toLowerCase())).size).toBe(bank.length);
    }
    for (const difficulty of QUESTION_DIFFICULTIES) expect(QUESTION_BANK.filter((question) => question.difficulty === difficulty)).toHaveLength(difficulty === "extreme" ? 500 : 550);
    for (const category of QUESTION_CATEGORIES) expect(QUESTION_BANK.some((question) => question.category === category)).toBe(true);
    const positions = [0, 0, 0, 0];
    for (const question of QUESTION_BANK) {
      expect(question.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(QUESTION_DIFFICULTIES).toContain(question.difficulty);
      expect(QUESTION_CATEGORIES).toContain(question.category);
      expect(question.prompt.length).toBeGreaterThan(10);
      expect(question.prompt.length).toBeLessThanOrEqual(240);
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options.map((option) => option.trim().toLowerCase())).size).toBe(4);
      expect(question.options.every((option) => option.trim().length > 0)).toBe(true);
      expect(Number.isInteger(question.answerIndex)).toBe(true);
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex).toBeLessThan(4);
      expect(question.explanation.trim().length).toBeGreaterThan(10);
      positions[question.answerIndex]++;
    }
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(1);
  });

  it("keeps the release-day bank and expands future days and tournament seeds", () => {
    expect(getDailyQuestions("2026-10-30").map((question) => question.id)).toEqual(["speed-distance", "cpu-name", "prime-number", "triangle-angles", "binary-ten"]);
    const legacyIds = new Set(LEGACY_QUESTION_BANK.map((question) => question.id));
    expect(getDailyQuestions("2026-10-30", 50).every((question) => legacyIds.has(question.id))).toBe(true);
    expect(getDailyQuestions(EXPANDED_DAILY_BANK_FROM, 150)).toHaveLength(150);
    expect(getDailyQuestions("tournament:example:attempt", 150)).toHaveLength(150);
    expect(getDailyQuestions("tournament:example:attempt", 10)).toEqual(getDailyQuestions("tournament:example:attempt", 10));
    expect(getDailyQuestions("tournament:example:attempt", 10)).not.toEqual(getDailyQuestions("tournament:example:another", 10));
  });

  it("rejects invalid game sizes instead of returning a partial set", () => {
    for (const count of [0, -1, 1.5, NaN, Infinity, 151]) expect(() => getDailyQuestions(EXPANDED_DAILY_BANK_FROM, count)).toThrow();
    expect(() => getDailyQuestions("2026-10-30", 51)).toThrow();
  });
});
