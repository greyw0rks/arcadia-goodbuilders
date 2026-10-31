import { describe, expect, it } from "vitest";
import { questionCalibration, type CalibrationAttempt } from "../lib/question-calibration";
import { QUESTION_BANK } from "../lib/questions";
const question = QUESTION_BANK.find((question) => question.difficulty === "hard")!;
const attempt = (ownerId: string, correct = true, extra: Partial<CalibrationAttempt> = {}): CalibrationAttempt => ({
  ownerId, mode: "daily", practice: false, createdAt: 1, questions: [{ ...question, timeLimitSeconds: 10 }],
  answers: [{ correct, answerIndex: correct ? question.answerIndex : -1, receivedAt: 5_001, responseMs: 5_000 }], ...extra,
});
describe("editorial calibration report", () => {
  it("collects first exposures for standalone trivia without mixing in classic practice", () => {
    const triviaQuestion = QUESTION_BANK.find(q => q.game === "maths" && q.difficulty === "extreme")!;
    const first = attempt("arcade-player", true, { mode: "arcade", practice: true, questions: [{ ...triviaQuestion, timeLimitSeconds: 10 }] });
    const report = questionCalibration([first, { ...first, createdAt: 2 }, attempt("daily-practice", true, { practice: true })], [question, triviaQuestion]);
    expect(report.questions.find(q => q.id === triviaQuestion.id && q.mode === "arcade")).toMatchObject({ mode: "arcade", samples: 1, status: "collecting" });
    expect(report).toMatchObject({ repeatsSkipped: 1, practiceSkipped: 1 });
    expect(report.questions.find(q => q.id === triviaQuestion.id && q.mode === "tournament")?.samples).toBe(0);
  });
  it("excludes legacy timing and never treats an old viewer as a first exposure", () => {
    const report = questionCalibration([attempt("old-viewer", true, { questions: [question] }), attempt("old-viewer", true, { createdAt: 2 }), attempt("new-viewer")], [question]);
    expect(report).toMatchObject({ secondsPerQuestion: 10, legacyTimingSkipped: 1, repeatsSkipped: 1 });
    expect(report.questions[0].samples).toBe(1);
  });
  it("counts first exposures, separates modes and keeps owner identities out of reports", () => {
    const report = questionCalibration([attempt("private-owner"), attempt("private-owner", false, { createdAt: 2 }), attempt("private-owner", false, { mode: "tournament" }), attempt("practice-owner", true, { practice: true })], [question]);
    expect(report.questions[0]).toMatchObject({ samples: 1, accuracy: 1, status: "collecting" });
    expect(report.questions[1]).toMatchObject({ samples: 1, accuracy: 0, timeoutRate: 1 });
    expect(report).toMatchObject({ repeatsSkipped: 1, practiceSkipped: 1, questionsWithEnoughData: 0 });
    expect(JSON.stringify(report)).not.toContain("private-owner");
  });
  it("does not invent historical timing or mix question revisions", () => {
    const report = questionCalibration([
      attempt("old", true, { questions: [{ ...question, revision: 0 }] }),
      attempt("missing-timing", true, { answers: [{ correct: true, answerIndex: question.answerIndex, receivedAt: 123 }] }),
    ], [question]);
    expect(report.oldRevisionsSkipped).toBe(1);
    expect(report.questions[0]).toMatchObject({ samples: 1, timingSamples: 0, medianResponseMs: null, status: "collecting" });
  });
  it("flags an easy hard-question only after the minimum independent owner sample", () => {
    const rows = Array.from({ length: 30 }, (_, index) => attempt(`owner-${index}`));
    expect(questionCalibration(rows.slice(0, 29), [question]).questions[0].status).toBe("collecting");
    expect(questionCalibration(rows, [question]).questions[0]).toMatchObject({ samples: 30, status: "review-too-easy", medianResponseMs: 5_000 });
  });
});
