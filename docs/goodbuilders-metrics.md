# Arcadia GoodBuilders — application baseline

Snapshot: **31 October 2026, 14:38 UTC**. GoodDollar registry counts checked on Celo at **15:12 UTC**. This baseline covers `g.arcadia.uno` only; the separate legacy Celo application is excluded.

These are very early operational counts and may include owner/testing activity. They are not claims of independent users, organic adoption or retention. Browser-test accounts are excluded because automated tests use separate temporary databases.

| Metric | Count | Definition |
| --- | ---: | --- |
| Registered wallet accounts | 2 | Unique signed-in wallets recorded in production |
| Active wallet accounts, past 7 days | 1 | Registered wallet with a completed recorded game/result |
| GoodDollar-verified identities | 1 | Distinct verified registry root among the two registered wallets |
| Recorded completed game attempts | 3 | Production completed attempts, including legacy daily play |
| Completed tournament games | 1 | Completed tournament attempts in the snapshot |
| Tournament entrants | 1 | Recorded identity-root enrollment |
| Confirmed setup transactions | 3 | Escrow deployment, token approval and funding; not user gameplay transactions |
| Entry-fee revenue | US$0 | Paid weekly checkout is inactive |
| Users paid G$ rewards | 0 | No reward receipts recorded; claims are inactive |
| Player G$ spending | 0 G$ | No paid entries or purchases recorded |
| Confirmed sponsor deposit | 6,426.91913403696607823 G$ | Funding, not revenue, player spending or a reward payout |

Weekly retention has **not yet been measured**: there is no mature seven-day cohort for this new edition. A numeric application field may use 0 only with that qualification; it is not an observed 0% retention result.

## Public verification

- [App](https://g.arcadia.uno)
- [Tournament rankings](https://g.arcadia.uno/leaderboard)
- [Source repository](https://github.com/greyw0rks/arcadia-goodbuilders)
- [Celo escrow](https://celoscan.io/address/0x876b0684b3d156434c3fc83dc807ec274c3c9273)
- [Deployment](https://celoscan.io/tx/0xbac352770878d00f7819eadd14c9821522dd803ba382ab26c8404f1dce2c37a0)
- [Approval](https://celoscan.io/tx/0x04d06422a3cb9f7cef97526c78b2b6052116dcecdd55691593459fc607bf4cb9)
- [Funding](https://celoscan.io/tx/0x1ff79bc4fc93f2e2b77af36427a3a23e2ed6ac193e1077cf37a5aa4f474beeda)

This is a manually verified snapshot, not a live analytics dashboard. Database row data and authentication records remain private. Before a pilot, add aggregate weekly metrics for activated identities, completed games, seven-day return cohorts, transaction receipts and G$ flows, with explicit exclusion of owner/test activity.
