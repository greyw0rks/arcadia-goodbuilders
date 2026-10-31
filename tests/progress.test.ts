import { describe, expect, it } from "vitest";
import { applyDailyResult, EMPTY_PROGRESS } from "../lib/progress";

describe("daily progress", () => {
  it("credits XP once and starts a streak", () => {
    const applied = applyDailyResult(EMPTY_PROGRESS, {
      challengeId: "2026-10-30",
      correct: 4,
      total: 5,
      xpEarned: 90,
    });

    expect(applied.creditedXp).toBe(90);
    expect(applied.progress.xp).toBe(90);
    expect(applied.progress.streak).toBe(1);
  });

  it("does not credit the same daily challenge twice", () => {
    const first = applyDailyResult(EMPTY_PROGRESS, {
      challengeId: "2026-10-30",
      correct: 4,
      total: 5,
      xpEarned: 90,
    });
    const replay = applyDailyResult(first.progress, {
      challengeId: "2026-10-30",
      correct: 5,
      total: 5,
      xpEarned: 100,
    });

    expect(replay.creditedXp).toBe(0);
    expect(replay.progress.xp).toBe(90);
    expect(replay.progress.streak).toBe(1);
  });

  it("extends the streak on the next UTC day", () => {
    const first = applyDailyResult(EMPTY_PROGRESS, {
      challengeId: "2026-10-29",
      correct: 3,
      total: 5,
      xpEarned: 80,
    });
    const second = applyDailyResult(first.progress, {
      challengeId: "2026-10-30",
      correct: 4,
      total: 5,
      xpEarned: 90,
    });

    expect(second.progress.streak).toBe(2);
    expect(second.progress.xp).toBe(170);
  });
});
