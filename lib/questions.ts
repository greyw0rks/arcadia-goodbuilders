import { LEGACY_QUESTION_BANK, CLASSIC_QUESTION_BANK } from "./question-bank";
import type { PublicQuestion, QuestionDefinition } from "./question-types";
export { QUESTION_BANK } from "./question-bank";
export type { PublicQuestion, QuestionDefinition, QuestionDifficulty, QuestionCategory } from "./question-types";

// Daily selections are shared by date. Start the larger bank on the next UTC day
// so deploying this release does not change the current daily challenge.
export const EXPANDED_DAILY_BANK_FROM = "2026-10-31";

export function challengeKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getDailyQuestions(key: string, count = 5): readonly QuestionDefinition[] {
  if (!Number.isInteger(count) || count < 1) throw new Error("Question count must be a positive integer.");
  const bank = /^\d{4}-\d{2}-\d{2}$/.test(key) && key < EXPANDED_DAILY_BANK_FROM ? LEGACY_QUESTION_BANK : CLASSIC_QUESTION_BANK;
  if (count > bank.length) throw new Error("Not enough questions for this game.");
  return bank
    .map((question) => ({ question, rank: hashString(`${key}:${question.id}`) }))
    .toSorted((left, right) => left.rank - right.rank || left.question.id.localeCompare(right.question.id))
    .slice(0, count)
    .map(({ question }) => question);
}

export function toPublicQuestion(question: QuestionDefinition): PublicQuestion {
  return {
    id: question.id,
    prompt: question.prompt,
    options: question.options,
  };
}
