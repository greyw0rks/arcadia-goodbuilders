"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CompetitionView } from "@/lib/game-types";
import { identityStatus, type GoodDollarIdentity } from "@/lib/account-status";

interface AccountData { playerAddress: string | null; competition: CompetitionView; identity: GoodDollarIdentity | null; identityError?: string | null }
export function useTournamentAccount(address: string | null, revision = 0) {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/tournament", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Tournament unavailable.");
      if (version !== requestVersion.current) return;
      if (payload.playerAddress !== address) throw new Error("Your signed-in account changed. Refresh this page to continue.");
      setData(payload); setError(payload.identityError ?? "");
    } catch (failure) { if (version === requestVersion.current) setError(failure instanceof Error ? failure.message : "Verification unavailable."); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [address]);
  useEffect(() => { void refresh(); return () => { requestVersion.current++; }; }, [refresh, revision]);
  const resetsAt = data?.competition?.entry?.daily?.resetsAt;
  useEffect(() => {
    if (!resetsAt) return;
    const timer = window.setTimeout(() => void refresh(), Math.max(1000, resetsAt - Date.now() + 250));
    return () => window.clearTimeout(timer);
  }, [refresh, resetsAt]);
  const current = data?.playerAddress === address ? data : null;
  const identity = current?.identity ?? null;
  return {
    competition: current?.competition ?? null, identity, loading, error, refresh,
    status: identityStatus(address, identity, loading, error),
    update: (payload: AccountData) => { if (payload.playerAddress === address) { requestVersion.current++; setData(payload); setError(payload.identityError ?? ""); setLoading(false); } },
  };
}
export type TournamentAccount = ReturnType<typeof useTournamentAccount>;
