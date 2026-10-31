"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { DailyChallenge } from "@/components/DailyChallenge";
import { WalletButton } from "@/components/WalletButton";
import { TournamentPanel } from "@/components/TournamentPanel";
import { ArcadeShell } from "./ArcadeShell";
import { ArcadeWorld } from "./ArcadeWorld";
import { usePlayerAccount } from "./usePlayerAccount";
import { useTournamentAccount } from "./useTournamentAccount";
import { TRIVIA_GAMES } from "@/lib/trivia-catalog";
import type { TriviaGame } from "@/lib/question-types";
import { TriviaIcon } from "./TriviaIcon";
import { FreeTournamentEntry } from "./FreeTournamentEntry";

export function GameApp({ initialGenre }: { initialGenre?: TriviaGame }) {
  const { address, progress, progressError, accountVersion, updateIdentity, loadProgress, setProgress } = usePlayerAccount();
  const [runActive, setRunActive] = useState(false);
  const [runPresent, setRunPresent] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [entryBusy, setEntryBusy] = useState(false);
  const mode = "tournament" as const;
  const [genreChoice, setGenreChoice] = useState<{ game: TriviaGame; day: string } | null>(initialGenre ? { game: initialGenre, day: new Date().toISOString().slice(0, 10) } : null);
  const [openWallet, setOpenWallet] = useState(0);
  const [competitionRevision, setCompetitionRevision] = useState(0);
  const tournament = useTournamentAccount(address, accountVersion + competitionRevision);
  const daily = tournament.competition?.entry?.daily;
  const day = daily?.day ?? new Date().toISOString().slice(0, 10);
  const genre = daily?.genre ?? (genreChoice?.day === day ? genreChoice.game : null);
  const verified = tournament.status === "verified" || tournament.status === "linked";
  const enrolled = !!tournament.competition?.entry && !tournament.competition.entry.requiresTransaction;
  const chooseGenre = mode === "tournament" && daily?.nextKind !== "mixed" && !genre && !runPresent;

  const gameFinished = useCallback(() => { if (mode === "tournament") setCompetitionRevision((value) => value + 1); }, [mode]);

  return (
    <ArcadeShell active="/app" className="game-shell" playing={runActive} wallet={<WalletButton identityStatus={tournament.status} address={address} disabled={runActive || entryBusy || !progress} onIdentity={updateIdentity} onBusyChange={setAccountBusy} openRequest={openWallet} />}>
      {!runActive ? <div className="page-heading"><div><h1>Let’s make it a good run.</h1><p>Choose your challenge. Find your flow.</p></div><Link className="quiet-link" href="/tournaments#xp-rules">Your XP guide ↗</Link></div> : null}

      <div className="app-layout">
        <section id="challenge" className="app-primary" inert={accountBusy} aria-busy={accountBusy}>
          {address && verified && !runActive ? <div className="daily-flow-heading"><strong>{daily?.nextKind === "mixed" ? "Mixed quiz" : "Your daily tournament"}</strong><span>{daily?.nextKind === "mixed" ? `Four tournament games complete · ${daily.nextMultiplier}% XP · Max ${daily.nextMaxXp} XP` : `${Math.min(daily?.completedGames ?? 0, 4)} of 4 games complete`}</span></div> : null}
          {!address ? <section className="challenge-card challenge-ready wallet-gate"><ArcadeWorld kind="portal" staticOnly className="gate-world" /><h1>Connect your wallet to play.</h1><p className="challenge-intro">Your wallet is your player account. Sign in with a verified GoodDollar wallet, or link your playing wallet from your profile.</p><ol className="gate-steps"><li>Connect &amp; sign in</li><li>Verify GoodDollar</li><li>Choose your game</li></ol><button className="button primary wide" disabled={!progress} onClick={() => setOpenWallet(value => value + 1)}>Connect wallet to play</button><p className="panel-note">Free to play. Your XP and streak stay with your account.</p></section>
          : !verified && !runActive && !runPresent ? <section className="challenge-card challenge-ready"><h1>{tournament.loading ? "Checking your identity…" : "Verify your wallet to play."}</h1><p>{tournament.status === "unavailable" ? "Your identity check is temporarily unavailable. Retry to start a game." : "Your wallet must be GoodDollar verified or linked to a verified identity before any game can start."}</p>{tournament.status === "unverified" ? <Link className="button primary" href="/profile#gooddollar">Verify or link GoodDollar wallet</Link> : <button className="button secondary" disabled={tournament.loading} onClick={() => void tournament.refresh()}>Recheck identity</button>}</section>
          : !enrolled && tournament.competition && !runPresent && !runActive ? <section className="challenge-card entry-stage">
            <h1>Join this week’s tournament.</h1>
            <p className="challenge-intro">One entry unlocks your daily genre games and mixed trivia for the week. Choose your genre after your entry is confirmed.</p>
            <FreeTournamentEntry key={`${address}:${tournament.competition.id}`} address={address} tournamentId={tournament.competition.id} disabled={accountBusy || tournament.competition.status !== "open"} onConfirmed={tournament.update} onBusyChange={setEntryBusy} />
          </section> : chooseGenre ? <section className="challenge-card trivia-hub">
            <h1>Choose today’s genre.</h1>
            <p className="challenge-intro">Four games in your genre. Full XP. Then keep the run going with mixed trivia.</p>
            <div className="trivia-grid">{TRIVIA_GAMES.map(game => <button className={`trivia-game-card is-${game.id}`} key={game.id} aria-label={`Choose ${game.title}`} onClick={() => setGenreChoice({ game: game.id, day })}><span className="trivia-card-top"><TriviaIcon game={game.id} /><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span><strong>{game.title}</strong><span>{game.description}</span></button>)}</div>
            <div className="genre-rules"><span>10 questions</span><span>10 seconds each</span><span>Easy to extremely hard</span></div>
            <p className="panel-note">Your genre locks on your first game. Choose again tomorrow at 00:00 UTC.</p>
          </section> : <>
          {mode === "tournament" && genre && !daily?.genre && daily?.nextKind !== "mixed" ? <div className="trivia-controls"><button className="button secondary" disabled={runActive} onClick={() => setGenreChoice(null)}>Change genre before starting</button></div> : null}
          {progress ? <DailyChallenge key={`${accountVersion}:${mode}:${mode === "tournament" ? day : ""}`} mode={mode} trivia={genre ? { game: genre, difficulty: "mixed" } : undefined} tournamentDay={daily} enrolled={!!tournament.competition?.entry && !tournament.competition.entry.requiresTransaction} canStart={verified} progress={progress} walletAddress={address} onProgress={setProgress} onRunActiveChange={setRunActive} onRunPresentChange={setRunPresent} onFinished={gameFinished} /> : progressError ? (
            <section className="challenge-card challenge-error" role="alert">
              <p className="section-label">Progress unavailable</p>
              <h1>Your daily run has not started.</h1>
              <p>{progressError}</p>
              <button type="button" className="button secondary" onClick={() => void loadProgress()}>Try again</button>
            </section>
          ) : (
            <section className="challenge-card challenge-skeleton" aria-label="Loading player progress">
              <span /><span /><span /><span />
            </section>
          )}
          </>}
        </section>

        <aside className="app-rail" aria-label="Player and tournament information">
          <section className="rail-score">
            <div>
              <span>Tournament XP</span>
              <strong>{tournament.competition ? (tournament.competition.entry?.xp ?? 0).toLocaleString() : "—"}</strong>
            </div>
            <div>
              <span>Games today</span>
              <strong>{daily?.completedGames ?? 0}</strong>
            </div>
          </section>

          <TournamentPanel key={accountVersion} account={tournament} address={address} disabled={runActive || accountBusy || entryBusy} entryInMain onPlay={() => { document.getElementById("challenge")?.scrollIntoView({ behavior: "auto" }); }} />
        </aside>
      </div>

    </ArcadeShell>
  );
}
