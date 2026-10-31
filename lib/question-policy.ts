import type { GameMode } from "./game-types";
import type { QuestionDifficulty } from "./question-types";

export const QUESTION_MIX_VERSION = "balanced-v1";
export const MIXED_DAILY_FROM = "2026-10-31";
export const QUESTION_MIX: Record<Exclude<GameMode, "arcade">, {
  difficulties: readonly QuestionDifficulty[];
  goodDollarCount: number;
  maxPerCategory: number;
  minCategories: number;
  description: string;
}> = {
  daily: {
    difficulties: ["easy", "easy", "medium", "medium", "hard"],
    goodDollarCount: 1, maxPerCategory: 1, minCategories: 5,
    description: "2 easy, 2 medium and 1 hard question across five topics, including one Celo or GoodDollar question.",
  },
  tournament: {
    difficulties: ["easy", "easy", "easy", "medium", "medium", "medium", "medium", "hard", "hard", "hard"],
    goodDollarCount: 2, maxPerCategory: 2, minCategories: 7,
    description: "3 easy, 4 medium and 3 hard questions across at least seven topics, including two Celo or GoodDollar questions.",
  },
};

export function questionMixDescription(mode: Exclude<GameMode, "arcade">, day: string) {
  return mode === "daily" && day < MIXED_DAILY_FROM
    ? "Everyone gets the same daily questions."
    : `${QUESTION_MIX[mode].description} Questions progress from easy to hard.`;
}
