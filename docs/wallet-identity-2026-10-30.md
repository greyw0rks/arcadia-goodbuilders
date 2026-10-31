# Wallet identity and GoodQuest reference

Historical account implementation notes. See the [current handoff](continuation-2026-10-30.md) for subsequent server-owned games, identity linking, tournament standings and current verification.

## Reference checked

At the user's request, cloned these repositories for inspection:

- `greyw0rks/goodquest` at `b2ba289`, local `/home/greyw0rks/goodquest`.
- `greyw0rks/goodquest-frontend` at `fdb3a83`, local `/home/greyw0rks/goodquest-frontend`.

`goodquest/frontend/src/hooks/useWallet.ts` connects an injected provider, detects MiniPay, requests Celo, and signs a message with `personal_sign`. `server/middleware/auth.js` verifies EOA signatures first, falls back to a deployed wallet's EIP-1271 `isValidSignature`, and creates a database user keyed by the normalized address. Its bearer token contains the address, client timestamp and signature; the frontend persists it and re-signs periodically.

The newer frontend also has `src/components/ui/IdentityLink.tsx`: a separate GoodDollar address input calls `/api/identity/link` and refreshes `/api/identity/status`. Its README explains that the connected EVM account can differ from the GoodDollar-verified address. That backend route is absent from the cloned monorepo revision, so address ownership, uniqueness and revocation checks could not be confirmed. A whitelisted address alone is not proof that the connected player controls it.

The inspected code uses injected providers only. It mentions WalletConnect in UI copy but has no WalletConnect connector dependency or transport. Arcadia does not claim remote WalletConnect support.

## Implemented in Arcadia

- One-use, five-minute SIWE challenges bound to browser, address, exact origin and Celo mainnet (42220).
- Local EOA verification plus read-only EIP-1271 fallback using the EIP-191 message digest. The configured RPC must report Celo mainnet. Undeployed counterfactual wallets are not supported.
- Random seven-day sessions, with only SHA-256 token hashes in libSQL. Production cookies use `__Host-arcadia_session`, Secure, HTTP-only, SameSite=Lax and Path=/.
- Atomic challenge consumption, guest-result merge and session creation. Wallet player IDs use a prefix that cannot pass anonymous UUID-cookie validation.
- Existing wallet results take precedence on overlapping days; merged history rebuilds XP and streaks chronologically. Guest history is removed after transfer and the browser's guest identity rotates.
- Signing in to another wallet revokes the previous session for that browser without moving the old wallet's progress. Sign-out revokes that device's session; other devices remain signed in.
- Auth mutations and quiz completion require the configured request origin. Completion also checks the expected authenticated address, so a stale tab cannot save a run to a different wallet.
- The wallet panel explains the signature and merge, handles cancellation and missing wallets, and preserves free play. Other tabs refresh on account changes. Account changes are disabled during a run; play is paused while sign-in is pending.
- Fixed a quiz submission race: a click and the timer could previously submit the same answer while the first request was pending.

The account shown in the panel is the server-authenticated identity. Selecting a different wallet account does not change that identity until its signature is verified.

## Verification

- 22 unit tests pass, including guest merges, overlapping days, chronological streaks, account isolation, signature forgery, origin/browser binding, expiry, replay, transactional nonce consumption and session revocation.
- 4 Chromium tests pass against the production build: full phone quiz, rejected and successful signatures, guest merge, reload, two-browser restore, cookie flags, sign-out, cross-tab account switching, API request guards, and wallet-free play.
- TypeScript and the production Next.js build pass.
- Captured and inspected the wallet panel at 390×844 and 1440×1000. No horizontal overflow or browser runtime errors appeared in the tested flow.
- Browser tests use generated test keys and an injected provider harness. EIP-1271 checks use a mocked contract reader in unit tests; real MiniPay/GoodWallet devices and a deployed smart wallet still need an integration check.

## Next work

1. Configure durable production libSQL, backup/restore and the deployment origin before publishing `g.arcadia.uno`.
2. Introduce server-owned quiz attempts and committed answers before XP affects rankings or rewards. Current grading accepts complete answer arrays and exposes feedback; authentication alone does not prevent answer harvesting or automation.
3. Recover/audit the GoodQuest identity backend or implement GoodDollar linking with proof of control, uniqueness and revocation. Independently verify the identity and G$ contract configuration.
4. Add real shared standings only after their scoring and abuse controls are defined. The current row is explicitly personal.
5. Complete funding, settlement, receipt and refund work before token movement. `celo.arcadia.uno` remains a separate project.
