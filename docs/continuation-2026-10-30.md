# Arcadia GoodBuilders continuation

Historical recovery pass. The user subsequently selected a complete free-tournament/XP launch; [the MVP release guide](mvp-release.md) supersedes the remaining-work list below.

Workspace: `/home/greyw0rks/arcadia-goodbuilders`. This project is separate from Arcadian and from the legacy `celo.arcadia.uno` app. This workspace currently has no Git repository. The source before this continuation is archived at `/tmp/arcadia-goodbuilders-before-recovery-20261030.tar.gz`; the archive excludes environment files and player databases.

## Current implementation

- Five-question daily play, daily XP/streaks, optional SIWE wallet accounts, duplicate-safe guest merging and cross-device progress.
- Server-owned attempts and first-answer commitment. The old answer-array scoring routes return 410. Questions expire after 20 seconds; daily attempts close at UTC midnight and tournament attempts close with the tournament.
- Ten-question free tournament games. Games 1–4 earn full XP, then 75%, 50%, 25%, and 10% from game 8. Only completed games advance the count. Identity-root ownership preserves counts across linked wallets.
- Shared standings use tournament XP, correct answers, earliest last completion, then address as tie breakers. Daily XP does not affect tournament standings.
- GoodDollar identity is read from the Celo registry on each protected tournament operation. The linking endpoint only prepares `connectAccount`; the selected verified root must submit it from its wallet, and eligibility comes from a later on-chain read.
- Draft Solidity escrow, Merkle allocation helpers and receipt validation exist. No settlement worker or reward API connects them to the game.

## Changes in this continuation

- Expired attempts can be read by their owner without exposing questions or allowing late scoring. Other players still receive 403.
- Game-action conflicts return the authorized current state with HTTP 409. The browser resumes that state and retries a read instead of repeatedly submitting an obsolete answer.
- Expiry unlocks game/account controls, and expired daily games offer a route to today's quiz.
- Practice completion explicitly says that daily XP and streaks are unchanged.
- Added regression coverage for stale tabs, closing-time UI, lost completion responses and practice credit; tightened the tournament multiplier assertion.
- Updated the older product and handoff documents to reflect the actual code.

## Existing evidence

- `docs/evidence/gooddollar-celo.json`: G$ token, 18 decimals, registry resolution and deployed code checked at Celo block 81484236 on October 30. This is historical chain evidence, not a current funding check.
- `docs/evidence/database-restore.json`: an initial consistent snapshot restored locally with matching table counts. Player/game tables were empty then. This does not establish scheduled backups or restoration of populated production data.
- `docs/evidence/smart-wallet.json`: deployed EIP-1271 contract accepted a valid signature and rejected an altered message on local Anvil, chain 31337. This is not physical MiniPay or Celo smart-wallet evidence.

## Verification

Current check results are recorded in `docs/evidence/continuation-checks.json`. Browser tests use generated wallets, a local identity RPC fixture and an isolated temporary database. The expiry UI test supplies a closing-time response; real timestamp enforcement and owner isolation are exercised in the database tests. No real funds are used.

## Next work

1. Add durable abuse controls before rewards: committed answers prevent edits and retries, but the question bank is finite, game selection is shared per sequence, and there is no reward-grade automation or request-rate protection.
2. Test real MiniPay/GoodWallet devices, on-chain link confirmation, revocation and re-linking. Local fixtures do not validate actual wallet transaction support.
3. Recheck production storage configuration and exercise backup/restore with populated data, then document scheduling and recovery ownership. Do not print database credentials or overwrite production in a restore drill.
4. Replace the fixed founding-week dates with an explicit operator workflow before the next tournament. Current dates are October 30 00:00 through November 6 00:00 UTC; browser tournament tests require that window to be open.
5. Review and integrate settlement only after funding/rules are confirmed: freeze eligible results, persist an immutable allocation plan, verify the deployed escrow and token, publish claim proofs, reconcile canonical receipts, and exercise refunds. Physical wallet testing and an independent contract review remain necessary before real-value use.
6. Run a small real-user return test before making retention/adoption claims.

No deployment, real identity-link transaction, escrow deployment, funding or G$ transfer was performed in this continuation.
