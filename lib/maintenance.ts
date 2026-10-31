import type { ProgressStore } from "./progress-store";

export async function cleanExpiredData(store: ProgressStore, now = Date.now()) {
  return store.write(async (tx) => {
    const statements = [
      ["limits", "DELETE FROM request_limits WHERE expires_at <= ?", now],
      ["challenges", "DELETE FROM wallet_challenges WHERE expires_at <= ?", now],
      ["sessions", "DELETE FROM wallet_sessions WHERE expires_at <= ?", now],
      ["unfinishedGames", "DELETE FROM game_attempts WHERE phase != 'complete' AND expires_at < ?", now - 7 * 86_400_000],
      ["practiceGames", "DELETE FROM game_attempts WHERE practice = 1 AND phase = 'complete' AND completed_at < ?", now - 30 * 86_400_000],
    ] as const;
    const removed: Record<string, number> = {};
    for (const [name, sql, cutoff] of statements) removed[name] = (await tx.execute({ sql, args: [cutoff] })).rowsAffected;
    return removed;
  });
}
