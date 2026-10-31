# Arcadia GoodBuilders MVP

This is the separate GoodBuilders edition of Arcadia.

Release scope: daily genre tournaments, mixed games and verified-wallet play. See the [MVP release and operations guide](docs/mvp-release.md).

- Landing: `https://g.arcadia.uno/`
- Game: `https://g.arcadia.uno/app`
- Profile: `https://g.arcadia.uno/profile`
- Legacy Celo product: `https://celo.arcadia.uno` remains separate and unchanged.

## Current MVP

Arcadia is a mobile-first quiz arcade on Celo. Sign in with a verified GoodDollar wallet (or link a playing wallet), confirm free launch-week entry, and choose General, Maths, Crypto or Movies. Each genre has 500 questions across four difficulty tiers.

Play four full-XP genre games per UTC day, then mixed games that also count toward tournament standings. The first five mixed rates are 75%, 50%, 25%, 10%, 10%; every later game is capped at 5 XP. Each game has ten questions, ten seconds per answer, short feedback and automatic progression.

Launch-week entry requires a wallet-approved zero-G$ approval on Celo. It grants no spending allowance; network fees may apply. Pending transactions can be recovered without resubmitting. Buy G$ links open Uniswap on Celo. Future weekly entry is planned at US$1 worth of G$, but paid collection is not active.

The original floating-island artwork uses Blender, compressed GLBs and lightweight WebP fallbacks. Home, tournaments, rankings, rewards and profile share desktop/mobile navigation. Timed questions remain 2D. Profile includes wallet/identity status, tournament progress and private game history.

Scores, answer keys, deadlines and XP are controlled by Next.js route handlers with libSQL/Turso persistence. Wallet sign-in supports GoodWallet through WalletConnect and MiniPay/injected Celo wallets. Identity roots share daily limits. An authorized run can finish through an identity RPC outage, and duplicate completion never credits XP twice.

Escrow `0x876b0684b3d156434c3fc83dc807ec274c3c9273` holds the recorded 6,426.91913403696607823 G$ sponsor deposit. Current tournaments award XP only; prize distributions and claims are inactive. The funding transaction is [verifiable on Celo](https://celoscan.io/tx/0x1ff79bc4fc93f2e2b77af36427a3a23e2ed6ac193e1077cf37a5aa4f474beeda).

The founding week runs October 30–November 6, 2026 UTC. Operators must configure paid collection and publish a future tournament before opening the next weekly pass. Existing daily/practice records and earlier scoring snapshots are retained; new games use the single tournament flow.

The preserved `lib/escrow-artifact.json` is the exact funded deployment artifact. Its source hash references the prototype before the owner-selected SPDX header change; the current original Solidity source is marked UNLICENSED. The deployed bytecode has not been replaced.

## Source availability

**All rights reserved. This project is not open source and does not use MIT.**
The repository is public for inspection and evaluation. Reuse of original code or assets requires written permission, subject to applicable law and hosting-platform terms. Third-party licenses remain in force. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).

## Run

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000` and `http://localhost:3000/app`.

Without an environment file, local sign-in accepts the local request origin. If copying `.env.example`, set `NEXT_PUBLIC_SITE_URL` and `ARCADIA_AUTH_ORIGIN` to `http://localhost:3000` for development. Production uses `https://g.arcadia.uno`. Preview deployments need their own exact `ARCADIA_AUTH_ORIGIN`. Smart-wallet checks use the Celo mainnet RPC from `ARCADIA_CELO_RPC_URL`; EOA verification runs locally.

GoodWallet requires `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, a public Reown project ID. Allow the app origin in that project's Reown settings, and rebuild after changing the ID. The SDK loads only when Connect GoodWallet is chosen. See [GoodWallet integration](docs/goodwallet-connection.md).

## Question bank

Read the [content and provenance notes](docs/question-bank-notes.md). Editorial answer-key exports are generated locally and excluded from Git. `lib/question-bank.ts` exports the classic 150 plus 2,000 category questions from `lib/trivia-bank.json`. Rebuild the latter offline with `python3 scripts/build-trivia.py`, then regenerate the private answer keys with `pnpm questions:export`. Frozen inputs and review corrections live in `data/trivia/`. Saved attempts retain their questions. Difficulty labels await player calibration.

`pnpm questions:stats` uses a configured database to write a private accuracy/timing report. See the [MVP checklist](docs/mvp-checklist.md) and [device/player pilot guide](docs/player-pilot.md) for the remaining human acceptance checks.

## Brand kit

The original Gateway A logo, outlined wordmarks, profile and website banners, social card, app icons, color tokens, and two-page PDF guide are in [public/brand](public/brand/README.md). Download the complete kit at `/brand/arcadia-brand-kit.zip`; preview `/brand/arcadia-brand-board.png`. The app header, favicon and sharing metadata use the same identity.

## Verify

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
# Optional local Solidity checks (Foundry required):
cd contracts
forge test
```

Browser tests use the production build, port 3046, generated test wallets, a fresh temporary database and a test tournament. Free-entry tests need the launch-week server date (or a controlled server clock); they must not bypass production entry checks. They do not use real wallet keys or transfer tokens. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to reuse an installed Chromium binary. Test screenshots are written under `test-results/`.

Set `ARCADIA_LIVE_WALLETCONNECT_SMOKE=1` to include the optional real-relay GoodWallet pairing/cancellation test. It needs external network access and the configured Reown project; it does not approve a wallet or sign a message.

For workstation DNS diagnosis only, `PLAYWRIGHT_HOST_RESOLVER_RULES` passes Chromium host rules to the test browser. Use a fresh verified public DNS answer and preserve the hostname; this setting does not affect the deployed app.

Background account reads never create or rotate authentication cookies. This prevents a delayed first-load response from replacing the browser binding during wallet sign-in or clearing a newer session.

## Planned refundable weekly entry

Arcadia is intended as a non-gambling knowledge game. The planned weekly buy-in is a refundable deposit of US$1 worth of G$. Every participant receives the original G$ amount back at week end regardless of results, with final weekly XP awards confirmed then. Player principal must remain fully reserved and cannot fund prizes or operating costs; network fees are separate. Deposit collection, refunds and weekly XP finalization are still to be implemented. XP currently appears during play. This describes the intended mechanics rather than a verified legal classification.
