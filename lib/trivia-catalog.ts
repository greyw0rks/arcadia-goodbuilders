import type { QuestionDifficulty, TriviaGame, TriviaSelection } from "./question-types";
export const TRIVIA_GAMES: { id: TriviaGame; title: string; description: string; count: number; mark: string }[] = [
  { id: "general", title: "General Trivia", description: "Places, science, books and sport.", count: 500, mark: "01" },
  { id: "maths", title: "Maths Trivia", description: "Numbers, algebra, calculus and beyond.", count: 500, mark: "02" },
  { id: "crypto", title: "Crypto Trivia", description: "Wallets, chains, Celo and GoodDollar.", count: 500, mark: "03" },
  { id: "movies", title: "Movie Trivia", description: "Directors, scores and film craft.", count: 500, mark: "04" },
];
export const DIFFICULTY_LABELS: Record<QuestionDifficulty | "mixed", string> = { mixed: "Mixed difficulty", easy: "Easy", medium: "Medium", hard: "Hard", extreme: "Extremely hard" };
export const TRIVIA_MIX: readonly QuestionDifficulty[] = ["easy", "easy", "easy", "medium", "medium", "medium", "hard", "hard", "extreme", "extreme"];
export function isTriviaSelection(value: unknown): value is TriviaSelection {
  if (!value || typeof value !== "object") return false;
  const selection = value as Partial<TriviaSelection>;
  return TRIVIA_GAMES.some(game => game.id === selection.game) && typeof selection.difficulty === "string" && Object.hasOwn(DIFFICULTY_LABELS, selection.difficulty);
}
export function triviaDescription(selection: TriviaSelection) {
  return selection.difficulty === "mixed" ? "3 easy, 3 medium, 2 hard and 2 extremely hard questions. The challenge builds as you go." : `10 ${DIFFICULTY_LABELS[selection.difficulty].toLowerCase()} questions from this game's 125-question difficulty bank.`;
}
