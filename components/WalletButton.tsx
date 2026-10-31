"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { identityLabels, type IdentityStatus } from "@/lib/account-status";
import type { PlayerSnapshot } from "@/lib/wallet-identity";
import { injectedWallet, selectWallet, walletChainId } from "@/lib/browser-wallet";
import { goodWalletConnection, goodWalletUrl } from "@/lib/goodwallet-connection";

const CELO_CHAIN_ID = "0xa4ec";
function shortAddress(address: string) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }
async function post<T>(path: string, body: object): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Account access could not be completed.");
  return payload as T;
}

export function WalletButton({ address, disabled, disabledMessage = "Finish your current quiz before changing accounts.", identityStatus, onIdentity, onBusyChange, openRequest = 0 }: {
  address: string | null;
  disabledMessage?: string;
  identityStatus: IdentityStatus;
  disabled: boolean;
  onIdentity(snapshot: PlayerSnapshot): void;
  onBusyChange(busy: boolean): void;
  openRequest?: number;
}) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "signing" | "verifying" | "signing-out">("idle");
  const [message, setMessage] = useState("");
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const connectionAbort = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const busy = status !== "idle";
  useEffect(() => { setSwitching(false); }, [address]);
  useEffect(() => { if (openRequest) { setOpen(true); toggleRef.current?.focus(); } }, [openRequest]);

  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);

  useEffect(() => {
    const provider = injectedWallet();
    if (!provider) return;
    let active = true;
    const refresh = async () => {
      try {
        const accounts = await provider.request({ method: "eth_accounts" }) as string[];
        if (active) setSelectedAddress(accounts[0]?.toLowerCase() ?? null);
      } catch { if (active) setSelectedAddress(null); }
    };
    const changed = () => void refresh();
    void refresh();
    provider.on?.("accountsChanged", changed);
    provider.on?.("disconnect", changed);
    return () => {
      active = false;
      provider.removeListener?.("accountsChanged", changed);
      provider.removeListener?.("disconnect", changed);
    };
  }, []);

  useEffect(() => () => connectionAbort.current?.abort(), []);
  useEffect(() => {
    let active = true;
    setQrImage(null);
    if (pairingUri) void import("qrcode").then((qr) => qr.toDataURL(pairingUri, { width: 256, margin: 2, errorCorrectionLevel: "M" })).then((image) => { if (active) setQrImage(image); }).catch(() => { if (active) setMessage("The QR code could not load. Use Open GoodWallet to connect."); });
    return () => { active = false; };
  }, [pairingUri]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", escape); };
  }, [open]);

  async function signIn(kind: "injected" | "goodwallet" = "injected") {
    if (busyRef.current || disabled) return;
    let provider = kind === "injected" ? injectedWallet() : undefined;
    if (kind === "injected" && !provider) {
      setMessage("Open Arcadia inside MiniPay or a browser with an Ethereum wallet, or choose Connect GoodWallet.");
      return;
    }
    busyRef.current = true;
    setStatus("connecting");
    setMessage("");
    const controller = new AbortController();
    connectionAbort.current = kind === "goodwallet" ? controller : null;
    const checkCancelled = () => {
      if (controller.signal.aborted) throw Object.assign(new Error("Connection cancelled."), { code: 4001 });
    };
    try {
      if (kind === "goodwallet") {
        provider = await goodWalletConnection.connect(setPairingUri, controller.signal);
        checkCancelled();
        setPairingUri(null);
      }
      if (!provider) throw new Error("Choose a wallet to continue.");
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      const walletAddress = accounts[0]?.toLowerCase();
      if (!walletAddress) throw new Error("Choose an account in your wallet to continue.");
      let chain = walletChainId(await provider.request({ method: "eth_chainId" }));
      if (chain !== CELO_CHAIN_ID) {
        try {
          await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CELO_CHAIN_ID }] });
        } catch (error) {
          if (!(error && typeof error === "object" && "code" in error && Number(error.code) === 4902)) throw error;
          await provider.request({ method: "wallet_addEthereumChain", params: [{
            chainId: CELO_CHAIN_ID, chainName: "Celo", nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
            rpcUrls: ["https://forno.celo.org"], blockExplorerUrls: ["https://celoscan.io"],
          }] });
        }
        chain = walletChainId(await provider.request({ method: "eth_chainId" }));
        if (chain !== CELO_CHAIN_ID) throw new Error("Switch your wallet to Celo, then try again.");
      }
      const challenge = await post<{ nonce: string; message: string }>("/api/auth/challenge", { address: walletAddress });
      checkCancelled();
      setStatus("signing");
      const encoded = `0x${Array.from(new TextEncoder().encode(challenge.message), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      const signature = await provider.request({ method: "personal_sign", params: [encoded, walletAddress] });
      checkCancelled();
      const [currentAccounts, currentChain] = await Promise.all([
        provider.request({ method: "eth_accounts" }) as Promise<string[]>,
        provider.request({ method: "eth_chainId" }),
      ]);
      if (currentAccounts[0]?.toLowerCase() !== walletAddress || walletChainId(currentChain) !== CELO_CHAIN_ID) {
        throw new Error("Your wallet account or network changed. Start sign-in again.");
      }
      checkCancelled();
      setStatus("verifying");
      onIdentity(await post<PlayerSnapshot>("/api/auth/verify", { nonce: challenge.nonce, signature }));
      selectWallet(provider);
      setSelectedAddress(walletAddress);
      setSwitching(false);
      setMessage("Signed in. Your quiz progress is saved to this wallet account.");
    } catch (error) {
      const rejected = error && typeof error === "object" && "code" in error && Number(error.code) === 4001;
      setMessage(rejected ? "Sign-in cancelled. Your progress has not changed." : error instanceof Error ? error.message : "Wallet sign-in was not completed. Please try again.");
    } finally { connectionAbort.current = null; setPairingUri(null); busyRef.current = false; setStatus("idle"); }
  }

  async function signOut() {
    if (busyRef.current || disabled) return;
    busyRef.current = true;
    setStatus("signing-out");
    setMessage("");
    try {
      onIdentity(await post<PlayerSnapshot>("/api/auth/logout", {}));
      void goodWalletConnection.disconnect().catch(() => {});
      selectWallet(null);
      setMessage("Signed out. Your wallet progress is saved. Sign in with a verified wallet to play again.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-out failed. Please try again."); }
    finally { busyRef.current = false; setStatus("idle"); }
  }

  return (
    <div className="wallet-control" ref={containerRef}>
      <button ref={toggleRef} type="button" className="wallet-button" aria-expanded={open} aria-controls="wallet-account" onClick={() => setOpen(!open)}>
        {address ? shortAddress(address) : "Connect wallet"}
      </button>
      {open ? (
        <section className="wallet-panel" id="wallet-account" aria-label="Wallet account">
          <strong>{address ? "Wallet account" : "Take your progress with you"}</strong>
          {address ? <p className="wallet-address">{address}</p> : null}
          <p>{address ? "Your XP and streak are saved to this account. Sign in with the same wallet on another device to continue." : "Sign a free message to save your XP and streak across devices. No transaction or token approval."}</p>
          {!address ? <p>Sign in and verify your GoodDollar identity to unlock every game.</p> : null}
          {address ? <>
            <p className={`account-identity is-${identityStatus}`}>{identityLabels[identityStatus]}</p>
            {identityStatus === "unverified" ? <p>Link your verified GoodDollar wallet from your profile to enter tournaments.</p> : null}
            <Link className="button primary wide" href="/profile" onClick={() => setOpen(false)}>View profile</Link>
            {identityStatus === "unverified" ? <Link className="button secondary wide" href="/profile#gooddollar" onClick={() => setOpen(false)}>Link GoodDollar wallet</Link> : null}
            <button type="button" className="button secondary wide" disabled={busy || disabled} onClick={() => setSwitching(!switching)}>{switching ? "Cancel wallet switch" : "Switch wallet"}</button>
          </> : null}
          {switching && selectedAddress && selectedAddress !== address ? <p>Another browser wallet is selected. Sign in below to switch your Arcadia account.</p> : null}
          {disabled ? <p>{disabledMessage}</p> : null}
          {!address || switching ? <>
          <button type="button" className="button primary wide" disabled={busy || disabled} onClick={() => void signIn("goodwallet")}>Connect GoodWallet</button>
          {pairingUri ? <div className="wallet-pairing" aria-live="polite">
            <p>Open GoodWallet on this device, or scan this code from GoodWallet’s WalletConnect screen. Approve Celo, then sign Arcadia’s sign-in message.</p>
            {qrImage ? <img className="wallet-qr" src={qrImage} width={256} height={256} alt="WalletConnect pairing QR code for GoodWallet" /> : <p>Preparing your QR code…</p>}
            <a className="button primary wide" href={goodWalletUrl(pairingUri)} target="_blank" rel="noopener noreferrer">Open GoodWallet ↗</a>
          </div> : null}
          {status === "connecting" && connectionAbort.current ? <button type="button" className="button secondary wide" onClick={() => connectionAbort.current?.abort()}>Cancel connection</button> : null}
          <button type="button" className="button secondary wide" disabled={busy || disabled} onClick={() => void signIn()}>
            {status === "connecting" ? "Connecting…" : status === "signing" ? "Check your wallet…" : status === "verifying" ? "Verifying…" : address ? "Sign in with selected wallet" : "Sign in with wallet"}
          </button>
          {!busy ? <p className="wallet-provider-note">The browser-wallet option supports MiniPay and injected Celo wallets.</p> : null}
          </> : null}
          {address ? <button type="button" className="button secondary wide" disabled={busy || disabled} onClick={() => void signOut()}>{status === "signing-out" ? "Signing out…" : "Sign out"}</button> : null}
          {message ? <p role="status" className="wallet-message">{message}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
