# Device acceptance and first-player pilot

Start at https://g.arcadia.uno/app. Use 5–10 volunteer players across Android and iPhone, with at least one desktop-to-phone QR flow. This guide is ready to run; no participants have been recruited or contacted by the agent.

## Device acceptance

| Flow | Pass condition |
| --- | --- |
| GoodWallet on the same phone | Open GoodWallet, approve Celo and the sign-in message, return to Arcadia, see the correct account and profile. |
| GoodWallet on another device | Scan Arcadia's QR from GoodWallet, complete approval, see the browser become signed in. |
| MiniPay browser | Sign in through the browser-wallet action, open the profile, reload and retain the same account. |
| Cancel | Reject pairing or signing, then retry successfully; the wallet gate remains locked until sign-in and GoodDollar verification succeed. |
| Verified GoodDollar wallet | Profile reports verified without asking to link another address. |
| Unverified playing wallet | Profile offers linking; a wrong or unverified source is rejected. |
| Separate verified source | Wallet owner reviews the Celo transaction and any network fee, approves it, then rechecks identity after confirmation. The playing account stays the same and the profile shows the linked root. Record only the public transaction hash for evidence. |
| Sign out / restore | Sign out, then sign in with the same wallet on another device and recover the same daily progress. |

## Player journey

1. Confirm that signed-out and unverified wallets cannot start a daily, practice or tournament game. Sign in and verify or link your GoodDollar identity.
2. Complete today's five-question quiz. Confirm feedback, automatic progression, saved XP and restoration in your profile.
3. Enter a free tournament using a verified or linked identity. Read the difficulty mix and multiplier rules.
4. Choose a genre, finish four games and confirm the switch to mixed games. Check the first five normal multipliers and the later 10 XP cap; daily XP remains separate. At midnight UTC, confirm the genre and daily allowance reset while tournament XP remains.
5. Reopen the app, resume an unfinished game, and confirm that submitted answers cannot be changed.

Record device/OS, wallet app, route and step, expected/actual result, whether retry recovered, and any public transaction hash. Never collect a recovery phrase, private key, authentication cookie or WalletConnect pairing URI.

Ask each player: Was the next action clear? Which question had ambiguous wording or more than one plausible answer? Which question felt misplaced in difficulty? Was 10 seconds enough to read and answer? What prevented finishing a game?

## Closeout

Use pseudonymous tester labels and question IDs/revisions. Fix reproducible blockers before expanding the pilot. Summarize human feedback separately from automated results. Rerun `questions:stats` with the production environment and review flags only when enough first exposures exist. This small pilot tests usability; 5–10 volunteers are not enough to calibrate all 2,150 questions at the report's 30-owner threshold.
