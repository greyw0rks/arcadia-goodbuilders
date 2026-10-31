import { mkdir, writeFile } from "node:fs/promises";
import { QUESTION_BANK } from "../lib/questions";
import { QUESTION_CATEGORIES, QUESTION_DIFFICULTIES } from "../lib/question-types";
import { TRIVIA_GAMES } from "../lib/trivia-catalog";

const labels = ["A", "B", "C", "D"];
const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
const lines = [
  "# Arcadia MVP question bank",
  "",
  `${QUESTION_BANK.length} questions. Four choices and one correct answer per question.`,
  "",
  "This is a private editorial answer key, excluded from Vercel uploads. Do not put it in public assets or send it to clients before answers are committed.",
  "",
  "Difficulty labels are editorial starting points, not measured player performance. Each category game has 500 questions: 125 easy, 125 medium, 125 hard and 125 extremely hard. A ten-question round uses one selected tier or a 3/3/2/2 mixed progression. The separate classic bank supplies daily games (2/2/1) and tournaments (3/4/3). All games shuffle answer positions before storing their snapshots.",
  "",
  "Regenerate this file and the CSV with `pnpm questions:export`. See [question-bank-notes.md](question-bank-notes.md) for sources, maintenance and rollout details.",
  "",
  "| Game | Questions |",
  "| --- | ---: |",
  "| Classic daily / tournament | 150 |",
  ...TRIVIA_GAMES.map(game => `| ${game.title} | ${QUESTION_BANK.filter(question => question.game === game.id).length} |`),
  "",
  "| Category | Questions |",
  "| --- | ---: |",
  ...QUESTION_CATEGORIES.map((category) => `| ${category} | ${QUESTION_BANK.filter((question) => question.category === category).length} |`),
  "",
];
const csv = [["id", "revision", "game", "difficulty", "category", "question", "A", "B", "C", "D", "correct_option", "correct_answer", "explanation", "source"].map(csvCell).join(",")];
for (const difficulty of QUESTION_DIFFICULTIES) {
  const questions = QUESTION_BANK.filter((question) => question.difficulty === difficulty);
  lines.push(`## ${difficulty[0].toUpperCase()}${difficulty.slice(1)} — ${questions.length} questions`, "");
  for (const question of questions) {
    lines.push(`### ${question.id}`, "", `Game: ${question.game ?? "classic"} · Category: ${question.category} · Revision: ${question.revision ?? 1}`, "", question.prompt, "");
    question.options.forEach((option, index) => lines.push(`- **${labels[index]}.** ${option}`));
    lines.push("", `**Answer: ${labels[question.answerIndex]} — ${question.options[question.answerIndex]}**`, "", question.explanation, "", `Source: ${question.source ?? "Arcadia classic editorial bank; see question-bank-notes.md"}`, "");
    csv.push([question.id, String(question.revision ?? 1), question.game ?? "classic", question.difficulty, question.category, question.prompt, ...question.options, labels[question.answerIndex], question.options[question.answerIndex], question.explanation, question.source ?? "Arcadia classic editorial bank"].map(csvCell).join(","));
  }
}
async function writeExports() {
  await mkdir("docs", { recursive: true });
  await Promise.all([
    writeFile("docs/question-bank.md", lines.join("\n") + "\n"),
    writeFile("docs/question-bank.csv", csv.join("\r\n") + "\r\n"),
  ]);
  console.log(`Exported ${QUESTION_BANK.length} questions to docs/question-bank.md and docs/question-bank.csv.`);
}
void writeExports().catch((error) => { console.error(error); process.exitCode = 1; });
