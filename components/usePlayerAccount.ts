"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerProgress } from "@/lib/progress";
import type { PlayerSnapshot } from "@/lib/wallet-identity";

export function usePlayerAccount() {
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [progressError, setProgressError] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [accountVersion, setAccountVersion] = useState(0);
  const requestVersion = useRef(0);
  const updateIdentity = useCallback((snapshot: PlayerSnapshot) => {
    requestVersion.current += 1;
    setAddress(snapshot.identity.address); setProgress(snapshot.progress); setProgressError("");
    setAccountVersion((value) => value + 1);
    try { window.localStorage.setItem("arcadia-account-change", String(Date.now())); } catch { /* Storage may be disabled. */ }
  }, []);
  const loadProgress = useCallback(async () => {
    const version = ++requestVersion.current;
    setProgressError("");
    try {
      const response = await fetch("/api/progress", { cache: "no-store" });
      const payload = await response.json() as Partial<PlayerSnapshot> & { error?: string };
      if (!response.ok || !payload.progress) throw new Error(payload.error ?? "Player progress could not be loaded.");
      if (version !== requestVersion.current) return;
      setProgress(payload.progress); setAddress(payload.identity?.address ?? null);
    } catch (error) { if (version === requestVersion.current) setProgressError(error instanceof Error ? error.message : "Player progress could not be loaded."); }
  }, []);
  useEffect(() => { void loadProgress(); return () => { requestVersion.current++; }; }, [loadProgress]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== "arcadia-account-change") return;
      setProgress(null); setAddress(null); setAccountVersion((value) => value + 1); void loadProgress();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [loadProgress]);
  return { address, progress, progressError, accountVersion, updateIdentity, loadProgress, setProgress };
}
