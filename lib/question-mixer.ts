import { createHash } from "node:crypto";
import { CLASSIC_QUESTION_BANK } from "./question-bank";
import { QUESTION_MIX, QUESTION_MIX_VERSION } from "./question-policy";
import type { GameMode } from "./game-types";
import type { QuestionDefinition } from "./question-types";

export type MixedQuestion = QuestionDefinition & { selectionVersion: string };
const coreCategory = "celo-gooddollar";
function rank(seed: string, value: string) {
  return createHash("sha256").update(JSON.stringify([QUESTION_MIX_VERSION, seed, value])).digest("hex");
}

export function mixGameQuestions(seed: string, mode: Exclude<GameMode, "arcade">, bank: readonly QuestionDefinition[] = CLASSIC_QUESTION_BANK): readonly MixedQuestion[] {
  const policy = QUESTION_MIX[mode];
  // Reserve ecosystem slots first; their difficulty varies with the seed.
  const coreSlots = new Set(policy.difficulties.map((_, index) => ({ index, rank: rank(seed, `core:${index}`) }))
    .toSorted((left, right) => left.rank.localeCompare(right.rank)).slice(0, policy.goodDollarCount).map(({ index }) => index));
  const slots = policy.difficulties.map((difficulty, index) => ({ difficulty, index, core: coreSlots.has(index) }))
    .toSorted((left, right) => Number(right.core) - Number(left.core) || left.index - right.index);
  const used = new Set<string>();
  const categoryCounts = new Map<string, number>();
  const result = new Array<MixedQuestion>(slots.length);
  for (const slot of slots) {
    const candidates = bank.filter((question) => question.difficulty === slot.difficulty
      && (question.category === coreCategory) === slot.core
      && !used.has(question.id)
      && (categoryCounts.get(question.category) ?? 0) < policy.maxPerCategory)
      .map((question) => ({ question, rank: rank(seed, `question:${slot.index}:${question.id}`) }))
      .toSorted((left, right) => (categoryCounts.get(left.question.category) ?? 0) - (categoryCounts.get(right.question.category) ?? 0)
        || left.rank.localeCompare(right.rank) || left.question.id.localeCompare(right.question.id));
    const question = candidates[0]?.question;
    if (!question) throw new Error(`Question bank cannot satisfy ${mode} mixing rules at slot ${slot.index + 1}.`);
    used.add(question.id);
    categoryCounts.set(question.category, (categoryCounts.get(question.category) ?? 0) + 1);
    const options = question.options.map((text, index) => ({ text, index, rank: rank(seed, `option:${question.id}:${index}`) }))
      .toSorted((left, right) => left.rank.localeCompare(right.rank) || left.index - right.index);
    result[slot.index] = {
      ...question, selectionVersion: QUESTION_MIX_VERSION,
      options: options.map(({ text }) => text) as unknown as QuestionDefinition["options"],
      answerIndex: options.findIndex(({ index }) => index === question.answerIndex),
    };
  }
  if (categoryCounts.size < policy.minCategories) throw new Error(`Question bank cannot satisfy ${mode} topic diversity.`);
  return result;
}
