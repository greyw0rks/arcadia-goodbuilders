# Floating arcade world — user-directed visual pass

User supplied the complete direction after the daily tournament release was deployed. Build a game-first 3D quiz arcade layered over a warm off-white 2D application. Preserve Gateway A branding and the agreed daily scoring: four chosen-genre games per UTC day, then mixed games at 75/50/25/10/10%, and 10% capped at 5 XP afterward (the user reduced the previous 10 XP cap during this pass). Every game requires wallet sign-in and GoodDollar verification.

Palette: #7564F6, #2D83F7, #55E6A5, #FFC857, #FF7A70, #17182B. Change application headings to Space Grotesk and UI/body to Inter; use tabular numerals for data. The supplied layout fixes compact desktop left navigation and mobile bottom navigation. Home, Play, Tournaments, Rankings, Rewards and Profile must lead to real screens.

Priorities: original floating island and Gateway A portal home scene; trophy tournament lobby with real participation and XP; lightweight 2D quiz with short answer feedback; XP reward reveal and explicit game number/rate; top-three podium and a visible personal rank. Rewards screens show confirmed funding and real claim status. G$ payout and claim actions remain disabled until separately implemented, and XP celebrations must not imply G$ earned.

Add React Three Fiber, Drei, Three.js and Motion. Retain the working authoritative Next.js/TypeScript scoring, libSQL persistence and verified-wallet sign-in while applying the visual layer; the technology recommendations do not require an unrelated database or wallet migration. No broad monorepo restructuring.

Original production 3D assets should be generated with Blender if available, exported as small GLBs, with rendered static fallback images and source/provenance. Lazy load scenes, limit mobile DPR/shadows/particles, pause when offscreen/hidden/idle, support reduced motion and WebGL failure, and exclude heavy 3D from timed questions. Respect the 10-second clock and 1.2-second answer progression.

The optional Impeccable concept seed ran degraded (key 2ec417a4); the user’s precise floating-island direction, materials, palette, fonts and navigation take precedence. No redundant direction approval is needed. Impeccable new-work and Animate skills are being used. New-work explicitly authorizes fresh finish-review and documenter agents for the final review; do not delegate implementation otherwise.


## Confirmed flow and entry revisions

- One Play flow: four chosen-genre tournament games, followed automatically by mixed trivia. The separate daily quiz and mixed practice options are retired from the UI and new-start API. Previously authorized attempts remain finishable through the action API.
- Mixed-game XP continues counting toward tournament standings. After five mixed games, the per-game cap is 5 XP. Stored earlier scoring snapshots and historical scores remain intact.
- Launch week (30 October–6 November 2026 UTC) has no entry fee, but joining requires a confirmed Celo transaction. Use a zero-G$ approval to the existing Arcadia escrow; it grants no spending allowance. Wallet network fees may apply. Backend checks sender, token, calldata, zero amount, matching Approval log, canonical block, two confirmations and time window. Transaction hashes cannot be reused across identities or tournaments. Pending hashes persist for recovery.
- After launch week: US$1 worth of G$ per weekly pass, not a daily fee. Paid passes remain unavailable until a separately configured payment collection and quote flow is ready. Never silently keep future entry free, transfer into the already funded sponsor escrow, or start charging without a published weekly tournament.
- Provide a Buy G$ link to Uniswap with Celo and the exact G$ token preselected. It is available to zero-balance players; buying is not required for the free launch week.

## Planned refundable weekly entry

The latest user decision makes the future US$1-equivalent G$ buy-in fully refundable at week end, regardless of results, with final weekly XP awards confirmed then. Return the original G$ amount and disclose network fees separately. Player principal must be fully reserved and cannot fund prizes or costs. Collection/refunds are not implemented; describe this as planned non-wagering knowledge play, not a verified legal classification or live refund guarantee. Current XP remains visible during play.

## Direction contract

**THESIS:** Make a familiar quiz arcade memorable through original dimensional islands while preserving a fast, readable mobile game.

**OWN-WORLD:** Warm off-white application ground, Space Grotesk and Inter, the user-pinned violet/blue/mint/gold/coral/navy palette, rounded glossy Blender geometry and Gateway A branding. No generic metaverse scenery.

**STORY:** Discover the arcade, connect and verify a wallet, confirm required weekly entry, choose a genre, complete four full-XP rounds, continue mixed trivia, then inspect results, profile and rankings. Money claims stay grounded in live implementation.

**FIRST VIEWPORT:** Desktop pairs the portal island and Play action with a concise tournament preview; mobile gives the portal and dominant Play action priority. The primary entry stage precedes genre selection. Timed play isolates questions and answers.

**FORM:** User-pinned code-led redesign; seed `2ec417a4` was degraded and does not override the supplied direction. There is no approved comp or comp-led reproduction gate. Original assets and final responsive captures are the visual evidence.

**FINISH:** Persistent names for icon navigation, readable populated standings, visible question controls, required entry before genre selection, explicit XP rates/cap, real-money truth, reduced motion and fallback coverage. Record tokens in DESIGN.md and .impeccable/design.json. No paid collection/refunds/claims are implied live.
