"use client";
import { useState } from "react";
import Link from "next/link";
import type { TournamentAccount } from "./useTournamentAccount";
import { TRIVIA_GAMES } from "@/lib/trivia-catalog";
import { FreeTournamentEntry } from "./FreeTournamentEntry";

export function TournamentPanel({ address, disabled, account, onPlay, entryInMain = false }: { address: string | null; disabled: boolean; account: TournamentAccount; onPlay(): void; entryInMain?: boolean }) {
  const { competition, status, refresh } = account;
  const [busy, setBusy] = useState(false);
  const date = (value: number) => new Date(value).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " UTC";
  const entry = competition?.entry;
  const genre = TRIVIA_GAMES.find(game => game.id === entry?.daily.genre)?.title;
  const verified = status === "verified" || status === "linked";
  return <>
    <section className="rail-panel tournament-panel" id="tournament" aria-busy={busy}>
      <div className="panel-heading"><h2>{competition?.title ?? "Founding week"}</h2><span className="status-text tournament-state">{competition?.status ?? "Loading"}</span></div>
      {competition ? <>
        <p className="tournament-dates">{date(competition.startsAt)} – {date(competition.endsAt)}</p>
        <p className="tournament-summary">{genre ? `${genre} today. ${entry!.daily.genreGamesRemaining ? "Keep going for full XP." : "Your mixed games are unlocked."}` : "Choose your genre. Play four full-XP games, then switch to mixed trivia."}</p>
        <div className="tournament-entry">
          {!address ? <p>Connect and verify your GoodDollar wallet to enter. Entry is free.</p> : verified ? <>
            {entry && !entry.requiresTransaction ? <button className="button primary wide" disabled={disabled || busy || competition.status !== "open"} onClick={onPlay}>{entry.daily.nextKind === "mixed" ? "Play mixed quiz" : "Play tournament"}</button> : entryInMain ? <p>Confirm your weekly entry above, then choose today’s genre.</p> : <FreeTournamentEntry key={`${address}:${competition.id}`} address={address} tournamentId={competition.id} disabled={disabled || competition.status !== "open"} onConfirmed={account.update} onBusyChange={setBusy} />}
          </> : status === "loading" ? <p>Checking your GoodDollar identity…</p> : status === "unavailable" ? <p>Verification is unavailable. Retry before linking another wallet.</p> : <div className="identity-actions"><p>Link your verified GoodDollar identity to play.</p><Link className="button secondary wide" href="/profile#gooddollar">Link GoodDollar wallet</Link></div>}
          </div>
        {entry ? <ol className="daily-game-track" aria-label="Today's four full-XP games">{[1, 2, 3, 4].map(number => <li key={number} className={entry.daily.completedGames >= number ? "is-complete" : ""} aria-label={`Game ${number}: ${entry.daily.completedGames >= number ? "complete" : "remaining"}`}><span>{number}</span><small>{entry.daily.completedGames >= number ? "Done" : "Full XP"}</small></li>)}</ol> : null}
        <dl className="tournament-facts">
          <div><dt>Your tournament XP</dt><dd>{entry?.xp ?? 0}</dd></div>
          <div><dt>Full-XP games left today</dt><dd>{entry?.daily.genreGamesRemaining ?? 4}</dd></div>
          <div><dt>Next game maximum</dt><dd>{entry?.daily.nextMaxXp ?? 150} XP</dd></div>
        </dl>
        <details className="tournament-rules tournament-details"><summary>Your tournament details</summary><dl className="tournament-facts"><div><dt>Today’s genre</dt><dd>{genre ?? "Choose before playing"}</dd></div><div><dt>Mixed games today</dt><dd>{entry?.daily.normalGamesPlayed ?? 0}</dd></div><div><dt>Your completed games</dt><dd>{entry?.completedGames ?? 0}</dd></div><div><dt>Next game multiplier</dt><dd>{entry?.nextMultiplier ?? 100}%</dd></div><div><dt>Collective XP</dt><dd>{competition.collectiveXp}</dd></div></dl></details>
        <details className="tournament-rules"><summary>Scoring and tournament rules</summary><p>Ten questions per game: 3 easy, 3 medium, 2 hard and 2 extremely hard. Base XP is 10 per correct answer plus 50 for finishing. No speed bonus. Percentage earnings are rounded down.</p><table><caption>Each verified identity, each UTC day</caption><thead><tr><th>Game</th><th>XP</th></tr></thead><tbody>{[["Genre games 1–4", "100% · max 150"], ["Mixed game 1", "75% · max 112"], ["Mixed game 2", "50% · max 75"], ["Mixed game 3", "25% · max 37"], ["Mixed games 4–5", "10% · max 15"], ["Mixed game 6 onward", "10% · capped at 5"]].map(([game, xp]) => <tr key={game}><td>{game}</td><td>{xp}</td></tr>)}</tbody></table><p>Your genre locks with the first game each day. After four completed games, normal games mix all four genres. All earnings count toward these standings. Linked wallets share the daily limit and genre; rejoining cannot reset them. The allowance resets at midnight UTC. Unfinished games earn nothing and must finish before midnight or the tournament closes.</p><p>Rank: tournament XP, then correct answers, then earliest last completion. Wallet address breaks any remaining tie. Your four genre games close for the day after completion. Mixed games continue adding XP to these standings.</p><p>Every game requires wallet sign-in and a verified GoodDollar identity. Launch week is free, with no G$ prizes or entry fees. The planned entry after launch week is US$1 worth of G$ per week, not per day; paid passes are not open yet. Games started under earlier rules retain their saved scoring.</p></details>
        {address ? <div className="identity-recheck">{verified ? <span>GoodDollar verified</span> : null}<button className="button secondary compact-action" disabled={disabled || busy || account.loading} onClick={() => void refresh()}>Recheck identity</button></div> : null}
        <p className="tournament-reset">Daily allowance resets at 00:00 UTC.</p>
      </> : null}
      {account.error ? <p className="game-error" role="alert">{account.error}<button className="button secondary" onClick={() => void refresh()}>Retry</button></p> : null}
    </section>
    <section className="rail-panel standings-panel" id="standings"><div className="panel-heading"><h2>Standings</h2><span className="status-text">{competition?.participantCount ?? 0} entrants</span></div>
      {competition?.entry?.rank ? <p>Your rank: {competition.entry.rank}</p> : null}
      {competition?.standings.length ? competition.standings.map((row) => <div className={`standing-row${row.isYou ? " is-you" : ""}`} key={row.address}><span className="standing-rank">{row.rank}</span><div><strong>{row.isYou ? "You" : `${row.address.slice(0, 6)}…${row.address.slice(-4)}`}</strong><span>{row.completedGames} games · {row.correct} correct</span></div><strong>{row.xp} XP</strong></div>) : <div className="empty-standing"><strong>The first place is open.</strong><p>Finish a tournament game to appear here.</p></div>}
    </section>
  </>;
}
