import { afterEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { hashMessage } from "viem/utils";
import { ProgressStore } from "../lib/progress-store";
import { hashSessionToken, issueWalletChallenge, SESSION_SECONDS, verifyWalletLogin } from "../lib/wallet-auth";
import { verifyWalletSignature, type ContractSignatureReader } from "../lib/wallet-signature";

const account = privateKeyToAccount(`0x${"01".repeat(32)}`);
const otherAccount = privateKeyToAccount(`0x${"02".repeat(32)}`);
const origin = "https://g.arcadia.uno";
const now = Date.parse("2026-10-30T12:00:00Z");
const stores: ProgressStore[] = [];
function makeStore() { const store = new ProgressStore({ url: "file::memory:" }); stores.push(store); return store; }
const noContract: ContractSignatureReader = { getCode: async () => "0x", isValidSignature: async () => "0xffffffff" };
async function prepare(store: ProgressStore, browser = "guest-a", signer = account) {
  const challenge = await issueWalletChallenge(store, browser, signer.address, origin, now);
  return { ...challenge, signature: await signer.signMessage({ message: challenge.message }) };
}
async function login(store: ProgressStore, browser = "guest-a", signer = account, previousToken?: string) {
  const challenge = await prepare(store, browser, signer);
  return verifyWalletLogin(store, browser, origin, challenge.nonce, challenge.signature, previousToken, now, noContract);
}
async function complete(store: ProgressStore, playerId: string, day: string, xpEarned = 90) {
  return store.applyDailyResult(playerId, { challengeId: day, correct: (xpEarned - 50) / 10, total: 5, xpEarned });
}
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

describe("wallet accounts", () => {
  it("moves guest progress to an authenticated account and restores it on another device", async () => {
    const store = makeStore();
    await complete(store, "guest-a", "2026-10-29");
    await complete(store, "guest-a", "2026-10-30", 100);
    const first = await login(store);
    expect(first.identity.address).toBe(account.address.toLowerCase());
    expect(first.progress).toMatchObject({ xp: 190, streak: 2 });
    expect((await store.get("guest-a")).xp).toBe(0);
    const session = await store.getWalletSession(hashSessionToken(first.token), now);
    expect(session?.playerId).toMatch(/^wallet:/);
    expect(await store.getWalletSession(first.token, now)).toBeNull();
    const second = await login(store, "guest-b");
    expect(second.progress).toEqual(first.progress);
    expect(second.token).not.toBe(first.token);
  });

  it("keeps the original account score on overlap and rebuilds streaks chronologically", async () => {
    const store = makeStore();
    await complete(store, "guest-a", "2026-10-28", 70);
    await complete(store, "guest-a", "2026-10-30", 80);
    await login(store);
    await complete(store, "guest-b", "2026-10-29", 90);
    await complete(store, "guest-b", "2026-10-30", 100);
    const second = await login(store, "guest-b");
    expect(second.progress).toMatchObject({ xp: 240, streak: 3, daily: { correct: 3, xpEarned: 80 } });
    const session = await store.getWalletSession(hashSessionToken(second.token), now);
    const replay = await complete(store, session!.playerId, "2026-10-30", 100);
    expect(replay.creditedXp).toBe(0);
    expect(replay.progress.xp).toBe(240);
  });

  it("does not transfer wallet A's progress to wallet B when switching accounts", async () => {
    const store = makeStore();
    await complete(store, "guest-a", "2026-10-30");
    const first = await login(store);
    const second = await login(store, "rotated-guest", otherAccount, first.token);
    expect(second.progress.xp).toBe(0);
    expect(await store.getWalletSession(hashSessionToken(first.token), now)).toBeNull();
    expect((await login(store, "returning-device")).progress.xp).toBe(90);
  });

  it("rejects a forged signature without consuming or moving guest progress", async () => {
    const store = makeStore();
    await complete(store, "guest-a", "2026-10-30");
    const challenge = await prepare(store);
    const forged = await otherAccount.signMessage({ message: challenge.message });
    await expect(verifyWalletLogin(store, "guest-a", origin, challenge.nonce, forged, undefined, now, noContract)).rejects.toMatchObject({ status: 401 });
    expect((await store.get("guest-a")).xp).toBe(90);
    expect(await store.getWalletChallenge("guest-a", challenge.nonce)).not.toBeNull();
  });

  it("rejects signatures from another browser or origin and expired challenges", async () => {
    const store = makeStore();
    const challenge = await prepare(store);
    for (const [browser, site, timestamp] of [
      ["guest-b", origin, now], ["guest-a", "https://celo.arcadia.uno", now], ["guest-a", origin, now + 300_000],
    ] as const) {
      await expect(verifyWalletLogin(store, browser, site, challenge.nonce, challenge.signature, undefined, timestamp, noContract)).rejects.toMatchObject({ status: 401 });
    }
  });

  it("makes challenges single-use and invalidates an older challenge when a new one is issued", async () => {
    const store = makeStore();
    const old = await prepare(store);
    const current = await prepare(store);
    await expect(verifyWalletLogin(store, "guest-a", origin, old.nonce, old.signature, undefined, now, noContract)).rejects.toMatchObject({ status: 401 });
    await verifyWalletLogin(store, "guest-a", origin, current.nonce, current.signature, undefined, now, noContract);
    await expect(verifyWalletLogin(store, "guest-a", origin, current.nonce, current.signature, undefined, now, noContract)).rejects.toMatchObject({ status: 401 });
  });

  it("checks challenge consumption again inside the transaction", async () => {
    const store = makeStore();
    const challenge = await prepare(store);
    const stored = await store.getWalletChallenge("guest-a", challenge.nonce);
    await verifyWalletLogin(store, "guest-a", origin, challenge.nonce, challenge.signature, undefined, now, noContract);
    await expect(store.linkWallet(stored!, "another-token", now + 10000, now)).rejects.toMatchObject({ status: 401 });
  });

  it("expires sessions and revokes only the signed-out device", async () => {
    const store = makeStore();
    const first = await login(store);
    const second = await login(store, "guest-b");
    expect(await store.getWalletSession(hashSessionToken(first.token), now + SESSION_SECONDS * 1000)).toBeNull();
    await store.revokeWalletSession(hashSessionToken(first.token));
    expect(await store.getWalletSession(hashSessionToken(first.token), now)).toBeNull();
    expect(await store.getWalletSession(hashSessionToken(second.token), now)).not.toBeNull();
  });

  it("rejects malformed addresses and unbounded signatures", async () => {
    const store = makeStore();
    await expect(issueWalletChallenge(store, "guest", "0xnope", origin, now)).rejects.toMatchObject({ status: 400 });
    const challenge = await prepare(store);
    await expect(verifyWalletLogin(store, "guest-a", origin, challenge.nonce, `0x${"ab".repeat(5000)}`, undefined, now, noContract)).rejects.toMatchObject({ status: 400 });
  });
});

describe("GoodQuest-style EOA and smart wallet signatures", () => {
  it("verifies an EOA locally without any RPC request", async () => {
    const reader = { getCode: vi.fn(), isValidSignature: vi.fn() };
    const signature = await account.signMessage({ message: "Arcadia" });
    expect(await verifyWalletSignature(account.address, "Arcadia", signature, reader)).toBe(true);
    expect(reader.getCode).not.toHaveBeenCalled();
  });

  it("accepts arbitrary-length EIP-1271 signatures only with the magic value and EIP-191 digest", async () => {
    const store = makeStore();
    const challenge = await prepare(store);
    const reader = { getCode: vi.fn(async () => "0x6000" as const), isValidSignature: vi.fn(async () => "0x1626ba7e" as const) };
    const loginResult = await verifyWalletLogin(store, "guest-a", origin, challenge.nonce, "0xaabb", undefined, now, reader);
    expect(loginResult.identity.address).toBe(account.address.toLowerCase());
    expect(reader.isValidSignature).toHaveBeenCalledWith(account.address.toLowerCase(), hashMessage(challenge.message), "0xaabb");
  });

  it("rejects the wrong magic value and exposes RPC unavailability without authenticating", async () => {
    const reader: ContractSignatureReader = { getCode: async () => "0x6000", isValidSignature: async () => "0xffffffff" };
    expect(await verifyWalletSignature(account.address, "Arcadia", "0xabcd", reader)).toBe(false);
    reader.getCode = async () => { throw new Error("offline"); };
    await expect(verifyWalletSignature(account.address, "Arcadia", "0xabcd", reader)).rejects.toMatchObject({ status: 503 });
  });
});
