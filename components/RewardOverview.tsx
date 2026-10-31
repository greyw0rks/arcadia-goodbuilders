"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArcadeWorld } from "./ArcadeWorld";
import { ArcadeIcon } from "./ArcadeIcon";
import { ARCADIA_ESCROW, BUY_GD_URL, FUNDING_RECEIPT, RECORDED_DEPOSIT, type RewardView } from "@/lib/reward-display";

const amount = (value: string) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
export function RewardOverview({ address, revision }: { address: string | null; revision: number }) {
  const [data, setData] = useState<RewardView | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setData(null); setError("");
    void fetch("/api/rewards", { cache: "no-store", signal: controller.signal }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      if (payload.playerAddress !== address) throw new Error("Your account changed. Refresh to see its rewards.");
      if (!controller.signal.aborted) setData(payload);
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message || "Rewards could not be loaded."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [address, revision, refresh]);
  return <>
    <div className="page-heading"><div><h1>Good things to play for.</h1><p>Your progress, the funding pool and what comes next.</p></div><button className="button secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? "Checking…" : "Refresh balances"}</button></div>
    <section className="reward-feature"><div><h2>Collect XP.<br />Build your story.</h2><p>Every completed run moves you forward. XP tracks your play and tournament position; it can’t be redeemed for G$ or money.</p><Link href="/app" className="button primary">Play for XP <ArcadeIcon name="arrow" size={18} /></Link></div><ArcadeWorld kind="chest" /></section>
    <div className="reward-columns"><section className="reward-panel"><ArcadeIcon name="reward" /><h2>The G$ funding pool</h2><p className="reward-amount">{data?.escrowBalance !== null && data?.escrowBalance !== undefined ? amount(data.escrowBalance) : "—"}<small> G$ on Celo</small></p><p>{data?.checkedAt ? `Balance checked ${new Date(data.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : loading ? "Checking the current contract balance…" : "Current balance unavailable."}</p><p>The sponsor deposited {amount(RECORDED_DEPOSIT)} G$. This funding is held separately from the current XP tournament. No G$ prizes are offered in this release.</p><div className="reward-links"><a href={`https://celoscan.io/address/${ARCADIA_ESCROW}`} target="_blank" rel="noreferrer">View escrow ↗</a><a href={`https://celoscan.io/tx/${FUNDING_RECEIPT}`} target="_blank" rel="noreferrer">Funding receipt ↗</a></div></section><section className="reward-panel"><ArcadeIcon name="profile" /><h2>Your wallet</h2><p className="reward-amount">{data?.walletBalance !== null && data?.walletBalance !== undefined ? amount(data.walletBalance) : "—"}<small> G$</small></p><p>{address ? "Your playing wallet’s balance on Celo. This includes funds outside Arcadia." : "Sign in with your wallet above to see its G$ balance."}</p><div className="claim-status"><ArcadeIcon name="clock" /><div><strong>Claims are not open</strong><p>Reward allocations must be published before a future G$ distribution.</p></div></div><Link href="/profile">Manage your wallet <span aria-hidden="true">→</span></Link></section></div>
    {error || data?.chainError ? <div className="lobby-status" role="status"><p>{error || data?.chainError}</p><button className="button secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Try again</button></div> : null}
    <section className="buy-gd-panel"><div><h2>{data?.walletBalance === "0" ? "No G$ in your wallet?" : "Get ready for your next week."}</h2><p>Launch week is free. After that, a weekly pass will cost US$1 worth of G$. Buy on Uniswap with Celo and G$ already selected; review the exchange rate and network fee there.</p></div><a className="button primary" href={BUY_GD_URL} target="_blank" rel="noreferrer">Buy G$ now ↗</a></section>
    <section className="reward-history"><h2>Reward history</h2>{data?.historyError ? <p role="status">{data.historyError}</p> : data?.receipts.length ? data.receipts.map(receipt => <div className="history-row" key={receipt.hash}><div><strong>Recorded G$ reward</strong><span>{new Date(receipt.recordedAt).toLocaleDateString()}</span></div><strong>{amount(receipt.amount)} G$</strong><a href={`https://celoscan.io/tx/${receipt.hash}`} target="_blank" rel="noreferrer">Receipt ↗</a></div>) : <p>{loading ? "Loading reward history…" : !address ? "Sign in to view rewards recorded for your verified identity." : "No reward receipts recorded for your identity yet. Current games award XP."}</p>}</section>
  </>;
}
