# Four-game expansion — October 31, 2026

Implemented General, Maths, Crypto and Movie Trivia, each with 500 questions (125 easy, medium, hard and extremely hard). The `/app` hub offers game and difficulty selection. Ten-question scored practice rounds have 10-second deadlines, 1.2-second automatic progression, saved results, ownership checks and resumption. Mixed rounds progress 3/3/2/2. Existing daily/tournament scoring and the original 150 questions remain separate.

Frozen bank: `lib/trivia-bank.json`; generator and source notes: `scripts/build-trivia.py`, `data/trivia/`, `docs/question-bank-notes.md`. Private CSV and Markdown exports include all 2,150 items with source metadata. Movie review overrides remove incorrect writing/music/directing/editing credits and correct Saw's release year. Maths uses exact arithmetic across 40 parameterized families. No runtime trivia API is needed.

Verification covers counts, answer integrity, selected game/tier, deterministic shuffling, resume, ownership, no identity RPC/no XP for category games, and browser auto-next/result saving. See `docs/evidence/trivia-release-checks.json` for final test and deployment results. Remaining human work: difficulty calibration and physical wallet/player acceptance.

Previous funding task is complete: Celo escrow `0x876b0684b3d156434c3fc83dc807ec274c3c9273` holds the verified 6,426.91913403696607823 G$ deposit. No payout system was enabled by this expansion.
