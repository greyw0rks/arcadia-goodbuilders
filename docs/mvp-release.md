# Free launch-week MVP release

Canonical site: `https://g.arcadia.uno`; Play: `/app`. The legacy `celo.arcadia.uno` product remains separate. The user expanded the original free-play MVP with a floating arcade UI, a small funded escrow, transaction-approved free entry and a planned US$1 weekly G$ pass.

## What is included

- One game flow: connect and sign in, verify or link a GoodDollar identity, confirm weekly entry, then choose a daily genre. Four genre games earn full XP; mixed trivia follows automatically and also counts toward tournament standings.
- General, Maths, Crypto and Movies each contain 500 questions, 125 per tier. Every game uses ten questions in a 3 easy/3 medium/2 hard/2 extremely hard progression, shuffled options, 10-second server deadlines and 1.2 seconds of answer feedback before auto-next.
- Genre games 1–4 earn 100%. Mixed games 1–5 earn 75%, 50%, 25%, 10%, 10%; later games use 10% capped at 5 XP. Base XP is 50 for finishing plus 10 per correct answer, rounded down after multiplication. Perfect-game earnings are 150, 150, 150, 150, 112, 75, 37, 15, 15, 5, 5… Counts and genre reset at 00:00 UTC; weekly scores remain.
- Launch week runs 30 October–6 November 2026 UTC. Joining requires the playing wallet to approve exactly zero G$ to escrow `0x876b0684b3d156434c3fc83dc807ec274c3c9273`. This grants no spending allowance and costs zero G$; wallet network fees may apply. The backend verifies Celo chain ID, successful receipt, sender, token, exact calldata, zero native value, matching Approval log, canonical block, two confirmations and the tournament time window. Proof and enrollment are saved atomically; transaction hashes cannot be reused across identities/tournaments. Pending hashes persist locally and can be recovered manually.
- Buy G$ opens Uniswap on Celo with token `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` selected. Users review and approve any swap in their own wallet.
- Wallet sign-in uses one-use SIWE, EOA/EIP-1271 signatures and revocable sessions. GoodWallet connects through WalletConnect; MiniPay/injected Celo wallets use the browser option. Verification comes from the on-chain registry, never a provider label, pasted address or token balance. Linked wallets share genre, game counts and standings.
- In-flight authorization is stored so identity-service outages cannot interrupt timed actions. Stale tabs, expired games, retries and duplicate completion are handled by the server. Legacy daily/practice attempts and scoring snapshots remain readable/finishable; their new-start modes are retired.
- The home portal, tournament trophy, reward chest and podium are original Blender assets. Draco GLBs load lazily with WebP fallbacks, limited DPR, no real-time shadows and rendering paused offscreen, hidden or idle. Reduced motion/save-data and WebGL failure keep static artwork. Timed questions remain 2D.
- Desktop sidebar and mobile bottom tabs connect Home, Play, Tournaments, Rankings, Rewards and Profile. Profile shows tournament progress, wallet/identity and private game history. Results show earned XP, day game number, multiplier and cap. Rankings include the user's position outside the top 50.
- Rewards shows actual Celo wallet/escrow balances, the funding receipt and recorded claim history. The Gateway A favicon remains; Space Grotesk and Inter are self-hosted.
- Turso persistence, request limits, backup/restore checks, immutable tournament schedules and protected cleanup remain enabled. Correct answers and authoritative scoring stay on the backend.

The recorded sponsor deposit is 6,426.91913403696607823 G$, confirmed in `docs/evidence/escrow-funded.json`. It remains separate from the current XP tournament: no G$ prizes or claims are offered. Paid weekly passes will cost US$1 worth of G$, but collection is not active. Future free enrollment is blocked after the launch-week deadline. Configure payment collection/quotes and publish the next weekly tournament before opening paid entry; do not route entry payments into the sponsor escrow implicitly.

## Production configuration

Vercel project `arcadia-goodbuilders`, project ID `prj_eWkiWypuGyx3HCnk3U7DbOVNkLaz`, team `greyw0rks-projects`. The verified custom domain is attached to this project. Node.js is pinned to the locally tested 22.x runtime.

- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` provide durable storage. `ARCADIA_DATABASE_URL` / `ARCADIA_DATABASE_AUTH_TOKEN` take precedence when set.
- `ARCADIA_AUTH_ORIGIN=https://g.arcadia.uno` and `NEXT_PUBLIC_SITE_URL=https://g.arcadia.uno` bind production sign-in and site metadata.
- `CRON_SECRET` is stored as a Vercel production Secret. Never put it into client code or logs.
- `ARCADIA_CELO_RPC_URL` defaults to `https://forno.celo.org`; chain ID must be 42220.
- `ARCADIA_TOURNAMENT_ID` is optional and defaults to `founding-week-2026-10-30`.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is the user's public Reown project ID. It is configured in production and compiled into the client. Allow `https://g.arcadia.uno` in Reown; a change requires rebuilding.

The standard `arcadia-goodbuilders.vercel.app` alias redirects to the canonical domain. Preview sign-in requires its own exact origin; do not use the production origin as a wildcard.

Cloudflare is authoritative for `arcadia.uno` (`aida.ns.cloudflare.com`, `ishaan.ns.cloudflare.com`). The user's `g` record resolves through Cloudflare's proxy. Vercel's domain inspector previously retained obsolete registrar nameservers; direct public DNS showed Cloudflare. Keep the legacy `celo` record separate.

## Tournament operations

Founding week runs October 30 00:00 through November 6 00:00 UTC. Closing blocks entry and late scoring; unfinished games earn no XP. Create a future tournament without changing source or existing rules:

```bash
node --env-file=.env.production.local --import tsx scripts/tournament.ts list
node --env-file=.env.production.local --import tsx scripts/tournament.ts create \
  --id week-two-2026-11-06 --title "Week two" \
  --start 2026-11-06T00:00:00Z --end 2026-11-13T00:00:00Z
```

Creation rejects past starts, invalid ranges and duplicate IDs. It does not activate a tournament. At the handover, set the production `ARCADIA_TOURNAMENT_ID` to the new ID and redeploy. Do not switch while an announced tournament is still open. Existing scores stay in their original tournament.

## Backup and recovery

Before releases and during active use, refresh the private local snapshot:

```bash
node --env-file=.env.production.local --import tsx scripts/database-backup.ts
```

The source is read through a consistent transaction. The script creates a new file under `.data/backups/` with mode 0600, refuses to overwrite an existing file, restores schema/data, compares every table's content hash and count, and checks database integrity and foreign keys. It does not modify production. Evidence contains counts and hashes, never player records or credentials.

`docs/evidence/database-restore.json` records the latest production snapshot check. The latest snapshot contains the current production records; counts and hashes are recorded without exposing row data. `docs/evidence/entry-migration.json` confirms that adding the entry-proof table preserved all 15 original tables in a local copy. The populated recovery test separately restores daily XP, a wallet session, tournament standings and committed answers, then reads those through the application stores.

Backups contain private player/session data. Keep them out of source/deploy uploads and retain a protected copy outside this workstation before relying on them as disaster recovery. For a production restore, use a new database, validate known account/standings records against the snapshot, then change the production database configuration and redeploy. Keep the old database until verification completes; never restore over the active database as a drill.

## Cleanup and abuse controls

`vercel.json` schedules `/api/maintenance` daily at 03:00 UTC. Vercel supplies the secret bearer token; unauthenticated calls fail. Hobby scheduling can run within the scheduled hour. The route deletes expired request-limit windows, challenges and sessions, unfinished attempts expired more than seven days ago, and practice results older than 30 days. Scored daily/tournament results and wallet progression are retained.

Fixed-window limits are stored in libSQL and shared across instances:

| Operation | Limit |
| --- | --- |
| Sign-in challenge | 10 per 5 minutes, per browser and wallet |
| Signature verification | 20 per 5 minutes, per browser and wallet |
| Game start/resume | 20 per minute, per player and verified identity root in every mode |
| Game action | 120 per minute, per player and tournament identity root |
| Tournament refresh | 60 per minute per player |
| Tournament entry preparation/confirmation | 30 per minute per player |
| Identity link preparation | 10 per minute per player |

Limits return HTTP 429 with `Retry-After`. These are basic free-play abuse controls, not a claim that automation or a finite question bank cannot be exploited. Reassess before attaching money to scores.

## Verification and operating limits

The release evidence records unit/production-browser/build results and deployment status. Browser tests use generated keys, a local identity RPC, and a temporary test tournament; the launch-entry tests must run within the configured free-week window (or with a controlled server clock). The populated-data recovery test uses a separate local database. A deployed EIP-1271 proof exists on local Anvil.

Physical MiniPay/GoodWallet devices and a real identity-link transaction have not been exercised in this session. Gameplay remains locked until wallet sign-in and GoodDollar verification succeed. Check actual devices during the first-user rollout and do not claim adoption or retention before measuring real players. No mainnet tokens were sent by the agent.

Background account reads never create or rotate authentication cookies. This prevents a delayed first-load response from replacing the browser binding during wallet sign-in or clearing a newer session.

## Planned refundable weekly entry

Arcadia is intended as a non-gambling knowledge game. The planned weekly buy-in is a refundable deposit of US$1 worth of G$. Every participant receives the original G$ amount back at week end regardless of results, with final weekly XP awards confirmed then. Player principal must remain fully reserved and cannot fund prizes or operating costs; network fees are separate. Deposit collection, refunds and weekly XP finalization are still to be implemented. XP currently appears during play. This describes the intended mechanics rather than a verified legal classification.
