import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { progressStore } from "./progress-store";
import { hashSessionToken, SESSION_SECONDS } from "./wallet-auth";

const PLAYER_COOKIE = "arcadia_player";
const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-arcadia_session" : "arcadia_session";
const COOKIE_OPTIONS = {
  httpOnly: true, sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production", path: "/", priority: "high" as const,
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function currentBrowserId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(PLAYER_COOKIE)?.value;
  if (existing && UUID_PATTERN.test(existing)) return existing;

  const playerId = randomUUID();
  cookieStore.set(PLAYER_COOKIE, playerId, { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 365 });
  return playerId;
}

export async function currentSessionToken(): Promise<string | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

export async function currentPlayer(): Promise<{ playerId: string; address: string | null }> {
  const token = await currentSessionToken();
  if (token) {
    const session = await progressStore().getWalletSession(hashSessionToken(token), Date.now());
    if (session) return session;
  }
  // Background reads can finish after a wallet challenge or a new session.
  // Never let those responses replace the browser binding or clear a newer login.
  const existing = (await cookies()).get(PLAYER_COOKIE)?.value;
  return { playerId: existing && UUID_PATTERN.test(existing) ? existing : randomUUID(), address: null };
}

export async function establishWalletSession(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: SESSION_SECONDS });
  cookieStore.set(PLAYER_COOKIE, randomUUID(), { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 365 });
}

export async function signOutWallet(): Promise<void> {
  const token = await currentSessionToken();
  if (token) await progressStore().revokeWalletSession(hashSessionToken(token));
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  cookieStore.set(PLAYER_COOKIE, randomUUID(), { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 365 });
}
