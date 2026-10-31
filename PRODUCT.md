# Arcadia GoodBuilders

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, React, TypeScript and libSQL/Turso. The backend owns questions, committed answers, deadlines, scoring and tournament sequencing. Celo wallet authentication supports EOA/EIP-1271 signatures; GoodDollar verification comes from the on-chain registry. React Three Fiber/Drei and Motion support selected visual moments. Assets are authored in Blender and exported as Draco GLBs with WebP fallbacks.

## Users and Purpose

A mobile-first knowledge arcade for verified GoodDollar players. General, Maths, Crypto and Movie Trivia each contain 500 questions across four difficulty levels. Users return for knowledge challenges, personal improvement and weekly community standings.

## Current Product

The canonical edition is g.arcadia.uno. The separate celo.arcadia.uno product must remain unchanged. Home, Play, Tournaments, Rankings, Rewards and Profile are real routes. The repository is public for evaluation under an all-rights-reserved notice; it is not open source.

Every new game requires wallet sign-in and a direct or linked GoodDollar identity. The playing wallet signs a zero-G$ approval to join launch week (30 October–6 November 2026 UTC); the backend verifies its receipt, exact amount, sender and two Celo confirmations. No token allowance is granted, although network fees may apply. Pending entry transactions have recovery controls. Buy G$ opens Uniswap with Celo and the correct token selected.

After joining, choose one genre per UTC day. Four completed genre games earn full XP; mixed trivia follows automatically. The first five mixed rates are 75%, 50%, 25%, 10%, 10%; later games are capped at 5 XP. Mixed XP counts toward standings. Every game has ten questions (3 easy/3 medium/2 hard/2 extremely hard), ten seconds per question and automatic advancement after brief feedback. Daily counts reset at midnight UTC. Linked wallets share identity-root allowances.

Historical daily/practice games remain preserved, but new starts use one tournament flow. Start-time authorization lets an active run finish through a transient identity-service outage. Duplicate completion cannot credit XP twice. Profiles show tournament progress, wallet/identity and private recent-game history. Rankings retain the player's position outside the top list.

## Money and Planned Entry

The sponsor escrow contains the recorded 6,426.91913403696607823 G$ deposit. Current games award XP only; payouts and G$ claims are inactive. Wallet and escrow balances are checked live or explicitly unavailable.

The latest user decision makes future weekly entry a refundable deposit equivalent to US$1 in G$, returned in full at week end regardless of winning, losing or performance. Return the original G$ amount and disclose network fees separately. Player principal must remain fully reserved and cannot fund prizes or operations. Current XP is visible during play; final weekly XP awards and refunds are planned. Deposit collection, refunds and claims are not implemented. Describe the non-wagering intention without presenting it as a verified legal classification.

## Brand and Accessibility

The user chose a floating arcade world, rounded glossy original geometry, Space Grotesk headings and Inter body/scores. Gateway A branding remains. Use warm off-white for the application, navy for text, violet/blue for brand, mint/coral for feedback and gold for achievements. Original logo wordmarks remain outlined Manrope.

The core game must work without 3D, hover, motion or sound. Lazy scenes have static fallbacks, pause/idle controls and reduced-motion support. Timed questions stay lightweight. Controls have persistent accessible names, visible focus and explicit non-color feedback.

## Validation and Limits

Counts in docs/goodbuilders-metrics.md are a dated early production snapshot that may include owner/testing activity. Physical MiniPay/GoodWallet acceptance, a real-player pilot and empirical question calibration remain open. Do not invent adoption, retention, prizes, paid collection or refunds.
