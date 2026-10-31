"use client";
import Link from "next/link";
import { useState } from "react";
import { ArcadeShell } from "./ArcadeShell";
import { ArcadeWorld } from "./ArcadeWorld";
import { ArcadeIcon } from "./ArcadeIcon";
import { WalletButton } from "./WalletButton";
import { usePlayerAccount } from "./usePlayerAccount";
import { useTournamentAccount } from "./useTournamentAccount";
import { TournamentPanel } from "./TournamentPanel";
import { TriviaIcon } from "./TriviaIcon";
import { XpTrack } from "./XpTrack";
import { TRIVIA_GAMES } from "@/lib/trivia-catalog";
import type { CompetitionView, Standing } from "@/lib/game-types";
import { RewardOverview } from "./RewardOverview";

function playerName(row: Standing) { return row.isYou ? "You" : `${row.address.slice(0, 6)}…${row.address.slice(-4)}`; }
export function RankingRows({ competition, compact = false }: { competition: CompetitionView | null; compact?: boolean }) {
  const rows = compact ? competition?.standings.slice(0, 3) : competition?.standings;
  return <div className="ranking-list">{rows?.length ? rows.map(row => <div key={row.address} className={`ranking-row${row.isYou ? " is-you" : ""}`}>
    <span className="rank-number">{String(row.rank).padStart(2, "0")}</span><span className={`player-avatar avatar-${row.rank % 4}`} aria-hidden="true"><ArcadeIcon name="profile" size={18} /></span><div><strong>{playerName(row)}</strong><small>{row.completedGames} games · {row.correct} correct</small></div><strong className="ranking-xp">{row.xp.toLocaleString()} <span>XP</span></strong>
  </div>) : <div className="ranking-empty"><ArcadeIcon name="rank" size={28} /><p>{competition ? "The podium is waiting for its first players." : "Loading the standings…"}</p>{competition ? <Link href="/app">Finish a tournament game to take your place <span aria-hidden="true">→</span></Link> : null}</div>}</div>;
}
function OwnRank({ competition }: { competition: CompetitionView | null }) {
  const entry = competition?.entry;
  return entry ? <div className="personal-standing"><ArcadeIcon name="profile" /><div><strong>Your position</strong><span>{entry.rank ? `#${entry.rank} in ${competition.title}` : "Finish a game to earn your rank"}</span></div><strong>{entry.xp.toLocaleString()} XP</strong></div> : null;
}
export function ArcadeLobby({ screen = "home" }: { screen?: "home" | "tournaments" | "leaderboard" | "rewards" }) {
  const player = usePlayerAccount();
  const account = useTournamentAccount(player.address, player.accountVersion);
  const [busy, setBusy] = useState(false);
  const competition = account.competition;
  const entry = competition?.entry;
  const path = screen === "home" ? "/" : `/${screen}`;
  const wallet = <WalletButton address={player.address} identityStatus={account.status} disabled={!player.progress} onIdentity={player.updateIdentity} onBusyChange={setBusy} />;
  return <ArcadeShell active={path} wallet={wallet} className={`lobby-shell ${screen}-lobby`}>
    {screen === "home" ? <>
      <div className="page-heading"><div><h1>Your daily arcade.</h1><p>A fresh start. A little competition. A lot to discover.</p></div><span className="free-play-tag"><span />Free to play</span></div>
      <div className="home-layout">
        <div className="home-main">
          <section className="portal-feature"><div className="portal-copy"><h2>Curiosity is<br />your superpower.</h2><p>Pick your genre. Play your four.<br />See how far your mind takes you.</p><Link className="button primary play-cta" href="/app"><ArcadeIcon name="play" />Let’s play<ArcadeIcon name="arrow" size={19} /></Link><span className="hero-rules">10 questions · 10 seconds each</span></div><ArcadeWorld kind="portal" /><div className="portal-caption"><span className="tiny-orbit" />Your next adventure starts here.</div></section>
          <section className="lobby-progress" aria-label="Your player progress"><div><ArcadeIcon name="bolt" /><span>Tournament XP<strong>{competition ? (entry?.xp ?? 0).toLocaleString() : "—"}</strong></span></div><div><ArcadeIcon name="clock" /><span>Games today<strong>{entry?.daily.completedGames ?? 0}</strong></span></div><div><ArcadeIcon name="trophy" /><span>Next tournament game<strong>{entry?.daily.nextMultiplier ?? 100}<small>% XP</small></strong></span></div></section>
          <section className="genre-section"><div className="section-heading"><div><h2>What’s your kind of clever?</h2><p>One genre for today’s four tournament games.</p></div><Link href="/tournaments" className="quiet-link">How it works <span aria-hidden="true">↗</span></Link></div><div className="lobby-genres">{TRIVIA_GAMES.map(game => <Link href={`/app?genre=${game.id}`} key={game.id} className={`lobby-genre is-${game.id}`}><TriviaIcon game={game.id} /><strong>{game.title}</strong><span>{game.description}</span><ArcadeIcon name="arrow" size={18} /></Link>)}</div></section>
          <section className="daily-invitation"><img src="/world/quiz.webp" width="160" height="138" alt="" loading="lazy" /><div><h2>After your four, keep exploring.</h2><p>Mixed trivia keeps your XP growing. After five mixed games, earn up to 5 XP per game.</p><Link href="/app">Continue your run <span aria-hidden="true">→</span></Link></div></section>
        </div>
        <aside className="home-rail" aria-label="Today in Arcadia"><section className="today-tournament"><div className="section-heading"><h2>{competition?.title ?? "Tournament"}</h2><span className="status-pill">{competition?.status ?? "Loading"}</span></div><img src="/world/trophy.webp" alt="" width="280" height="200" /><p>Four full-XP games.<br />One place to make your mark.</p><dl><div><dt>Entry</dt><dd>Free</dd></div><div><dt>Players</dt><dd>{competition?.participantCount ?? "—"}</dd></div><div><dt>Collective XP</dt><dd>{competition?.collectiveXp.toLocaleString() ?? "—"}</dd></div></dl><Link className="button secondary wide" href="/tournaments">Explore tournament <ArcadeIcon name="arrow" size={16} /></Link></section><section className="ranking-preview"><div className="section-heading"><h2>On the board</h2><Link href="/leaderboard" aria-label="View all rankings"><ArcadeIcon name="arrow" size={18} /></Link></div><RankingRows competition={competition} compact /></section><Link className="reward-preview" href="/rewards"><ArcadeIcon name="reward" /><div><strong>Good things ahead.</strong><span>Explore XP &amp; G$ rewards</span></div><ArcadeIcon name="arrow" size={18} /></Link></aside>
      </div>
      <XpTrack completed={entry?.daily.completedGames} />
      <p className="lobby-footnote">Connect and sign in with a GoodDollar verified wallet before playing. Have another wallet? Link it from your <Link href="/profile">profile</Link>.</p>
    </> : screen === "tournaments" ? <>
      <div className="page-heading"><div><h1>Your arena awaits.</h1><p>First week free. Four tournament games a day, then mixed trivia.</p></div><span className="free-play-tag"><span />Free entry</span></div>
      <section className="arena-feature"><div><h2>{competition?.title ?? "The daily tournament"}</h2><p>Choose General, Maths, Crypto or Movies.<br />Turn what you know into a place on the board.</p><div className="arena-facts"><span><strong>{competition?.participantCount ?? "—"}</strong>players entered</span><span><strong>{competition?.collectiveXp.toLocaleString() ?? "—"}</strong>collective XP</span><span><strong>4</strong>full-XP games daily</span></div><Link className="button primary" href="/app">Choose your genre <ArcadeIcon name="arrow" size={18} /></Link><p className="panel-note">First week free. Then US$1 worth of G$ per week.<br />Paid passes are not open yet. No G$ prizes in this tournament.</p></div><ArcadeWorld kind="trophy" /></section>
      <XpTrack completed={entry?.daily.completedGames} />
      <div className="tournament-page-details"><TournamentPanel account={account} address={player.address} disabled={busy} onPlay={() => { window.location.href = "/app"; }} /></div>
    </> : screen === "leaderboard" ? <>
      <div className="page-heading"><div><h1>A little friendly competition.</h1><p>{competition?.title ?? "Tournament"} · Ranked by tournament XP</p></div><button className="button secondary" disabled={account.loading} onClick={() => void account.refresh()}>Refresh rankings</button></div>
      <section className="podium-feature"><ArcadeWorld kind="podium" /><div className="podium-players">{[2, 1, 3].map(rank => { const row = competition?.standings.find(item => item.rank === rank); return <div key={rank} className={`podium-player place-${rank}`}><span>#{rank}</span><strong>{row ? playerName(row) : "Your spot?"}</strong><small>{row ? `${row.xp.toLocaleString()} XP` : "Waiting for a player"}</small></div>; })}</div></section>
      <OwnRank competition={competition} /><section className="full-rankings"><div className="section-heading"><h2>The standings</h2><span>{competition?.participantCount ?? "—"} entrants · Top 50</span></div><RankingRows competition={competition} /></section><p className="lobby-footnote">Ties use correct answers, then earliest last completion, then wallet address. Your rank stays visible even outside the top 50.</p>
    </> : <RewardOverview address={player.address} revision={player.accountVersion} />}
    {player.progressError ? <div className="game-error" role="alert">{player.progressError}<button className="button secondary" onClick={() => void player.loadProgress()}>Retry account</button></div> : null}
    {account.error && screen !== "tournaments" && screen !== "rewards" ? <div className="lobby-status" role="status"><p>{account.error}</p><button className="button secondary" disabled={account.loading} onClick={() => void account.refresh()}>Recheck account</button></div> : null}
  </ArcadeShell>;
}
