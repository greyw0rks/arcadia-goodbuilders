# Arcadia MVP checklist

Current scope: the floating arcade release at `g.arcadia.uno`. The separate `celo.arcadia.uno` product remains unchanged. Final verification and deployment identifiers are recorded in `docs/evidence/arcade-release-checks.json`.

## Implemented

- [x] One Play flow with mandatory wallet sign-in and a directly verified or on-chain-linked GoodDollar identity.
- [x] Free launch-week entry requires a wallet-approved zero-G$ Celo approval, verified on the backend before enrollment or a new game.
- [x] Pending entry recovery, rejection/revert feedback, receipt ownership, exact zero allowance, launch-week window, canonical block and two-confirmation checks.
- [x] Buy G$ links open Uniswap with Celo and the exact G$ token selected; no G$ is needed for the free launch week, though network fees may apply.
- [x] General, Maths, Crypto and Movie Trivia, each with 500 questions and 125 at each of four difficulty levels.
- [x] Choose one genre per UTC day; four completed games earn full XP, then mixed trivia unlocks automatically.
- [x] First five mixed games use 75%, 50%, 25%, 10%, 10%; later games use 10% with a maximum of 5 XP. Mixed XP counts toward standings.
- [x] Ten questions per game, 10-second deadlines, 1.2-second answer feedback and automatic progression/result saving.
- [x] Server grading, private answer keys, stored question/answer shuffles, duplicate-safe credits and shared identity limits across linked wallets.
- [x] Start-time authorization lets an active game finish through a Celo identity RPC outage.
- [x] Wallet/profile recovery, GoodDollar linking, personal rank, private game history and real wallet/escrow balances.
- [x] Original Blender islands, compressed GLBs, static WebP fallbacks, lazy 3D, pause/replay, reduced motion and WebGL failure recovery.
- [x] Desktop sidebar, mobile bottom navigation, focused 2D questions, result reveal, visible daily game number and XP rate/cap.
- [x] Gateway A tab/app icons, self-hosted Space Grotesk/Inter and the violet/blue/mint/gold/coral palette.
- [x] Durable Turso storage, database-backed limits, protected cleanup, backup/restore and additive entry-table migration checks.
- [x] Previously funded escrow holds the recorded 6,426.91913403696607823 G$ sponsor deposit; receipts are available in Rewards.

## Still required

- [ ] Implement refundable US$1-equivalent G$ weekly deposits: exact quotes, reserved principal, receipt verification and full end-of-week refunds of the original G$ amount regardless of results. Publish the next tournament only when collection and refunds are ready.
- [ ] Implement weekly XP finalization, then enable separately funded reward allocations and G$ claims in a reviewed release. Current XP is not redeemable and the funded escrow is not advertised as this tournament's prize.
- [ ] Confirm GoodWallet and MiniPay sign-in, free-entry approval and linking on physical devices.
- [ ] Run a small real-player pilot and record feedback.
- [ ] Calibrate editorial question difficulty after enough first-exposure responses.

Launch week runs 30 October–6 November 2026 UTC. Earlier daily/practice games and scoring remain historical records; new starts use the unified tournament flow. Automated and simulated-wallet checks do not establish physical-device acceptance or human feedback. See [the pilot guide](player-pilot.md) and [release operations](mvp-release.md).

## Planned refundable weekly entry

Arcadia is intended as a non-gambling knowledge game. The planned weekly buy-in is a refundable deposit of US$1 worth of G$. Every participant receives the original G$ amount back at week end regardless of results, with final weekly XP awards confirmed then. Player principal must remain fully reserved and cannot fund prizes or operating costs; network fees are separate. Deposit collection, refunds and weekly XP finalization are still to be implemented. XP currently appears during play. This describes the intended mechanics rather than a verified legal classification.
