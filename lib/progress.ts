export interface DailyResult {
  challengeId: string;
  correct: number;
  total: number;
  xpEarned: number;
  completedAt: string;
}

export interface PlayerProgress {
  version: 1;
  xp: number;
  streak: number;
  lastPlayed: string | null;
  daily: DailyResult | null;
}

export const EMPTY_PROGRESS: PlayerProgress = {
  version: 1,
  xp: 0,
  streak: 0,
  lastPlayed: null,
  daily: null,
};

function dayDistance(previous: string, current: string): number {
  const previousTime = Date.parse(`${previous}T00:00:00.000Z`);
  const currentTime = Date.parse(`${current}T00:00:00.000Z`);
  return Math.round((currentTime - previousTime) / 86_400_000);
}

export function applyDailyResult(
  progress: PlayerProgress,
  result: Omit<DailyResult, "completedAt">,
): { progress: PlayerProgress; creditedXp: number } {
  const alreadyCredited = progress.daily?.challengeId === result.challengeId;
  if (alreadyCredited) {
    return {
      progress: {
        ...progress,
        daily: { ...result, completedAt: progress.daily?.completedAt ?? new Date().toISOString() },
      },
      creditedXp: 0,
    };
  }

  const distance = progress.lastPlayed ? dayDistance(progress.lastPlayed, result.challengeId) : null;
  const streak = distance === 1 ? progress.streak + 1 : distance === 0 ? progress.streak : 1;
  return {
    progress: {
      version: 1,
      xp: progress.xp + result.xpEarned,
      streak,
      lastPlayed: result.challengeId,
      daily: { ...result, completedAt: new Date().toISOString() },
    },
    creditedXp: result.xpEarned,
  };
}
