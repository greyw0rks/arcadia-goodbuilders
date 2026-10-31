import { createClient } from "@libsql/client";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { QUESTION_BANK } from "../lib/questions";
import { questionCalibration, type CalibrationAttempt } from "../lib/question-calibration";

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--output")) throw new Error("Usage: question-stats.ts [--output report.json]");
  const url = process.env.ARCADIA_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("Load your database environment before running question statistics.");
  const client = createClient({ url, authToken: process.env.ARCADIA_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN, intMode: "number" });
  try {
    const tx = await client.transaction("read");
    let rows, total;
    try {
      total = Number((await tx.execute("SELECT COUNT(*) AS count FROM game_attempts")).rows[0].count);
      rows = (await tx.execute("SELECT owner_id, mode, practice, created_at, questions, answers FROM game_attempts ORDER BY created_at ASC, id ASC LIMIT 10000")).rows;
      await tx.commit();
    } finally { tx.close(); }
    const attempts = rows.map((row): CalibrationAttempt => ({ ownerId: String(row.owner_id), mode: row.mode as CalibrationAttempt["mode"], practice: Boolean(row.practice),
      createdAt: Number(row.created_at), questions: JSON.parse(String(row.questions)), answers: JSON.parse(String(row.answers)) }));
    const report = { checkedAt: new Date().toISOString(), attemptsRead: rows.length, totalAttempts: total, truncated: total > rows.length,
      ...questionCalibration(attempts, QUESTION_BANK) };
    const output = args[1] ?? "docs/evidence/question-calibration.json";
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, attemptsRead: report.attemptsRead, truncated: report.truncated, questionsWithEnoughData: report.questionsWithEnoughData,
      message: report.questionsWithEnoughData ? "Review the flagged questions; no content changed." : "Not enough real play data to calibrate difficulty yet." }));
  } finally { client.close(); }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Question statistics failed."); process.exitCode = 1; });
