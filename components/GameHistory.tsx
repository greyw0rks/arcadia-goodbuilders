"use client";
import { useEffect, useState } from "react";
import type { GameHistoryItem } from "@/lib/game-history";
export function GameHistory({ address, revision }: { address: string | null; revision: number }) {
  const [data, setData] = useState<{ address: string; games: GameHistoryItem[] } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setData(null); setError("");
    if (!address) return;
    const controller = new AbortController();
    void fetch("/api/history", { cache: "no-store", signal: controller.signal }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      if (payload.playerAddress !== address) throw new Error("Your account changed. Refresh your profile.");
      if (!controller.signal.aborted) setData({ address, games: payload.games });
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [address, revision, retry]);
  const games = data?.address === address ? data.games : null;
  return <section className="profile-section game-history"><h2>Your recent games</h2>{error ? <div role="status"><p>{error}</p><button className="button secondary" onClick={() => setRetry(value => value + 1)}>Retry history</button></div> : !address ? <p>Sign in to see your completed runs.</p> : !games ? <p>Loading your games…</p> : !games.length ? <p>Your first completed game will appear here.</p> : <>{games.map(game => <div className="history-row" key={game.id}><div><strong>{game.mode === "tournament" ? "Tournament" : game.mode === "arcade" ? "Mixed practice" : game.practice ? "Daily practice" : "Daily quiz"}</strong><span>{new Date(game.completedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div><span>{game.correct}/{game.total} correct</span><strong>{game.practice ? "Practice" : `+${game.xp} XP`}</strong></div>)}<p className="panel-note">Your 20 most recent completed games on this playing account.</p></>}</section>;
}
