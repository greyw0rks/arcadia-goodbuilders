# MVP quiz content

The original mixed daily/tournament bank contains 150 items: 50 easy, 50 medium and 50 hard. The October 31 expansion adds four 500-question tournament genres: General Trivia, Maths Trivia, Crypto Trivia and Movie Trivia. Each has 125 easy, 125 medium, 125 hard and 125 extremely hard questions, for **2,150 questions overall**. Every question has a stable ID, revision, four distinct options, one answer, an explanation, a category and a difficulty label. Each new bank balances correct answer positions 125/125/125/125 before per-round shuffling.

`lib/question-bank.ts` exports the classic bank plus `lib/trivia-bank.json`; `lib/question-types.ts` defines their schema. `python3 scripts/build-trivia.py` deterministically rebuilds the four frozen banks from `data/trivia/`. `pnpm questions:export` produces a private Markdown answer key and CSV including game, tier, category and source. Exports and generator inputs are excluded from Vercel uploads. Client question payloads contain only ID, prompt and options; explanations and correct indices are returned only after an answer is committed or the question times out.

## Category games and provenance

Every tournament and mixed practice round contains 3 easy, 3 medium, 2 hard and 2 extremely hard questions. A verified identity locks one genre for its first four completed tournament games each UTC day, earning full XP. Later normal games draw 2–3 questions from every genre and use the declining XP schedule in `lib/game-rules.ts`, reaching a hard 10 XP cap after the fifth normal game. Separate mixed practice awards no XP. All starts require wallet sign-in and on-chain GoodDollar verification. Selections favour topic variety, avoid within-round duplicates and shuffle answer positions. Saved rounds resume without replacing questions. Practice records are retained for 30 days; separate rounds can repeat questions.

- **General:** current capitals and element facts from frozen CC0 Wikidata results, a curated bibliography, the earlier reviewed bank and authored science/history/sports/technology items. Capital distractors exclude all capitals listed for the country.
- **Maths:** 40 calculated problem families, with 12–13 numerical variants each. Integer and rational arithmetic avoid floating-point answer errors. Advanced questions include product-rule differentiation, integration, totients, modular inverses, binomial coefficients, matrix inverses and surjections. These are 500 distinct questions, not 500 unrelated mathematical concepts.
- **Crypto:** 175 definitions, 50 wallet-safety/Celo/GoodDollar scenarios, 100 Final Ethereum proposal references, 25 Bitcoin Script opcodes and 150 token/gas/AMM/quorum/EVM-memory calculations. EIP titles, IDs, status and source URLs are frozen in `data/trivia/sources/eips.json`; prose questions are authored for Arcadia.
- **Movies:** frozen CC0 Wikidata film metadata supplies directors, release years, music, writing, cinematography, editing, production and adaptation facts. Distractors exclude all people/works credited for the selected property. `data/trivia/film-review.json` corrects source-author/screenwriter confusion, uncredited directors, a wrong release year and a spurious editing credit; ambiguous music/source properties and a recent film are excluded. Release-year prompts do not supply the answer year. This is a metadata-based film bank, with a focus on film craft.

Wikidata data is provided under [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing); frozen query results are under `data/trivia/sources/`. Other references include the [Ethereum EIPs repository](https://github.com/ethereum/EIPs), [Ethereum developer documentation](https://ethereum.org/developers/docs/), and [Bitcoin Script reference](https://en.bitcoin.it/wiki/Script). There are no live trivia API calls or imported commercial quiz datasets. All choices received structural checks; representative items at all tiers and all selected film answers received an editorial pass. This is not independent primary-source verification of every fact.

## Difficulty and game mixing

- Easy: familiar facts, basic wallet awareness and single-step arithmetic.
- Medium: more specific knowledge, basic concepts and short applications.
- Hard: less familiar facts, specialist vocabulary or a brief multi-step calculation.
- Extremely hard: obscure factual recall, protocol details or advanced mathematical reasoning under the time limit.

These labels are provisional editorial judgments. They should later be calibrated against completion time and correct-answer rates; no empirical difficulty or perfect fairness is claimed. Questions must stay readable within the existing 10-second limit.

The classic `balanced-v1` mixer in `lib/question-policy.ts` defines the daily quiz and remains available for legacy tournament behavior:

| Mode | Easy | Medium | Hard | Topic diversity | Celo/GoodDollar |
| --- | ---: | ---: | ---: | --- | ---: |
| Daily | 2 | 2 | 1 | Five distinct topics | 1 |
| Legacy tournament | 3 | 4 | 3 | At least seven topics; at most two per topic | 2 |

Questions progress from easy to hard. Ecosystem slots vary in difficulty by seed. Remaining choices favour topics not already represented. SHA-256 ranks produce repeatable selections and option shuffles; daily seeds are shared by UTC day, and tournament seeds include the unique attempt ID. No duplicate question occurs within a game. A bank that cannot meet the published constraints fails explicitly rather than quietly serving an easier mix. No adaptive difficulty or new XP weighting is introduced. A finite bank can repeat questions across separate games.

## Rollout and compatibility

Daily date keys before `2026-10-31` use the original 50 questions so the release does not change the shared October 30 daily quiz. From October 31 UTC, daily play uses the expanded bank and mixer. New tournament attempts use `daily-genre-v2` and the 3/3/2/2 genre or mixed selection described above. Existing attempts already store full question snapshots, so changing the catalogue cannot replace their questions or answer keys. Existing attempts retain their saved questions, timing and scoring. Legacy completions on the current UTC day count toward the four-game allowance, preventing an extra allowance at rollout. New attempts save immutable daily genre/scoring policy alongside the attempt.

## Editorial review and calibration

The second editorial pass reviewed the bank for one defensible answer, plausible alternatives, units and assumptions. Twelve items are revised in `lib/question-review.ts`: pure-water boiling conditions; funded-reward prerequisites; the fee-currency contract/adapter distinction; and eight under-challenging hard items replaced with applied reasoning or more specific knowledge. The October 31 follow-up clarifies that linked-identity game counts reset by UTC day. Revised content is revision 2; historical snapshots remain revision 1. The private answer-key exports display these revisions.

`pnpm questions:stats` writes `docs/evidence/question-calibration.json`. Load the database environment explicitly, for example:

```bash
node --env-file=.env.production.local --import tsx scripts/question-stats.ts
```

The reader uses a read-only database transaction, scans the first 10,000 stored attempts, and reports if that bound truncates the dataset. It exports no wallet addresses, session tokens or owner IDs. It takes the first exposure per owner/question/mode, excludes classic practice and old content revisions, and requires 30 account/browser owners per question and mode before suggesting review. Standalone arcade rounds are eligible despite their practice flag. Tournament reporting includes both classic snapshots and the new genre banks; daily and mixed-practice reports remain separate. Owners are not necessarily distinct humans.

New answers record server response time from that question's start, excluding time spent reading prior feedback. Existing answers without timing remain missing, not zero. Times include network latency. Accuracy bands are provisional: easy 65–95%, medium 40–80%, hard 20–65%, extremely hard 15–45%; timeout rates over 25% flag the time limit for review. Old 20-second attempts are excluded, and their repeat viewers remain excluded. The report never relabels questions automatically. Empirical calibration remains pending.

## Content review and references

Questions were written for this project and reviewed for a single defensible answer, explicit units, bounded assumptions and concise explanations. Standard mathematical items can be checked directly from the calculation in each explanation. General-knowledge facts are stable reference knowledge; this pass did not independently browse a source for every item. No licensed trivia dataset was copied.

The live Celo and GoodDollar documentation was checked on October 30, 2026 for the ecosystem items:

- [Celo overview](https://docs.celo.org/learn): Ethereum layer 2 and EVM compatibility.
- [Celo gas fees](https://docs.celo.org/learn/gas-fees): eligible ERC-20 fee currencies in Celo-compatible wallets.
- [Celo transaction types](https://docs.celo.org/learn/protocol/transactions/transaction-types): the custom `feeCurrency` transaction field.
- [GoodDollar documentation](https://docs.gooddollar.org/): G$ symbol, wallet purpose and Universal Basic Income mission.
- `docs/evidence/gooddollar-celo.json`: Celo chain ID, G$ contract and 18 decimals checked on-chain in the earlier release.
- [EIP-1271](https://eips.ethereum.org/EIPS/eip-1271): contract signature validation.
- [EIP-20](https://eips.ethereum.org/EIPS/eip-20): token allowance and approval semantics.
- [USGS, Earth's interior](https://pubs.usgs.gov/gip/interior/): liquid outer core and S-waves, checked for the revised seismic question.
- [World Athletics, decathlon](https://worldathletics.org/disciplines/combined-events/decathlon): official event list, checked for the revised sports question.
- [FIDE Laws of Chess](https://handbook.fide.com/chapter/E012023): immediate en passant capture condition, checked for the revised chess question.
- [MDN, idempotent methods](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent): HTTP method semantics, checked for the revised PUT question.
- Arcadia-specific identity and multiplier questions reflect `lib/gooddollar.ts`, `app/api/identity/link/route.ts`, `lib/game-rules.ts` and `lib/game-store.ts`.

Before adding or editing content, check that distractors cannot also be correct, avoid facts likely to change, keep answer positions balanced, and rerun the content tests and export. Do not attach monetary rewards to this finite bank without a separate content-security and competitive-fairness design.
