import { afterEach, expect, it } from "vitest";
import { ProgressStore } from "../lib/progress-store";
import { GameStore } from "../lib/game-store";
import { playerGameHistory } from "../lib/game-history";
const stores: ProgressStore[] = [];
afterEach(() => { stores.splice(0).forEach(db => db.close()); });
it("returns only completed, owned or explicitly authorized games without question snapshots", async () => {
  const db = new ProgressStore({ url: "file::memory:" }); stores.push(db);
  const games = new GameStore(db);
  const now = Date.parse("2026-10-31T12:00:00Z");
  await games.enroll("identity", now);
  const game = await games.start("owner", "tournament", "identity", false, now, { game: "movies", difficulty: "mixed" });
  expect(await playerGameHistory(db, "owner")).toEqual([]);
  for (let index = 0; index < game.total; index++) { await games.act("owner", "identity", game.id, "answer", index, 0, now); await games.act("owner", "identity", game.id, "next", index, undefined, now); }
  await games.act("owner", "identity", game.id, "finish", undefined, undefined, now);
  const rows = await playerGameHistory(db, "owner");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: game.id, mode: "tournament", completedAt: now, total: 10 });
  expect(Object.keys(rows[0]).sort()).toEqual(["completedAt", "correct", "id", "mode", "multiplier", "practice", "total", "xp"]);
  expect(await playerGameHistory(db, "stranger")).toEqual([]);
  await games.actionRoot("linked-player", game.id, async () => "identity");
  expect(await playerGameHistory(db, "linked-player")).toEqual(rows);
});
