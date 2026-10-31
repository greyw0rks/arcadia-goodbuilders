import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgressStore } from "../lib/progress-store";
import { GameStore } from "../lib/game-store";
import { gameMultiplier, gameXp } from "../lib/game-rules";
import type { GameView } from "../lib/game-types";
import { QUESTION_BANK } from "../lib/questions";
const now = Date.parse("2026-10-30T12:00:00Z");
const stores: ProgressStore[] = [];
function setup() { const db = new ProgressStore({ url: "file::memory:" }); stores.push(db); return { db, games: new GameStore(db) }; }
afterEach(() => { for (const store of stores.splice(0)) store.close(); });
async function play(games: GameStore, owner: string, root: string | null, game: GameView, timestamp = now) {
  const row = (await games.db.execute({ sql: "SELECT questions FROM game_attempts WHERE id = ?", args: [game.id] })).rows[0];
  const questions = JSON.parse(String(row.questions)) as { answerIndex: number }[];
  for (let index = 0; index < questions.length; index++) {
    await games.act(owner, root, game.id, "answer", index, questions[index].answerIndex, timestamp);
    await games.act(owner, root, game.id, "next", index, undefined, timestamp);
  }
  return games.act(owner, root, game.id, "finish", undefined, undefined, timestamp);
}
describe("server-owned games", () => {
  it("retains the 20-second timing of attempts created before the timing change", async () => {
    const { db, games } = setup();
    const game = await games.start("player", "daily", null, false, now);
    const row = (await db.execute({ sql: "SELECT questions FROM game_attempts WHERE id = ?", args: [game.id] })).rows[0];
    const legacy = JSON.parse(String(row.questions)).map(({ timeLimitSeconds: _time, ...question }: Record<string, unknown>) => question);
    await db.execute({ sql: "UPDATE game_attempts SET questions = ?, deadline = ? WHERE id = ?", args: [JSON.stringify(legacy), now + 20_000, game.id] });
    const resumed = await games.start("player", "daily", null, false, now + 12_000);
    expect(resumed.secondsPerQuestion).toBe(20);
    const answer = await games.act("player", null, game.id, "answer", 0, legacy[0].answerIndex, now + 15_000);
    expect(answer.feedback?.correct).toBe(true);
    const next = await games.act("player", null, game.id, "next", 0, undefined, now + 16_000);
    expect(next.deadline).toBe(now + 36_000);
  });
  it("persists shuffled questions, grades their stored answers, and measures response time without feedback dwell time", async () => {
    const { db, games } = setup();
    const day = Date.parse("2026-10-31T12:00:00Z");
    const first = await games.start("player-a", "daily", null, false, day);
    const other = await games.start("player-b", "daily", null, false, day);
    const stored = async (id: string) => (await db.execute({ sql: "SELECT questions, answers FROM game_attempts WHERE id = ?", args: [id] })).rows[0];
    const initial = await stored(first.id);
    expect((await stored(other.id)).questions).toBe(initial.questions);
    const list = JSON.parse(String(initial.questions));
    expect(list.map((q: { difficulty: string }) => q.difficulty)).toEqual(["easy", "easy", "medium", "medium", "hard"]);
    const original = QUESTION_BANK.find((question) => question.id === list[0].id)!;
    expect(list[0].options[list[0].answerIndex]).toBe(original.options[original.answerIndex]);
    const answered = await games.act("player-a", null, first.id, "answer", 0, list[0].answerIndex, day + 3_000);
    expect(answered.feedback?.correct).toBe(true);
    await games.act("player-a", null, first.id, "next", 0, undefined, day + 12_000);
    await games.act("player-a", null, first.id, "answer", 1, list[1].answerIndex, day + 14_000);
    expect(JSON.parse(String((await stored(first.id)).answers)).map((a: { responseMs: number }) => a.responseMs)).toEqual([3_000, 2_000]);
    expect((await games.start("player-a", "daily", null, false, day + 15_000)).id).toBe(first.id);
    expect((await stored(first.id)).questions).toBe(initial.questions);
  });
  it("locks the first answer, rejects another player and denies incomplete completion", async () => {
    const { games } = setup();
    const game = await games.start("player", "daily", null, false, now);
    expect(game.total).toBe(5);
    expect(game.question).not.toHaveProperty("answerIndex");
    expect(game).not.toHaveProperty("questions");
    await expect(games.act("other", null, game.id, "answer", 0, 0, now)).rejects.toMatchObject({ status: 403 });
    await expect(games.act("player", null, game.id, "finish", undefined, undefined, now)).rejects.toMatchObject({ status: 409 });
    const first = await games.act("player", null, game.id, "answer", 0, 0, now);
    const changed = await games.act("player", null, game.id, "answer", 0, 1, now);
    expect(changed.feedback).toEqual(first.feedback);
    const next = await games.act("player", null, game.id, "next", 0, undefined, now);
    const retry = await games.act("player", null, game.id, "next", 0, undefined, now);
    expect(retry.questionIndex).toBe(next.questionIndex);
  });
  it("uses the server deadline and resumes the same game", async () => {
    const { games } = setup();
    const game = await games.start("player", "daily", null, false, now);
    const resume = await games.start("player", "daily", null, false, now + 25_000);
    expect(resume.id).toBe(game.id);
    expect(resume.deadline).toBe(now + 10_000);
    const result = await games.act("player", null, game.id, "answer", 0, 0, now + 10_000);
    expect(result.feedback).toMatchObject({ correct: false, answerIndex: -1 });
  });
  it("credits daily XP once and never awards practice XP", async () => {
    const { games, db } = setup();
    const result = await play(games, "player", null, await games.start("player", "daily", null, false, now));
    expect(result.result).toMatchObject({ correct: 5, xpEarned: 100, creditedXp: 100 });
    expect((await games.act("player", null, result.id, "finish", undefined, undefined, now)).result?.creditedXp).toBe(0);
    const practice = await games.start("player", "daily", null, true, now);
    expect(practice.practice).toBe(true);
    expect((await play(games, "player", null, practice)).result?.creditedXp).toBe(0);
    expect((await db.get("player")).xp).toBe(100);
  });
});
describe("expired games", () => {
  it("reads the final state without allowing late answers, completion or disclosure to another player", async () => {
    const { games, db } = setup();
    const game = await games.start("player", "daily", null, false, now);
    const closed = Date.parse("2026-10-31T00:00:00Z");
    const expired = await games.act("player", null, game.id, "read", undefined, undefined, closed);
    expect(expired).toMatchObject({ phase: "expired", question: null, feedback: null, result: null });
    await expect(games.act("other", null, game.id, "read", undefined, undefined, closed)).rejects.toMatchObject({ status: 403 });
    await expect(games.act("player", null, game.id, "answer", 0, 0, closed)).rejects.toMatchObject({ status: 409 });
    await expect(games.act("player", null, game.id, "finish", undefined, undefined, closed)).rejects.toMatchObject({ status: 409 });
    expect((await db.get("player")).xp).toBe(0);
    const nextDay = await games.start("player", "daily", null, false, closed);
    expect(nextDay.id).not.toBe(game.id);
    expect(nextDay.phase).toBe("playing");
  });
});
describe("per-player tournament scoring", () => {
  it("authorizes only the verified player's stored run without RPC calls between answers", async () => {
    const { games, db } = setup();
    await games.enroll("root-a", now);
    const game = await games.start("player-a", "tournament", "root-a", false, now, { game: "general", difficulty: "mixed" });
    const outage = vi.fn(async (): Promise<string> => { throw new Error("Celo RPC unavailable"); });
    expect(await games.actionRoot("player-a", game.id, outage)).toBe("root-a");
    const finished = await play(games, "player-a", await games.actionRoot("player-a", game.id, outage), game);
    expect(finished.result?.creditedXp).toBe(150);
    expect(outage).not.toHaveBeenCalled();
    await expect(games.actionRoot("stranger", game.id, async () => "root-b")).rejects.toMatchObject({ status: 403 });
    await expect(games.actionRoot("stranger", game.id, outage)).rejects.toThrow("Celo RPC unavailable");
    expect((await db.execute({ sql: "SELECT * FROM game_attempt_access WHERE player_id = ?", args: ["stranger"] })).rows).toHaveLength(0);
    // A separately signed-in linked wallet proves the relationship once.
    const verify = vi.fn(async () => "root-a");
    expect(await games.actionRoot("linked-player", game.id, verify)).toBe("root-a");
    expect(await games.actionRoot("linked-player", game.id, outage)).toBe("root-a");
    expect(verify).toHaveBeenCalledTimes(1);
    const next = await games.start("player-a", "tournament", "root-a", false, now, { game: "general", difficulty: "mixed" });
    await expect(games.actionRoot("linked-player", next.id, outage)).rejects.toThrow("Celo RPC unavailable");
  });
  it("applies all eight tiers to exactly ten questions without reducing previous XP", async () => {
    const { games } = setup();
    await games.enroll("verified-root", now);
    const expected = [150, 150, 150, 150, 112, 75, 37, 15, 15];
    let total = 0;
    for (let index = 0; index < expected.length; index++) {
      const game = await games.start("wallet-a", "tournament", "verified-root", false, now + index, { game: "general", difficulty: "mixed" });
      expect(game.sequence).toBe(index + 1); expect(game.total).toBe(10);
      expect(game.multiplier).toBe(gameMultiplier(index));
      const complete = await play(games, "wallet-a", "verified-root", game, now + index);
      expect(complete.result?.creditedXp).toBe(expected[index]);
      total += expected[index];
      expect((await games.competition("verified-root", now)).entry?.xp).toBe(total);
    }
    expect(gameXp(9, 10, 4)).toEqual({ baseXp: 140, multiplier: 75, xpEarned: 105 });
  });
  it("gives late entrants four full games and preserves counts across linked wallets/re-enrollment", async () => {
    const { games } = setup();
    await games.enroll("root-a", now);
    for (let i = 0; i < 4; i++) await play(games, "wallet-a", "root-a", await games.start("wallet-a", "tournament", "root-a", false, now, { game: "general", difficulty: "mixed" }));
    await games.enroll("root-a", now + 1000);
    expect((await games.start("another-linked-wallet", "tournament", "root-a", false, now, { game: "general", difficulty: "mixed" })).multiplier).toBe(75);
    await games.enroll("root-b", now + 1000);
    expect((await games.start("wallet-b", "tournament", "root-b", false, now + 1000, { game: "general", difficulty: "mixed" })).multiplier).toBe(100);
    expect((await games.competition("root-a", now)).entry?.completedGames).toBe(4);
  });
  it("never counts an unfinished game and denies expired or unverified tournament play", async () => {
    const { games } = setup();
    await expect(games.start("guest", "tournament", null, false, now, { game: "general", difficulty: "mixed" })).rejects.toMatchObject({ status: 403 });
    await games.enroll("root", now);
    const game = await games.start("wallet", "tournament", "root", false, now, { game: "general", difficulty: "mixed" });
    await games.act("wallet", "root", game.id, "answer", 0, 0, now);
    expect((await games.competition("root", now)).entry).toMatchObject({ xp: 0, completedGames: 0 });
    expect((await games.start("wallet", "tournament", "root", false, now, { game: "general", difficulty: "mixed" })).id).toBe(game.id);
    await expect(games.act("wallet", "root", game.id, "finish", undefined, undefined, Date.parse("2026-11-06T00:00:00Z"))).rejects.toMatchObject({ status: 409 });
    await expect(games.enroll("late", Date.parse("2026-11-06T00:00:00Z"))).rejects.toMatchObject({ status: 409 });
  });
  it("publishes only completed results with deterministic tie ordering", async () => {
    const { games } = setup();
    for (const root of ["b", "a", "unfinished"]) await games.enroll(root, now);
    await play(games, "b", "b", await games.start("b", "tournament", "b", false, now, { game: "general", difficulty: "mixed" }), now + 2);
    await play(games, "a", "a", await games.start("a", "tournament", "a", false, now, { game: "general", difficulty: "mixed" }), now + 1);
    const board = await games.competition("b", now);
    expect(board.participantCount).toBe(3); expect(board.collectiveXp).toBe(300);
    expect(board.standings.map((row) => row.address)).toEqual(["a", "b"]);
    expect(board.entry?.rank).toBe(2);
  });
});
