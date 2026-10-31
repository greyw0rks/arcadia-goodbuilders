export const QUESTION_DIFFICULTIES = ["easy", "medium", "hard", "extreme"] as const;
export type QuestionDifficulty = typeof QUESTION_DIFFICULTIES[number];
export type TriviaGame = "general" | "maths" | "crypto" | "movies";
export interface TriviaSelection { game: TriviaGame; difficulty: QuestionDifficulty | "mixed" }

export const QUESTION_CATEGORIES = [
  "geography", "science", "math-logic", "history-culture", "sports",
  "technology", "money", "wallet-safety", "celo-gooddollar",
  "arithmetic", "algebra", "geometry", "statistics", "probability", "number-theory", "series", "combinatorics", "linear-algebra", "calculus", "complex-numbers",
  "token-basics", "token-math", "consensus", "defi", "evm", "cryptography", "networking", "standards", "bitcoin",
  "film-directors", "film-history", "film-music", "film-writing", "film-camera", "film-editing", "film-production", "film-adaptations",
] as const;
export type QuestionCategory = typeof QUESTION_CATEGORIES[number];

export interface QuestionDefinition {
  id: string;
  revision?: number;
  game?: TriviaGame;
  source?: string;
  difficulty: QuestionDifficulty;
  category: QuestionCategory;
  prompt: string;
  options: readonly [string, string, string, string];
  answerIndex: number;
  explanation: string;
}

// Deliberate allowlist: answers and explanations stay on the server until a
// player commits an answer. Editorial metadata does not change game rules.
export interface PublicQuestion {
  id: string;
  prompt: string;
  options: readonly string[];
}
