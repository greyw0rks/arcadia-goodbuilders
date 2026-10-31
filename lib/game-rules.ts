import type { TriviaGame } from "./question-types";
export const TOURNAMENT_RULES_VERSION = "daily-genre-v3";
export const SECONDS_PER_QUESTION = 10;
export const CORRECT_XP = 10;
export const COMPLETION_XP = 50;
export const DAILY_GENRE_GAMES = 4;
export const NORMAL_MULTIPLIERS = [75, 50, 25, 10, 10] as const;
export interface TournamentRoundPolicy {
  rulesVersion: string; day: string; daySequence: number; genre: TriviaGame | null;
  kind: "genre" | "mixed"; multiplier: number; xpCap: number | null;
}
export function dailyTournamentRate(completedGames: number) {
  if (!Number.isSafeInteger(completedGames) || completedGames < 0) throw new Error("Invalid completed game count");
  const normalIndex = completedGames - DAILY_GENRE_GAMES;
  return {
    kind: normalIndex < 0 ? "genre" as const : "mixed" as const,
    multiplier: normalIndex < 0 ? 100 : NORMAL_MULTIPLIERS[normalIndex] ?? 10,
    xpCap: normalIndex >= NORMAL_MULTIPLIERS.length ? 5 : null,
  };
}
export function tournamentGameXp(correct: number, total: number, policy: Pick<TournamentRoundPolicy, "multiplier" | "xpCap">) {
  const { baseXp } = gameXp(correct, total);
  return { baseXp, multiplier: policy.multiplier, xpEarned: Math.min(policy.xpCap ?? Infinity, Math.floor(baseXp * policy.multiplier / 100)) };
}
// Retained for attempts created before daily genre rules were introduced.
export function gameMultiplier(completedGames: number): number {
  if (!Number.isSafeInteger(completedGames) || completedGames < 0) throw new Error("Invalid completed game count");
  return completedGames < 4 ? 100 : completedGames === 4 ? 75 : completedGames === 5 ? 50 : completedGames === 6 ? 25 : 10;
}
export function gameXp(correct: number, total: number, completedGames = 0) {
  if (!Number.isInteger(correct) || correct < 0 || correct > total) throw new Error("Invalid score");
  const baseXp = COMPLETION_XP + correct * CORRECT_XP;
  const multiplier = gameMultiplier(completedGames);
  return { baseXp, multiplier, xpEarned: Math.floor(baseXp * multiplier / 100) };
}
