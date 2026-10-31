import type { ProgressStore } from "./progress-store";
import type { GameMode } from "./game-types";
export interface GameHistoryItem { id: string; mode: GameMode; practice: boolean; completedAt: number; correct: number; total: number; xp: number; multiplier: number }
// Read only attempts this authenticated player owns or has already been authorized to play.
// Question snapshots and answer keys never leave this query boundary.
export async function playerGameHistory(db: ProgressStore, playerId: string): Promise<GameHistoryItem[]> {
  const result = await db.execute({ sql: `SELECT a.id, a.mode, a.practice, a.completed_at, a.result FROM game_attempts a
    WHERE a.phase = 'complete' AND (a.owner_id = ? OR EXISTS
      (SELECT 1 FROM game_attempt_access access WHERE access.game_id = a.id AND access.player_id = ?))
    ORDER BY a.completed_at DESC, a.id DESC LIMIT 20`, args: [playerId, playerId] });
  return result.rows.map(row => {
    const score = JSON.parse(String(row.result));
    return { id: String(row.id), mode: row.mode as GameMode, practice: Boolean(row.practice), completedAt: Number(row.completed_at), correct: Number(score.correct), total: Number(score.total), xp: Number(score.xpEarned), multiplier: Number(score.multiplier) };
  });
}
