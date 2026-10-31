"use client";
import { useEffect, useRef, useState } from "react";
import { injectedWallet, walletChainId } from "@/lib/browser-wallet";
import { goodWalletConnection, goodWalletUrl } from "@/lib/goodwallet-connection";

export function IdentityLink({ address, disabled, onBusyChange, onRecheck }: {
  address: string; disabled: boolean; onBusyChange(busy: boolean): void; onRecheck(): Promise<void>;
}) {
  const [sourceAddress, setSourceAddress] = useState("");
  const [stage, setStage] = useState<"idle" | "connecting" | "approving">("idle");
  const [error, setError] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const busy = stage !== "idle";
  const busyRef = useRef(false);
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { abort.current?.abort(); onBusyChange(false); }, [onBusyChange]);
  useEffect(() => {
    let active = true; setQr(null);
    if (uri) void import("qrcode").then((qr) => qr.toDataURL(uri, { width: 256, margin: 2 })).then((image) => { if (active) setQr(image); }).catch(() => { if (active) setError("QR code unavailable. Use Open GoodWallet to continue."); });
    return () => { active = false; };
  }, [uri]);
  async function link(kind: "goodwallet" | "browser") {
    if (disabled || busyRef.current) return;
    const expected = sourceAddress.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(expected)) { setError("Enter your verified GoodDollar wallet address."); return; }
    if (expected === address.toLowerCase()) { setError("Enter your separate verified GoodDollar wallet, or complete verification for this account in GoodWallet."); return; }
    busyRef.current = true; setStage("connecting"); setError("");
    const controller = new AbortController(); abort.current = controller;
    const checkCancelled = () => { if (controller.signal.aborted) throw new Error("Linking cancelled. Your Arcadia account is unchanged."); };
    try {
      // Validate the source on-chain before requesting a wallet connection.
      const response = await fetch("/api/identity/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerAddress: address, sourceAddress: expected }) });
      const transaction = await response.json();
      if (!response.ok) throw new Error(transaction.error ?? "This GoodDollar wallet could not be checked.");
      checkCancelled();
      let provider = injectedWallet();
      if (kind === "goodwallet") {
        const previous = goodWalletConnection.current();
        if (previous?.session) {
          const accounts = await previous.request({ method: "eth_accounts" }) as string[];
          if (accounts[0]?.toLowerCase() !== expected) await goodWalletConnection.disconnect();
        }
        checkCancelled();
        provider = await goodWalletConnection.connect(setUri, controller.signal);
      }
      checkCancelled(); setUri(null);
      if (!provider) throw new Error("No browser wallet found. Use Connect verified GoodWallet instead.");
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      if (accounts[0]?.toLowerCase() !== expected) throw new Error("The selected wallet does not match the GoodDollar address you entered. Select that verified wallet and try again.");
      if (walletChainId(await provider.request({ method: "eth_chainId" })) !== "0xa4ec") throw new Error("Switch your verified wallet to Celo, then try again.");
      checkCancelled(); setStage("approving");
      const result = await provider.request({ method: "eth_sendTransaction", params: [transaction] });
      if (typeof result !== "string" || !/^0x[a-f0-9]{64}$/i.test(result)) throw new Error("The wallet did not return a link transaction hash.");
      setHash(result);
      await onRecheck();
    } catch (failure) {
      const cancelled = controller.signal.aborted || (failure && typeof failure === "object" && "code" in failure && Number(failure.code) === 4001);
      setError(cancelled ? "Linking cancelled. Your Arcadia account is unchanged." : failure instanceof Error ? failure.message : "The link could not be submitted.");
    } finally { abort.current = null; setUri(null); busyRef.current = false; setStage("idle"); }
  }
  return <div className="identity-link-form">
    <p>Keep this playing account. Enter your face-verified GoodDollar address, then approve the link from that wallet.</p>
    <label htmlFor="gooddollar-address">Verified GoodDollar wallet address</label>
    <input id="gooddollar-address" value={sourceAddress} onChange={(event) => setSourceAddress(event.target.value)} placeholder="0x…" autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy || disabled} aria-describedby="link-explanation" />
    <p id="link-explanation">Entering an address does not link it. Your verified wallet must approve an on-chain link on Celo; a network fee may apply. Your Arcadia sign-in stays the same.</p>
    <div className="profile-actions">
      <button className="button primary" disabled={busy || disabled} onClick={() => void link("goodwallet")}>Connect verified GoodWallet</button>
      <button className="button secondary" disabled={busy || disabled} onClick={() => void link("browser")}>Use selected browser wallet</button>
    </div>
    {uri ? <div className="wallet-pairing">
      {qr ? <img className="wallet-qr" src={qr} width={256} height={256} alt="Scan with your verified GoodWallet to link accounts" /> : <p>Preparing QR code…</p>}
      <a className="button primary" href={goodWalletUrl(uri)} target="_blank" rel="noopener noreferrer">Open GoodWallet ↗</a>
    </div> : null}
    {stage === "connecting" ? <button className="button secondary" onClick={() => abort.current?.abort()}>Cancel linking</button> : null}
    {stage === "approving" ? <p role="status">Approve the identity link in your verified wallet.</p> : null}
    {hash ? <p role="status">Link submitted. After it confirms, select Recheck identity. <a href={`https://celoscan.io/tx/${hash}`} target="_blank" rel="noreferrer">View transaction</a></p> : null}
    {error ? <p className="game-error" role="alert">{error}</p> : null}
  </div>;
}
