import { describe, expect, it } from "vitest";
import { mixGameQuestions } from "../lib/question-mixer";
import { toPublicQuestion } from "../lib/questions";
import { CLASSIC_QUESTION_BANK as QUESTION_BANK } from "../lib/question-bank";
import { QUESTION_MIX } from "../lib/question-policy";
import type { GameMode } from "../lib/game-types";

describe("balanced question mixing", () => {
  it("meets difficulty, topic, ecosystem and uniqueness rules across 1,000 games", () => {
    const appearances = new Set<string>();
    for (const mode of ["daily", "tournament"] as const) {
      const policy = QUESTION_MIX[mode];
      for (let seed = 0; seed < 500; seed++) {
        const questions = mixGameQuestions(`sample:${seed}`, mode);
        expect(questions.map((question) => question.difficulty)).toEqual(policy.difficulties);
        expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
        const categories = questions.map((question) => question.category);
        expect(new Set(categories).size).toBeGreaterThanOrEqual(policy.minCategories);
        expect(categories.filter((category) => category === "celo-gooddollar")).toHaveLength(policy.goodDollarCount);
        for (const category of new Set(categories)) expect(categories.filter((value) => value === category).length).toBeLessThanOrEqual(policy.maxPerCategory);
        for (const question of questions) appearances.add(question.id);
      }
    }
    // Detect a seeded selector that accidentally leaves part of the bank unreachable.
    expect(appearances.size).toBe(QUESTION_BANK.length);
  });

  it("reproduces a seed and keeps answer text correct after shuffling", () => {
    const original = new Map(QUESTION_BANK.map((question) => [question.id, question]));
    const before = JSON.stringify(QUESTION_BANK);
    let changed = 0;
    for (let seed = 0; seed < 40; seed++) {
      const questions = mixGameQuestions(`shuffle:${seed}`, "tournament");
      expect(questions).toEqual(mixGameQuestions(`shuffle:${seed}`, "tournament"));
      for (const question of questions) {
        const source = original.get(question.id)!;
        expect(question.options[question.answerIndex]).toBe(source.options[source.answerIndex]);
        expect([...question.options].sort()).toEqual([...source.options].sort());
        if (question.options.join() !== source.options.join()) changed++;
        expect(Object.keys(toPublicQuestion(question)).sort()).toEqual(["id", "options", "prompt"]);
      }
    }
    expect(changed).toBeGreaterThan(300);
    expect(JSON.stringify(QUESTION_BANK)).toBe(before);
    expect(mixGameQuestions("one", "daily")).not.toEqual(mixGameQuestions("two", "daily"));
  });

  it("fails explicitly if content no longer supports the published rules", () => {
    for (const mode of ["daily", "tournament"] as Exclude<GameMode, "arcade">[]) {
      expect(() => mixGameQuestions("missing-core", mode, QUESTION_BANK.filter((question) => question.category !== "celo-gooddollar"))).toThrow(/cannot satisfy/);
      expect(() => mixGameQuestions("missing-hard", mode, QUESTION_BANK.filter((question) => question.difficulty !== "hard"))).toThrow(/cannot satisfy/);
    }
  });
});
