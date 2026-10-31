"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "./BrandLogo";
import { WalletButton } from "./WalletButton";
import { usePlayerAccount } from "./usePlayerAccount";
import { useTournamentAccount } from "./useTournamentAccount";
import { activeWallet, walletChainId } from "@/lib/browser-wallet";
import { SPONSOR_ADDRESS, SPONSOR_GD_AMOUNT } from "@/lib/sponsor-config";
import type { SponsorView } from "@/lib/sponsor-types";

type Saved = { deploymentHash?: string; pendingHash?: string; pendingStage?: string };
const key = `arcadia.sponsor.v1.${SPONSOR_ADDRESS}`;
const hashPattern = /^0x[0-9a-f]{64}$/i;
export function SponsorApp() {
  const { address, progress, updateIdentity } = usePlayerAccount();
  const account = useTournamentAccount(address);
  const [walletBusy, setWalletBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<SponsorView | null>(null);
  const [saved, setSaved] = useState<Saved>({});
  const [recoveryHash, setRecoveryHash] = useState("");
  const [error, setError] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const running = useRef(false);
  const owner = address === SPONSOR_ADDRESS;
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "{}");
      if (stored.deploymentHash && hashPattern.test(stored.deploymentHash)) setSaved(stored);
      setStorageReady(true);
    } catch { setError("Browser storage is unavailable. Enable it before deploying so transaction recovery is available."); }
  }, []);
  useEffect(() => { setView(null); }, [address]);
  function remember(next: Saved) {
    // Verify recovery storage before prompting the wallet, then persist every
    // returned transaction hash immediately, before further network requests.
    setSaved(next); localStorage.setItem(key, JSON.stringify(next));
  }
  async function api(action: "prepare" | "status", deploymentHash?: string, pendingHash?: string): Promise<SponsorView> {
    const response = await fetch("/api/sponsor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, deploymentHash, pendingHash, playerAddress: address }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Funding setup is unavailable. Try again.");
    if (body.address !== address) throw new Error("The funding wallet changed. Reconnect before continuing.");
    return body;
  }
  async function check() {
    if (running.current || !owner) return;
    running.current = true; setBusy(true); setError("");
    try {
      const data = await api(saved.deploymentHash ? "status" : "prepare", saved.deploymentHash, saved.pendingHash);
      setView(data);
      if (saved.pendingHash && data.transactionResult && data.transactionResult !== "pending") {
        remember(data.transactionResult === "reverted" && saved.pendingHash === saved.deploymentHash ? {} : { deploymentHash: saved.deploymentHash });
        if (data.transactionResult === "reverted") setError("The transaction reverted. No deposit was completed by that transaction. Review the wallet receipt before retrying.");
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not check Celo."); }
    finally { running.current = false; setBusy(false); }
  }
  async function submit() {
    if (running.current || !owner || !view?.transaction || !storageReady || saved.pendingHash) return;
    running.current = true; setBusy(true); setError("");
    try {
      remember(saved);
      if (view.stage === "deploy" && (!view.expiresAt || Date.now() >= view.expiresAt)) { setView(null); throw new Error("The quote expired. Refresh the quote before deploying."); }
      // Recheck contract state, balance, allowance and gas before approvals or
      // funding; never reuse transaction calldata from browser storage.
      const current = view.stage === "deploy" ? view : await api("status", saved.deploymentHash);
      if (current.stage !== view.stage || !current.transaction) { setView(current); return; }
      const provider = activeWallet();
      if (!provider) throw new Error("Reconnect the sponsor wallet using Connect wallet, then continue.");
      const accounts = await provider.request({ method: "eth_accounts" }) as string[];
      if (accounts[0]?.toLowerCase() !== address) throw new Error("Select the designated sponsor wallet before approving.");
      if (walletChainId(await provider.request({ method: "eth_chainId" })) !== "0xa4ec") throw new Error("Switch the sponsor wallet to Celo before approving.");
      const hash = await provider.request({ method: "eth_sendTransaction", params: [current.transaction] });
      if (typeof hash !== "string" || !hashPattern.test(hash)) throw new Error("The wallet did not return a transaction hash. Check the wallet before retrying.");
      const next = { deploymentHash: view.stage === "deploy" ? hash : saved.deploymentHash, pendingHash: hash, pendingStage: view.stage };
      remember(next);
      setView({ ...current, stage: "pending", transaction: undefined, message: "Transaction submitted. Refresh confirmation once it has confirmed in your wallet." });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The transaction was not submitted."); }
    finally { running.current = false; setBusy(false); }
  }
  function restore() {
    if (!hashPattern.test(recoveryHash.trim())) { setError("Enter a valid deployment transaction hash."); return; }
    try { remember({ deploymentHash: recoveryHash.trim() }); setView(null); setError(""); }
    catch { setError("Browser storage is unavailable. Keep the transaction hash and enable storage to continue."); }
  }
  const amount = view?.amount ? Number(view.amount).toLocaleString(undefined, { maximumFractionDigits: 6 }) : null;
  const label = view?.stage === "deploy" ? "Deploy escrow" : view?.stage === "approve" ? "Approve this G$ amount" : "Fund escrow";
  return <main className="app-shell profile-shell">
    <header className="app-header">
      <Link href="/" className="wordmark" aria-label="Arcadia home"><BrandLogo inverse /></Link>
      <nav aria-label="Game navigation"><Link href="/app">Play</Link><Link href="/profile">Profile</Link><Link href="/fund" aria-current="page">Fund escrow</Link></nav>
      <WalletButton address={address} identityStatus={account.status} disabled={!progress || busy} disabledMessage="Finish the current funding step before switching wallets." onIdentity={updateIdentity} onBusyChange={setWalletBusy} />
    </header>
    <div className="profile-content">
      <div className="profile-heading"><h1>Fund the G$ pool</h1><p>Deploy the tournament escrow on Celo, approve the exact G$ amount, then fund it.</p></div>
      <section className="profile-section">
        <h2>Sponsor wallet</h2><p className="profile-address">{SPONSOR_ADDRESS}</p>
        <p>This wallet becomes the escrow manager. It approves each transaction and pays the Celo network fees separately.</p>
        {!owner ? <p>Connect and sign in with this wallet to prepare the funding quote.</p> : <p role="status">Sponsor wallet signed in.</p>}
      </section>
      <section className="profile-section" aria-busy={busy}>
        <h2>{view?.stage === "funded" ? "Pool funded" : "Review and approve"}</h2>
        <p>Your approved deposit is {SPONSOR_GD_AMOUNT} G$. G$ is not pegged to the dollar; its estimated value comes from a market quote. Later wallet top-ups will not increase this deposit.</p>
        {view?.amount ? <><dl className="profile-stats"><div><dt>G$ pool cap</dt><dd>{amount}</dd></div><div><dt>Next network fee estimate</dt><dd className="profile-date">{view.gasEstimateCelo ? `${Number(view.gasEstimateCelo).toPrecision(4)} CELO` : "—"}</dd></div></dl><p>Exact amount: {view.amount} G$. {view.stage === "approve" ? "Approval is limited to this amount for this escrow." : ""}</p></> : null}
        {view?.quoteUrl ? <p>Estimated pool value: US${view.estimatedUsd}. <a href={view.quoteUrl} target="_blank" rel="noreferrer">Quote source ↗</a> · ${view.priceUsd} per G$ · {new Date(view.quotedAt!).toLocaleString()}</p> : null}
        {view?.endsAt ? <p>{view.tournament || "Tournament"} closes {new Date(view.endsAt).toUTCString()}. Claims close 30 days later.</p> : null}
        {view?.escrow ? <p><a href={`https://celoscan.io/address/${view.escrow}`} target="_blank" rel="noreferrer">View escrow on Celo ↗</a></p> : null}
        {view?.message ? <p role="status">{view.message}</p> : null}
        {saved.pendingHash ? <p><a href={`https://celoscan.io/tx/${saved.pendingHash}`} target="_blank" rel="noreferrer">View submitted transaction ↗</a> · Confirm it in your wallet before refreshing. A pending transaction is never submitted twice.</p> : null}
        <div className="profile-actions">
          {owner && view?.transaction && !saved.pendingHash ? <button className="button primary" disabled={busy || walletBusy || !storageReady} onClick={() => void submit()}>{busy ? "Check your wallet…" : label}</button> : null}
          {owner && view?.stage !== "funded" ? <button className="button secondary" disabled={busy || walletBusy || !storageReady} onClick={() => void check()}>{busy ? "Checking…" : saved.deploymentHash ? "Refresh confirmation" : view ? "Refresh quote" : "Prepare funding quote"}</button> : null}
        </div>
        {error ? <p className="game-error" role="alert">{error}</p> : null}
      </section>
      <section className="profile-section"><h2>How the pool works</h2><p>Funding holds G$ in the escrow. Player payouts require a finalized allocation after the tournament closes; funding alone does not enable payouts in the game.</p><p>As manager, you can cancel before finalizing. Sponsors can then reclaim their contributions. After the claim window ends, remaining funds are refundable proportionally.</p><a href="/contracts/ArcadiaTournamentEscrow.sol" target="_blank" rel="noreferrer">Review the Solidity contract ↗</a></section>
      {owner ? <section className="profile-section identity-link-form"><h2>Resume a deployment</h2><p>If you changed devices, paste the deployment transaction hash. The server checks its sender and exact contract code before preparing approvals.</p><label htmlFor="deployment-hash">Deployment transaction hash</label><input id="deployment-hash" value={recoveryHash} onChange={event => setRecoveryHash(event.target.value)} autoComplete="off" spellCheck={false} placeholder="0x…" disabled={busy || !!saved.pendingHash} /><button className="button secondary" disabled={busy || !!saved.pendingHash || !storageReady} onClick={restore}>Use deployment hash</button>{saved.deploymentHash ? <p className="profile-address">{saved.deploymentHash}</p> : null}</section> : null}
    </div>
    <footer className="app-footer"><span>Each transaction requires your wallet approval.</span><Link href="/app">Back to the arcade</Link></footer>
  </main>;
}
