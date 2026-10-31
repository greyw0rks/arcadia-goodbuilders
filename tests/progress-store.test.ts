import { afterEach, describe, expect, it } from "vitest";
import { ProgressStore } from "../lib/progress-store";

const stores: ProgressStore[] = [];

function memoryStore(): ProgressStore {
  const store = new ProgressStore({ url: "file::memory:" });
  stores.push(store);
  return store;
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});

describe("server progress store", () => {
  it("persists XP and extends a streak across daily results", async () => {
    const store = memoryStore();
    const first = await store.applyDailyResult("player-1", {
      challengeId: "2026-10-29",
      correct: 3,
      total: 5,
      xpEarned: 80,
    });
    const second = await store.applyDailyResult("player-1", {
      challengeId: "2026-10-30",
      correct: 4,
      total: 5,
      xpEarned: 90,
    });

    expect(first.creditedXp).toBe(80);
    expect(second.progress.xp).toBe(170);
    expect(second.progress.streak).toBe(2);
    expect((await store.get("player-1")).daily?.challengeId).toBe("2026-10-30");
  });

  it("credits one challenge only once even when the result is replayed", async () => {
    const store = memoryStore();
    await store.applyDailyResult("player-2", {
      challengeId: "2026-10-30",
      correct: 4,
      total: 5,
      xpEarned: 90,
    });
    const replay = await store.applyDailyResult("player-2", {
      challengeId: "2026-10-30",
      correct: 5,
      total: 5,
      xpEarned: 100,
    });

    expect(replay.creditedXp).toBe(0);
    expect(replay.progress.xp).toBe(90);
    expect(replay.progress.daily?.correct).toBe(4);
  });
});
