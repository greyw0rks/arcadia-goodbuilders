import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { ProgressStore } from "../lib/progress-store";
import { GameStore } from "../lib/game-store";
import { limitRequests } from "../lib/rate-limit";
import { cleanExpiredData } from "../lib/maintenance";
import { backupDatabase } from "../lib/database-backup";
import { createTournament } from "../lib/tournament-admin";
import { issueWalletChallenge } from "../lib/wallet-auth";
import { GET as maintenance } from "../app/api/maintenance/route";

const stores: ProgressStore[] = [];
const directories: string[] = [];
const now = Date.parse("2026-10-30T12:00:00Z");
async function database() {
  const directory = await mkdtemp(join(tmpdir(), "arcadia-operations-")); directories.push(directory);
  const url = `file:${join(directory, "source.db")}`;
  const store = new ProgressStore({ url }); stores.push(store);
  return { store, url, directory };
}
afterEach(async () => { vi.unstubAllEnvs(); for (const store of stores.splice(0)) store.close(); for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });

describe("MVP operations", () => {
  it("shares atomic request limits between instances and resets after expiry", async () => {
    const { store, url } = await database();
    await store.get("init");
    const other = new ProgressStore({ url }); stores.push(other);
    await other.get("init");
    const results = await Promise.allSettled(Array.from({ length: 16 }, (_, i) => limitRequests(i % 2 ? store : other, "test", "player", 10, 60_000, now)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    for (const result of results) if (result.status === "rejected") expect(result.reason).toMatchObject({ status: 429, retryAfter: 60 });
    await expect(limitRequests(other, "test", "player", 10, 60_000, now + 59_001)).rejects.toMatchObject({ retryAfter: 1 });
    await limitRequests(other, "test", "player", 10, 60_000, now + 60_000);
    await limitRequests(store, "test", "another-player", 10, 60_000, now);
  });

  it("creates immutable future tournaments and selects them explicitly", async () => {
    const { store } = await database();
    const setup = { id: "next-week", title: "Next week", startsAt: now + 1000, endsAt: now + 100_000 };
    await createTournament(store, setup, now);
    await expect(createTournament(store, { ...setup, title: "Changed" }, now)).rejects.toThrow();
    await expect(createTournament(store, { ...setup, id: "past", startsAt: now - 1 }, now)).rejects.toThrow();
    const games = new GameStore(store, "next-week");
    expect((await games.competition(null, now)).status).toBe("upcoming");
    await expect(games.enroll("root", now)).rejects.toMatchObject({ status: 409 });
    await games.enroll("root", now + 1000);
    expect((await games.competition("root", now + 1000)).title).toBe("Next week");
    await expect(new GameStore(store, "missing").competition(null, now)).rejects.toMatchObject({ status: 503 });
  });

  it("restores populated progress, login sessions, tournament standings and in-flight answers", async () => {
    const { store, url, directory } = await database();
    await store.applyDailyResult("guest", { challengeId: "2026-10-30", correct: 3, total: 5, xpEarned: 80 });
    const address = "0x1111111111111111111111111111111111111111";
    const issued = await issueWalletChallenge(store, "guest", address, "https://g.arcadia.uno", now);
    const challenge = (await store.getWalletChallenge("guest", issued.nonce))!;
    const wallet = await store.linkWallet(challenge, "session-hash", now + 86_400_000, now);
    const games = new GameStore(store);
    await games.enroll(address, now);
    const game = await games.start(wallet.playerId, "tournament", address, false, now, { game: "general", difficulty: "mixed" });
    for (let index = 0; index < 10; index++) {
      await games.act(wallet.playerId, address, game.id, "answer", index, 0, now);
      await games.act(wallet.playerId, address, game.id, "next", index, undefined, now);
    }
    await games.act(wallet.playerId, address, game.id, "finish", undefined, undefined, now);
    const active = await games.start(wallet.playerId, "tournament", address, false, now, { game: "general", difficulty: "mixed" });
    const answer = await games.act(wallet.playerId, address, active.id, "answer", 0, 2, now);
    const source = createClient({ url });
    const destination = join(directory, "backups", "restored.db");
    try {
      const evidence = await backupDatabase(source, destination);
      expect(evidence).toMatchObject({ integrity: "ok", restoredContentsMatch: true, foreignKeysValid: true });
      expect(evidence.tables.daily_results.rows).toBe(1);
      expect(evidence.tables.game_attempts.rows).toBe(2);
      expect((await stat(destination)).mode & 0o777).toBe(0o600);
      await expect(backupDatabase(source, destination)).rejects.toMatchObject({ code: "EEXIST" });
      const restored = new ProgressStore({ url: `file:${destination}` }); stores.push(restored);
      expect(await restored.get(wallet.playerId)).toEqual(await store.get(wallet.playerId));
      expect(await restored.getWalletSession("session-hash", now)).toEqual(await store.getWalletSession("session-hash", now));
      expect(await new GameStore(restored).competition(address, now)).toEqual(await games.competition(address, now));
      expect(await new GameStore(restored).act(wallet.playerId, address, active.id, "read", undefined, undefined, now)).toEqual(answer);
    } finally { source.close(); }
  });

  it("cleans expired operational data while preserving scored games and player history", async () => {
    const { store } = await database();
    const games = new GameStore(store);
    await store.applyDailyResult("player", { challengeId: "2026-10-30", correct: 2, total: 5, xpEarned: 70 });
    const practice = await games.start("player", "daily", null, true, now);
    for (let index = 0; index < 5; index++) {
      await games.act("player", null, practice.id, "answer", index, 0, now);
      await games.act("player", null, practice.id, "next", index, undefined, now);
    }
    await games.act("player", null, practice.id, "finish", undefined, undefined, now);
    const unfinished = await games.start("other", "daily", null, false, now);
    await limitRequests(store, "test", "player", 10, 60_000, now);
    const removed = await cleanExpiredData(store, now + 32 * 86_400_000);
    expect(removed).toMatchObject({ limits: 1, unfinishedGames: 1, practiceGames: 1 });
    expect((await store.get("player")).xp).toBe(70);
    expect((await store.execute({ sql: "SELECT id FROM game_attempts WHERE id = ?", args: [unfinished.id] })).rows).toHaveLength(0);
  });

  it("requires a configured cron secret before maintenance can touch storage", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await maintenance(new Request("https://g.arcadia.uno/api/maintenance"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "only-this-secret");
    expect((await maintenance(new Request("https://g.arcadia.uno/api/maintenance", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
  });
});
