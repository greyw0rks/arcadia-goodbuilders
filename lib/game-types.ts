import type { PublicQuestion } from "./questions";
import type { QuestionDifficulty, TriviaSelection } from "./question-types";
import type { TournamentRoundPolicy } from "./game-rules";
export type GameMode = "daily" | "tournament" | "arcade";
export interface GameResult { correct: number; total: number; baseXp: number; multiplier: number; xpEarned: number; creditedXp: number }
export interface GameView {
  id: string; mode: GameMode; sequence: number; phase: "playing" | "feedback" | "ready" | "complete" | "expired";
  questionIndex: number; total: number; question: PublicQuestion | null;
  deadline: number | null; serverNow: number; secondsPerQuestion: number; multiplier: number; practice: boolean;
  feedback: { correct: boolean; correctIndex: number; explanation: string; answerIndex: number } | null;
  result: GameResult | null;
  trivia: TriviaSelection | null; difficulty: QuestionDifficulty | null;
  tournamentRound: TournamentRoundPolicy | null;
}
export interface TournamentDay {
  day: string; genre: TriviaSelection["game"] | null; completedGames: number;
  genreGamesRemaining: number; normalGamesPlayed: number; resetsAt: number;
  nextKind: "genre" | "mixed"; nextMultiplier: number; nextMaxXp: number;
}
export interface Standing { rank: number; address: string; xp: number; correct: number; completedGames: number; isYou: boolean }
export interface CompetitionView {
  id: string; title: string; startsAt: number; endsAt: number; status: "upcoming" | "open" | "closed";
  rulesVersion: string; participantCount: number; collectiveXp: number;
  entry: { completedGames: number; xp: number; nextMultiplier: number; rank: number | null; daily: TournamentDay; requiresTransaction?: boolean } | null;
  standings: Standing[];
}
