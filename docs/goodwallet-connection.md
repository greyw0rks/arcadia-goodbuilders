# GoodWallet connection

Arcadia offers **Connect GoodWallet** through WalletConnect v2 on Celo mainnet (42220). It displays a QR code and opens `https://goodwallet.xyz/?uri=<encoded WalletConnect URI>`. The user approves the session in GoodWallet, then signs Arcadia's SIWE message. Pairing alone never authenticates an account.

The user's public Reown project ID is configured as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in local and Vercel production environments. Allow `https://g.arcadia.uno` in that project's Reown settings. Local or preview origins may also need allowlisting. The ID is intentionally public; never substitute a private API credential. Changes require rebuilding the client.

## Implementation

- `lib/goodwallet-connection.ts` lazily loads `@walletconnect/ethereum-provider` 2.26.0. It requires Celo and `personal_sign`, and optionally permits transactions and network changes for the existing identity-link flow.
- The connection has a three-minute timeout covering initialization, any pending cleanup and approval. Cancelling releases the UI immediately and expires only the matching SDK proposal and pairing. The deprecated SDK `abortPairingAttempt` method is not used. A late URI is expired without being displayed, and a late approval is disconnected before a retry can begin. An SDK session can be reused.
- `components/WalletButton.tsx` draws the QR locally with `qrcode`, then uses the existing challenge/verify API. The server still validates the exact origin, browser-bound nonce, wallet signature and one-use challenge. EOA and EIP-1271 checks are unchanged.
- All wallet network reads use `walletChainId` from `lib/browser-wallet.ts`. WalletConnect 2.26.0 returns a numeric `eth_chainId` (`42220` for Celo), while injected wallets generally return hex (`0xa4ec`). Both are validated and normalized before the initial check, post-switch check, post-signature check and identity linking. This fixes the reported `l.toLowerCase is not a function` after GoodWallet pairing. Malformed network responses remain rejected.
- Provider selection is in memory; server sign-in persists through an HTTP-only cookie. The signed-in account menu shows identity status, View profile, Switch wallet and Sign out. Connection choices appear only for guests or an explicit wallet switch. Signing out revokes Arcadia's session and disconnects an active GoodWallet transport.
- The browser-wallet action supports injected Celo wallets and MiniPay. All gameplay requires sign-in through one of these transports and a verified GoodDollar identity.
- Pairing URIs contain ephemeral secrets. They stay in the browser, are never sent to Arcadia's API, and are masked in saved screenshots. The live-relay test disables Playwright tracing.

## Upstream verification

GoodDollar's official [GoodDAPP source](https://github.com/GoodDollar/GoodDAPP/tree/75f9c1f45d63e358216ed81f65cadd7f7c38388c) was reviewed at commit `75f9c1f45d63e358216ed81f65cadd7f7c38388c`. Its WalletConnect client supports v2, Celo and `personal_sign`; its routing handles the `uri` query parameter. Arcadia uses its own project ID supplied by the user.

## Acceptance checks

Unit tests cover approval, session reuse, cancellation before initialization finishes, late URI and approval cleanup, serialized retries, timeout and deep-link validation. The opt-in production-browser test uses Reown's real relay to render a QR, validate the GoodWallet link, cancel, retry and return to the locked wallet gate without making any authentication request. Run it with `ARCADIA_LIVE_WALLETCONNECT_SMOKE=1 pnpm test:e2e` after a build.

Browser regressions also complete real SIWE/server verification using generated test accounts and numeric network responses. They verify that an already-selected numeric Celo network needs no switch, a numeric wrong network switches successfully, and a network change during signing still blocks authentication. These tests exercise the shared sign-in code with a controlled provider; they do not replace a physical GoodWallet acceptance check.

The first live-relay check failed because the workstation's DNS could not resolve WalletConnect's relay domains. Google public DNS over HTTPS returned valid addresses. Chromium's test-only `PLAYWRIGHT_HOST_RESOLVER_RULES` override, using a fresh public answer for the original relay hostname, allowed the real relay test to pass. TLS hostname verification and the actual relay were retained. No IP address or alternate resolver is hardcoded into the app. Re-query public DNS before reusing this diagnostic override because relay addresses can change.

The same functional check passed on production `https://g.arcadia.uno` after deployment: favicon metadata, loaded header logo, two real relay pairings, GoodWallet links, cancellation/retry, released guest controls and mobile layout. No authentication request was made. Evidence is in `docs/evidence/goodwallet-production-smoke.json`; reproduce with `node scripts/check-goodwallet.cjs` and the documented browser/DNS environment settings if needed.

Physical GoodWallet and MiniPay devices, actual GoodWallet signature approval, and real identity-link transactions remain first-user acceptance checks. No mainnet tokens were sent during development. Pairing smoke tests do not establish completed device sign-in; current results are recorded in `docs/evidence/mvp-release-checks.json`.

## Profile and GoodDollar recognition

`/profile` shows daily XP, streak, latest result, playing wallet and any tournament entry. `usePlayerAccount` shares account loading and cross-tab refresh behavior with gameplay. `useTournamentAccount` shares a single address-bound tournament/identity result between the game and its account menu; stale responses from an earlier account are ignored.

Identity classification uses the server's Celo registry result: a verified root equal to the playing address is a **Verified GoodDollar wallet**; a different verified root is **Linked to GoodDollar**; a successful unverified result is **GoodDollar not linked**. Loading or unavailable checks have separate states. The wallet application's name does not establish verification.

For an unverified player, `IdentityLink` asks for the verified source address, checks it server-side, connects that source through GoodWallet or a browser wallet, and requires the selected account to match. The server prepares `connectAccount(playingAddress)` only from a verified root and rejects a target that already has a verified identity. Pasting an address never updates ownership or eligibility. The user approves the on-chain transaction; the Arcadia login stays with the playing wallet. The profile reports submission and waits for a fresh registry check before showing a confirmed link. No real linking transaction was submitted by the agent.
