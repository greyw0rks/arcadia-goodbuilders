import { afterEach, expect, it, vi } from "vitest";
import { ProgressStore } from "../lib/progress-store";
import { GameStore } from "../lib/game-store";
import { dailyTournamentRate, tournamentGameXp } from "../lib/game-rules";
import type { GameView } from "../lib/game-types";
import { TRIVIA_MIX } from "../lib/trivia-catalog";
import { selectMixedTriviaQuestions } from "../lib/trivia-selection";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const now = Date.parse("2026-10-31T12:00:00Z"), midnight = Date.parse("2026-11-01T00:00:00Z");
const stores: ProgressStore[] = [];
const selection = { game: "maths", difficulty: "easy" } as const;
function setup() { const db = new ProgressStore({ url: "file::memory:" }); stores.push(db); return { db, games: new GameStore(db) }; }
afterEach(() => stores.splice(0).forEach(db => db.close()));
async function finish(games: GameStore, game: GameView, at = now, correct = 10, player = "wallet") {
  const rows = await games.db.execute({ sql: "SELECT questions FROM game_attempts WHERE id = ?", args: [game.id] });
  const questions = JSON.parse(String(rows.rows[0].questions));
  for (let i = 0; i < questions.length; i++) {
    await games.act(player, "root", game.id, "answer", i, i < correct ? questions[i].answerIndex : (questions[i].answerIndex + 1) % 4, at);
    await games.act(player, "root", game.id, "next", i, undefined, at);
  }
  return games.act(player, "root", game.id, "finish", undefined, undefined, at);
}

it("uses four full-XP games, five descending normal games, then a hard 5 XP ceiling", () => {
  expect(Array.from({ length: 12 }, (_, i) => tournamentGameXp(10, 10, dailyTournamentRate(i)).xpEarned)).toEqual([150, 150, 150, 150, 112, 75, 37, 15, 15, 5, 5, 5]);
  for (let correct = 0; correct <= 10; correct++) expect(tournamentGameXp(correct, 10, dailyTournamentRate(9)).xpEarned).toBeLessThanOrEqual(5);
});

it("locks a genre, ignores client difficulty, switches to all genres, and credits every score once", async () => {
  const { games, db } = setup(); await games.enroll("root", now);
  await expect(games.start("wallet", "tournament", "root", false, now)).rejects.toMatchObject({ status: 400 });
  let xp = 0;
  for (const [index, expected] of [150, 150, 150, 150, 112, 75, 37, 15, 15, 5, 5].entries()) {
    const game = await games.start("wallet", "tournament", "root", false, now, selection);
    const questions = JSON.parse(String((await db.execute({ sql: "SELECT questions FROM game_attempts WHERE id = ?", args: [game.id] })).rows[0].questions));
    expect(questions.map((q: { difficulty: string }) => q.difficulty)).toEqual(TRIVIA_MIX);
    expect(new Set(questions.map((q: { game: string }) => q.game)).size).toBe(index < 4 ? 1 : 4);
    expect(game.tournamentRound).toMatchObject({ kind: index < 4 ? "genre" : "mixed", daySequence: index + 1, genre: "maths" });
    const complete = await finish(games, game); xp += expected;
    expect(complete.result?.creditedXp).toBe(expected);
    expect(complete.tournamentRound).toEqual(game.tournamentRound);
    expect((await games.act("wallet", "root", game.id, "finish", undefined, undefined, now)).result?.creditedXp).toBe(0);
    expect((await games.competition("root", now)).entry?.xp).toBe(xp);
    if (index === 0) await expect(games.start("wallet", "tournament", "root", false, now, { game: "movies", difficulty: "mixed" })).rejects.toMatchObject({ status: 409 });
  }
  expect((await games.competition("root", now)).entry?.daily).toMatchObject({ genreGamesRemaining: 0, normalGamesPlayed: 7, nextMaxXp: 5 });
});

it("shares the choice, active attempt and daily allowance across linked wallets and re-enrollment", async () => {
  const url = `file:${join(mkdtempSync(join(tmpdir(), "arcadia-daily-concurrent-")), "game.db")}`;
  const db = new ProgressStore({ url }); stores.push(db);
  const games = new GameStore(db); await games.enroll("root", now);
  const game = await games.start("wallet", "tournament", "root", false, now, selection);
  // Independent event loops let SQLite's lock holder commit while another
  // connection waits, matching separate server instances.
  const [a, b] = await Promise.all(["linked-a", "linked-b"].map(async player => {
    const { stdout } = await promisify(execFile)(process.execPath, ["--import", "tsx", "tests/fixtures/concurrent-start.ts", url, player, String(now)]);
    return JSON.parse(stdout) as GameView;
  }));
  expect([a.id, b.id]).toEqual([game.id, game.id]);
  await finish(games, a, now, 10, "linked-a"); await games.enroll("root", now + 1);
  expect((await games.competition("root", now)).entry?.daily).toMatchObject({ completedGames: 1, genre: "maths", genreGamesRemaining: 3 });
}, 20_000);

it("resets genre and allowance at UTC midnight, keeps lifetime XP, and rejects yesterday's unfinished game", async () => {
  const { games } = setup(); await games.enroll("root", now);
  const first = await games.start("wallet", "tournament", "root", false, now, selection); await finish(games, first);
  const unfinished = await games.start("wallet", "tournament", "root", false, midnight - 1000);
  expect((await games.competition("root", midnight)).entry).toMatchObject({ xp: 150, completedGames: 1, daily: { completedGames: 0, genre: null, genreGamesRemaining: 4, nextMaxXp: 150 } });
  await expect(games.act("wallet", "root", unfinished.id, "finish", undefined, undefined, midnight)).rejects.toMatchObject({ status: 409 });
  const next = await games.start("wallet", "tournament", "root", false, midnight, { game: "movies", difficulty: "mixed" });
  expect(next.id).not.toBe(unfinished.id); expect(next.tournamentRound).toMatchObject({ genre: "movies", daySequence: 1, multiplier: 100 });
  await finish(games, next, midnight); expect((await games.competition("root", midnight)).entry?.xp).toBe(300);
});

it("preserves a legacy attempt's stored earnings and counts its completion in today's allowance", async () => {
  const { games, db } = setup(); await games.enroll("root", now);
  const game = await games.start("wallet", "tournament", "root", false, now, selection);
  await db.execute({ sql: "DELETE FROM game_tournament_rounds WHERE game_id = ?", args: [game.id] });
  await db.execute({ sql: "UPDATE game_attempts SET sequence = 8 WHERE id = ?", args: [game.id] });
  await db.execute({ sql: "UPDATE tournament_entries SET completed_games = 7, xp = 700 WHERE identity_root = 'root'", args: [] });
  const complete = await finish(games, game);
  expect(complete.result?.creditedXp).toBe(15); expect(complete.tournamentRound).toBeNull();
  expect((await games.competition("root", now)).entry).toMatchObject({ xp: 715, daily: { completedGames: 1, genreGamesRemaining: 3 } });
});

it("retains start-time identity authorization for daily and practice play during an RPC outage", async () => {
  const { games, db } = setup(); const unavailable = vi.fn(async (): Promise<string> => { throw new Error("offline"); });
  for (const mode of ["daily", "arcade"] as const) {
    unavailable.mockClear();
    const game = await games.start("wallet", mode, "root", false, now);
    expect(await games.actionRoot("wallet", game.id, unavailable)).toBeNull();
    expect(unavailable).not.toHaveBeenCalled();
    await expect(games.actionRoot("stranger", game.id, async () => "root")).rejects.toMatchObject({ status: 403 });
    await db.execute({ sql: "DELETE FROM game_attempt_access WHERE game_id = ?", args: [game.id] });
    await expect(games.actionRoot("wallet", game.id, unavailable)).rejects.toThrow("offline");
    expect(await games.actionRoot("wallet", game.id, async () => "root")).toBeNull();
  }
});

it("balances normal games across all genres, preserves difficulty, and never repeats within a round", () => {
  for (let seed = 0; seed < 30; seed++) {
    const questions = selectMixedTriviaQuestions(String(seed));
    expect(questions.map(q => q.difficulty)).toEqual(TRIVIA_MIX);
    expect(new Set(questions.map(q => q.id)).size).toBe(10);
    for (const genre of ["general", "maths", "crypto", "movies"]) expect([2, 3]).toContain(questions.filter(q => q.game === genre).length);
  }
});
