import { createHash, randomBytes } from "node:crypto";
import { getAddress, isAddress } from "viem/utils";
import { createSiweMessage } from "viem/siwe";
import type { ProgressStore } from "./progress-store";
import { WalletAuthError, type WalletChallenge } from "./wallet-identity";
import { verifyWalletSignature, type ContractSignatureReader } from "./wallet-signature";
import { limitRequests } from "./rate-limit";

export const SESSION_SECONDS = 60 * 60 * 24 * 7;
const CHALLENGE_MS = 5 * 60 * 1000;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueWalletChallenge(store: ProgressStore, browserId: string, address: unknown, origin: string, now = Date.now()) {
  if (typeof address !== "string" || !isAddress(address)) throw new WalletAuthError("Choose a valid wallet address.", 400);
  await limitRequests(store, "challenge-browser", browserId, 10, CHALLENGE_MS, now);
  await limitRequests(store, "challenge-wallet", address.toLowerCase(), 10, CHALLENGE_MS, now);
  const nonce = randomBytes(24).toString("hex");
  const expiresAt = now + CHALLENGE_MS;
  const challenge: WalletChallenge = {
    browserId, nonce, origin, expiresAt, address: getAddress(address).toLowerCase(),
    message: createSiweMessage({
      address: getAddress(address), chainId: 42220, domain: new URL(origin).host,
      uri: `${origin}/app`, version: "1", nonce,
      statement: "Sign in to Arcadia to save your quiz progress across devices. No transaction or token approval.",
      issuedAt: new Date(now), expirationTime: new Date(expiresAt),
    }),
  };
  await store.saveWalletChallenge(challenge, now);
  return { nonce, message: challenge.message };
}

export async function verifyWalletLogin(
  store: ProgressStore,
  browserId: string,
  origin: string,
  nonce: unknown,
  signature: unknown,
  previousToken?: string,
  now = Date.now(),
  contractReader?: ContractSignatureReader,
) {
  if (typeof nonce !== "string" || !/^[a-f0-9]{48}$/.test(nonce) ||
      typeof signature !== "string" || signature.length > 8194 || !/^0x(?:[a-fA-F0-9]{2})+$/.test(signature)) {
    throw new WalletAuthError("A valid wallet signature is required.", 400);
  }
  const challenge = await store.getWalletChallenge(browserId, nonce);
  if (!challenge || challenge.origin !== origin || challenge.expiresAt <= now) {
    throw new WalletAuthError("This sign-in expired or belongs to another browser. Start again.");
  }
  await limitRequests(store, "verify-browser", browserId, 20, CHALLENGE_MS, now);
  await limitRequests(store, "verify-wallet", challenge.address, 20, CHALLENGE_MS, now);
  const valid = await verifyWalletSignature(challenge.address as `0x${string}`, challenge.message, signature as `0x${string}`, contractReader);
  if (!valid) throw new WalletAuthError("The signature did not match this wallet. Start again with the selected account.");

  const token = randomBytes(32).toString("hex");
  const linked = await store.linkWallet(challenge, hashSessionToken(token), now + SESSION_SECONDS * 1000, now,
    previousToken ? hashSessionToken(previousToken) : undefined);
  return { token, identity: { address: linked.address }, progress: linked.progress };
}
