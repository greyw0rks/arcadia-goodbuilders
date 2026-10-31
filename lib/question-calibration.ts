import type { QuestionDefinition, QuestionDifficulty } from "./question-types";
import type { GameMode } from "./game-types";
import { SECONDS_PER_QUESTION } from "./game-rules";

export interface CalibrationAttempt {
  ownerId: string; mode: GameMode; practice: boolean; createdAt: number;
  questions: readonly (QuestionDefinition & { timeLimitSeconds?: number })[];
  answers: readonly { correct: boolean; answerIndex: number; receivedAt: number; responseMs?: number }[];
}
export const MIN_CALIBRATION_SAMPLES = 30;
const targetAccuracy: Record<QuestionDifficulty, readonly [number, number]> = {
  easy: [0.65, 0.95], medium: [0.4, 0.8], hard: [0.2, 0.65], extreme: [0.15, 0.45],
};

export function questionCalibration(attempts: readonly CalibrationAttempt[], bank: readonly QuestionDefinition[]) {
  const current = new Map(bank.map((question) => [question.id, question]));
  const samples = new Map<string, { correct: boolean; timeout: boolean; responseMs?: number }[]>();
  const seen = new Set<string>();
  let practiceSkipped = 0, repeatsSkipped = 0, oldRevisionsSkipped = 0, legacyTimingSkipped = 0;
  for (const attempt of [...attempts].sort((a, b) => a.createdAt - b.createdAt)) {
    if (attempt.practice && attempt.mode !== "arcade") { practiceSkipped++; continue; }
    for (let index = 0; index < attempt.answers.length; index++) {
      const question = attempt.questions[index], answer = attempt.answers[index];
      const live = question && current.get(question.id);
      if (!live || (live.revision ?? 1) !== (question.revision ?? 1)) { oldRevisionsSkipped++; continue; }
      const key = `${attempt.mode}:${question.id}`;
      const exposure = JSON.stringify([attempt.ownerId, key]);
      if (seen.has(exposure)) { repeatsSkipped++; continue; }
      seen.add(exposure);
      if ((question.timeLimitSeconds ?? 20) !== SECONDS_PER_QUESTION) { legacyTimingSkipped++; continue; }
      const bucket = samples.get(key) ?? [];
      bucket.push({ correct: answer.correct, timeout: answer.answerIndex === -1,
        responseMs: typeof answer.responseMs === "number" && Number.isFinite(answer.responseMs) && answer.responseMs >= 0 && answer.responseMs <= SECONDS_PER_QUESTION * 1000 ? answer.responseMs : undefined });
      samples.set(key, bucket);
    }
  }
  const questions = (["daily", "tournament", "arcade"] as const).flatMap((mode) => bank.filter(question => mode === "tournament" || (mode === "arcade" ? !!question.game : !question.game)).map((question) => {
    const bucket = samples.get(`${mode}:${question.id}`) ?? [];
    const count = bucket.length;
    const accuracy = count ? bucket.filter((sample) => sample.correct).length / count : null;
    const timeoutRate = count ? bucket.filter((sample) => sample.timeout).length / count : null;
    const timings = bucket.flatMap((sample) => sample.responseMs === undefined ? [] : [sample.responseMs]).sort((a, b) => a - b);
    const middle = Math.floor(timings.length / 2);
    const medianResponseMs = timings.length ? timings.length % 2 ? timings[middle] : (timings[middle - 1] + timings[middle]) / 2 : null;
    const target = targetAccuracy[question.difficulty];
    const status = count < MIN_CALIBRATION_SAMPLES ? "collecting"
      : timeoutRate! > 0.25 ? "review-time-limit"
      : accuracy! < target[0] ? "review-too-hard"
      : accuracy! > target[1] ? "review-too-easy" : "within-target";
    return { id: question.id, revision: question.revision ?? 1, mode, category: question.category, difficulty: question.difficulty,
      samples: count, accuracy, timeoutRate, timingSamples: timings.length, medianResponseMs, status };
  }));
  return { minimumSamples: MIN_CALIBRATION_SAMPLES, secondsPerQuestion: SECONDS_PER_QUESTION, practiceSkipped, repeatsSkipped, oldRevisionsSkipped, legacyTimingSkipped,
    questionsWithEnoughData: questions.filter((question) => question.samples >= MIN_CALIBRATION_SAMPLES).length,
    note: "First exposure per account/browser owner, question revision and mode, using the current time limit. Legacy timing is excluded; repeat viewers remain excluded. Owners are not proven unique people. Server response times include network latency. Review flags are provisional; this report never changes difficulty automatically.", questions };
}
