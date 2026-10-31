"use client";
import Link from "next/link";
import { useState } from "react";
import { ArcadeShell } from "./ArcadeShell";
import { GameHistory } from "./GameHistory";
import { WalletButton } from "./WalletButton";
import { IdentityLink } from "./IdentityLink";
import { usePlayerAccount } from "./usePlayerAccount";
import { useTournamentAccount } from "./useTournamentAccount";
import { identityLabels } from "@/lib/account-status";

export function ProfileApp() {
  const { address, progress, progressError, accountVersion, updateIdentity, loadProgress } = usePlayerAccount();
  const account = useTournamentAccount(address, accountVersion);
  const [walletBusy, setWalletBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  return <ArcadeShell active="/profile" className="profile-shell" wallet={<WalletButton address={address} disabled={!progress || linkBusy} disabledMessage={linkBusy ? "Finish linking before changing accounts." : "Loading your account…"} identityStatus={account.status} onIdentity={updateIdentity} onBusyChange={setWalletBusy} />}>

    <div className="profile-content">
      <div className="profile-heading"><h1>Your player profile</h1><p>Your tournament progress, playing wallet and GoodDollar identity.</p></div>
      {!progress ? <section className="profile-section" aria-live="polite"><p>{progressError || "Loading your profile…"}</p>{progressError ? <button className="button secondary" onClick={() => void loadProgress()}>Try again</button> : null}</section> : <>
        <section className="profile-section profile-progress" aria-labelledby="progress-heading">
          <h2 id="progress-heading">Your progress</h2>
          <dl className="profile-stats"><div><dt>Tournament XP</dt><dd>{(account.competition?.entry?.xp ?? 0).toLocaleString()}</dd></div><div><dt>Games today</dt><dd>{account.competition?.entry?.daily.completedGames ?? 0}</dd></div><div><dt>Next game maximum</dt><dd>{account.competition?.entry?.daily.nextMaxXp ?? 150} <span>XP</span></dd></div></dl>
          <p>Four tournament games in your chosen genre each day, then mixed trivia. All earned XP counts toward the standings.</p>
          <Link className="button primary" href="/app">Continue playing</Link>
        </section>
        <section className="profile-section" aria-labelledby="playing-wallet-heading">
          <h2 id="playing-wallet-heading">Playing wallet</h2>
          {address ? <><p className="profile-address">{address}</p><p>You’re signed in. XP and streaks are saved to this wallet account.</p><a href={`https://celoscan.io/address/${address}`} target="_blank" rel="noreferrer">View wallet on Celo ↗</a></> : <><p>Connect your wallet above to restore your progress and check your GoodDollar identity.</p><p>Every game requires wallet sign-in and GoodDollar verification.</p></>}
        </section>
        <section className="profile-section profile-identity" id="gooddollar" aria-labelledby="identity-heading" inert={walletBusy}>
          <h2 id="identity-heading">GoodDollar identity</h2>
          <p className={`account-identity is-${account.status}`} role="status">{identityLabels[account.status]}</p>
          {account.status === "verified" ? <p>This playing wallet is verified with GoodDollar. You can enter free tournaments without linking another address.</p> : null}
          {account.status === "linked" ? <><p>Your playing wallet is already linked to this verified GoodDollar identity:</p><p className="profile-address">{account.identity?.root}</p><p>You’re ready to enter free tournaments. Linked wallets share the same tournament score and game count.</p></> : null}
          {account.status === "verified" || account.status === "linked" ? <Link className="button primary" href="/app#tournament">Go to free tournament</Link> : null}
          {address && (account.status === "unverified" || ((account.status === "loading" || account.status === "unavailable") && account.identity?.verified === false)) ? <>
            <h3>Link your GoodDollar wallet</h3>
            <IdentityLink key={address} address={address} disabled={walletBusy || account.status !== "unverified"} onBusyChange={setLinkBusy} onRecheck={account.refresh} />
            <p className="profile-verify-note">Don’t have a verified GoodDollar wallet? <a href="https://goodwallet.xyz" target="_blank" rel="noreferrer">Open GoodWallet to complete verification ↗</a></p>
          </> : null}
          {account.status === "unavailable" ? <p role="alert">We couldn’t check your identity on Celo. Your account is still signed in. Recheck before linking another wallet.</p> : null}
          {account.status === "guest" ? <p>Sign in to check whether your playing wallet is verified or needs linking.</p> : null}
          {address ? <button className="button secondary" disabled={account.loading || walletBusy || linkBusy} onClick={() => void account.refresh()}>{account.loading ? "Checking identity…" : "Recheck identity"}</button> : null}
        </section>
        {account.competition?.entry ? <section className="profile-section"><h2>Your tournament</h2><p>{account.competition.title}</p><dl className="profile-stats"><div><dt>Tournament XP</dt><dd>{account.competition.entry.xp}</dd></div><div><dt>Completed games</dt><dd>{account.competition.entry.completedGames}</dd></div><div><dt>Rank</dt><dd>{account.competition.entry.rank ?? "Unranked"}</dd></div></dl></section> : null}
        <GameHistory address={address} revision={accountVersion} />
      </>}
    </div>
  </ArcadeShell>;
}
