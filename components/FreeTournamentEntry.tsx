"use client";
import { useEffect, useRef, useState } from "react";
import { activeWallet, walletChainId } from "@/lib/browser-wallet";
import { BUY_GD_URL } from "@/lib/reward-display";
import type { TournamentAccount } from "./useTournamentAccount";

export function FreeTournamentEntry({ address, tournamentId, disabled, onConfirmed, onBusyChange }: {
  address: string; tournamentId: string; disabled: boolean; onConfirmed: TournamentAccount["update"]; onBusyChange?(busy: boolean): void;
}) {
  const key = `arcadia.entry.v1.${tournamentId}.${address}`;
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState("");
  const [ready, setReady] = useState(false);
  const alive = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    alive.current = true;
    try { const hash = localStorage.getItem(key); if (hash && /^0x[0-9a-f]{64}$/i.test(hash)) setPending(hash); setReady(true); }
    catch { setError("Enable browser storage before joining so your transaction can be recovered."); }
    return () => { alive.current = false; };
  }, [key]);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  async function api(action: "prepare" | "confirm", hash?: string) {
    const response = await fetch("/api/tournament", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, transactionHash: hash, playerAddress: address }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Your entry could not be checked.");
    if (data.playerAddress !== address) throw new Error("Your account changed. Reconnect the wallet that submitted this entry.");
    return data;
  }
  async function confirm(hash: string, attempts = 1) {
    for (let index = 0; index < attempts; index++) {
      const data = await api("confirm", hash);
      if (data.stage === "confirmed") { localStorage.removeItem(key); if (alive.current) { setPending(null); onConfirmed(data); } return; }
      if (!alive.current) return;
      if (index < attempts - 1) await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  async function join(hashToRestore?: string) {
    if (running.current || disabled || !ready) return;
    running.current = true; setBusy(true); setError("");
    try {
      if (hashToRestore && !/^0x[0-9a-f]{64}$/i.test(hashToRestore)) throw new Error("Enter a valid Celo transaction hash.");
      const hash = hashToRestore || pending;
      if (hash) { localStorage.setItem(key, hash); setPending(hash); await confirm(hash); return; }
      // Check recovery storage before asking the wallet to submit anything.
      localStorage.setItem(`${key}.ready`, "1"); localStorage.removeItem(`${key}.ready`);
      const data = await api("prepare");
      if (data.stage === "confirmed") { onConfirmed(data); return; }
      const provider = activeWallet();
      if (!provider) throw new Error("Reconnect your playing wallet above, then join.");
      const accounts = await provider.request({ method: "eth_accounts" }) as string[];
      if (accounts[0]?.toLowerCase() !== address) throw new Error("Select your signed-in playing wallet before joining.");
      if (walletChainId(await provider.request({ method: "eth_chainId" })) !== "0xa4ec") throw new Error("Switch your wallet to Celo before joining.");
      const sent = await provider.request({ method: "eth_sendTransaction", params: [data.transaction] });
      if (typeof sent !== "string" || !/^0x[0-9a-f]{64}$/i.test(sent)) throw new Error("No transaction hash was returned. Check your wallet before retrying.");
      localStorage.setItem(key, sent); if (alive.current) setPending(sent);
      await confirm(sent, 6);
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : "Your entry was not confirmed.");
    } finally { running.current = false; if (alive.current) setBusy(false); }
  }
  return <div className="free-entry">
    <p>Free for launch week. Confirm a zero-G$ approval on Celo to join. It grants no token spending allowance. Your wallet may charge a network fee.</p>
    <button className="button primary wide" disabled={disabled || busy || !ready} onClick={() => void join()}>{busy ? "Confirming entry…" : pending ? "Check entry confirmation" : "Join free tournament"}</button>
    {pending ? <p role="status">Waiting for two Celo confirmations. <a href={`https://celoscan.io/tx/${pending}`} target="_blank" rel="noreferrer">View transaction ↗</a></p> : null}
    {error ? <p className="game-error" role="alert">{error}</p> : null}
    <details className="entry-recovery"><summary>Restore an entry transaction</summary><label htmlFor={`entry-${tournamentId}`}>Celo transaction hash</label><input id={`entry-${tournamentId}`} value={recovery} onChange={event => setRecovery(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} disabled={busy} /><button className="button secondary" disabled={busy || disabled || !recovery.trim()} onClick={() => void join(recovery.trim())}>Check this transaction</button>{pending ? <button className="button secondary" disabled={busy} onClick={() => { localStorage.removeItem(key); setPending(null); setError(""); }}>Clear transaction reference</button> : null}<p>Check your wallet before starting again. Clearing this reference does not cancel a pending transaction.</p></details>
    <a className="buy-gd-link" href={BUY_GD_URL} target="_blank" rel="noreferrer">Buy G$ on Uniswap ↗</a><p className="panel-note">You don’t need G$ for this free entry. Weekly passes after launch week will cost US$1 worth of G$.</p>
  </div>;
}
