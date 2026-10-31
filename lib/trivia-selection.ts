import { createHash } from "node:crypto";
import { TRIVIA_QUESTION_BANK } from "./question-bank";
import { isTriviaSelection, TRIVIA_GAMES, TRIVIA_MIX } from "./trivia-catalog";
import type { QuestionDefinition, TriviaSelection } from "./question-types";
const hash = (seed: string, value: string) => createHash("sha256").update(JSON.stringify(["trivia-v1", seed, value])).digest("hex");
export function selectTriviaQuestions(seed: string, selection: TriviaSelection, bank: readonly QuestionDefinition[] = TRIVIA_QUESTION_BANK) {
  if (!isTriviaSelection(selection)) throw new Error("Choose a valid trivia game and difficulty.");
  const difficulties = selection.difficulty === "mixed" ? TRIVIA_MIX : Array(10).fill(selection.difficulty);
  const used = new Set<string>(); const topics = new Map<string, number>();
  return difficulties.map((difficulty, index) => {
    const candidates = bank.filter(question => question.game === selection.game && question.difficulty === difficulty && !used.has(question.id))
      .map(question => ({ question, rank: hash(seed, `${index}:${question.id}`) }))
      .toSorted((a, b) => (topics.get(a.question.category) ?? 0) - (topics.get(b.question.category) ?? 0) || a.rank.localeCompare(b.rank));
    const question = candidates[0]?.question;
    if (!question) throw new Error("The trivia bank cannot provide a complete round.");
    used.add(question.id); topics.set(question.category, (topics.get(question.category) ?? 0) + 1);
    const options = question.options.map((text, position) => ({ text, position, rank: hash(seed, `${question.id}:option:${position}`) })).toSorted((a, b) => a.rank.localeCompare(b.rank));
    return { ...question, selectionVersion: "trivia-v1", options: options.map(option => option.text) as unknown as QuestionDefinition["options"], answerIndex: options.findIndex(option => option.position === question.answerIndex) };
  });
}

// All four genres appear in every normal round, with two or three questions
// each. Rotate their slots independently of the shared difficulty progression.
export function selectMixedTriviaQuestions(seed: string, bank: readonly QuestionDefinition[] = TRIVIA_QUESTION_BANK) {
  const games = TRIVIA_GAMES.map(game => game.id).toSorted((a, b) => hash(seed, a).localeCompare(hash(seed, b)));
  const used = new Set<string>();
  return TRIVIA_MIX.map((difficulty, index) => {
    const game = games[index % games.length];
    const question = bank.filter(q => q.game === game && q.difficulty === difficulty && !used.has(q.id))
      .toSorted((a, b) => hash(seed, a.id).localeCompare(hash(seed, b.id)))[0];
    if (!question) throw new Error("The trivia bank cannot provide a complete mixed round.");
    used.add(question.id);
    const options = question.options.map((text, position) => ({ text, position, rank: hash(seed, `${question.id}:option:${position}`) })).toSorted((a, b) => a.rank.localeCompare(b.rank));
    return { ...question, selectionVersion: "trivia-mixed-v1", options: options.map(option => option.text) as unknown as QuestionDefinition["options"], answerIndex: options.findIndex(option => option.position === question.answerIndex) };
  });
}
