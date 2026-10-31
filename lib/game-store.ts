import { randomUUID } from "node:crypto";
import type { Row, Transaction } from "@libsql/client";
import { ProgressStore, readProgress } from "./progress-store";
import { applyDailyResult } from "./progress";
import { challengeKey, getDailyQuestions, toPublicQuestion, type QuestionDefinition } from "./questions";
import { mixGameQuestions } from "./question-mixer";
import { MIXED_DAILY_FROM } from "./question-policy";
import { selectMixedTriviaQuestions, selectTriviaQuestions } from "./trivia-selection";
import { isTriviaSelection } from "./trivia-catalog";
import type { TriviaSelection } from "./question-types";
import { DAILY_GENRE_GAMES, dailyTournamentRate, gameMultiplier, gameXp, SECONDS_PER_QUESTION, TOURNAMENT_RULES_VERSION, tournamentGameXp, type TournamentRoundPolicy } from "./game-rules";
import type { CompetitionView, GameMode, GameResult, GameView, Standing, TournamentDay } from "./game-types";
import { WalletAuthError } from "./wallet-identity";

const DEFAULT_TOURNAMENT = {
  id: "founding-week-2026-10-30", title: "Founding week",
  startsAt: Date.parse("2026-10-30T00:00:00Z"), endsAt: Date.parse("2026-11-06T00:00:00Z"),
};
type Answer = { answerIndex: number; correct: boolean; receivedAt: number; responseMs?: number };
type Executor = Pick<Transaction, "execute">;
const ATTEMPTS_WITH_POLICY = `SELECT a.*, r.policy AS tournament_policy FROM game_attempts a
  LEFT JOIN game_tournament_rounds r ON r.game_id = a.id`;
function roundPolicy(row: Row): TournamentRoundPolicy | null {
  return row.tournament_policy ? JSON.parse(String(row.tournament_policy)) : null;
}
function n(value: unknown) { return Number(value); }
type TimedQuestion = QuestionDefinition & { timeLimitSeconds?: number };
function questions(row: Row): TimedQuestion[] { return JSON.parse(String(row.questions)); }
// Existing attempts retain their original timing as well as their questions.
function questionSeconds(question?: TimedQuestion) { return question?.timeLimitSeconds ?? 20; }
function answers(row: Row): Answer[] { return JSON.parse(String(row.answers)); }
function view(row: Row, now: number, newCredit = 0): GameView {
  const list = questions(row), submitted = answers(row), index = n(row.question_index);
  const question = list[index];
  const result = row.result ? JSON.parse(String(row.result)) as GameResult : null;
  const expired = row.phase !== "complete" && now >= n(row.expires_at);
  const [, , triviaGame, triviaDifficulty] = String(row.scope_key).split(":");
  const selection = { game: triviaGame, difficulty: triviaDifficulty };
  const policy = roundPolicy(row);
  return {
    id: String(row.id), mode: row.mode as GameMode, sequence: n(row.sequence),
    phase: expired ? "expired" : row.phase as GameView["phase"], questionIndex: index, total: list.length,
    question: !expired && ["playing", "feedback"].includes(String(row.phase)) && question ? toPublicQuestion(question) : null,
    deadline: row.deadline == null ? null : n(row.deadline), serverNow: now, secondsPerQuestion: questionSeconds(question),
    multiplier: policy?.multiplier ?? (row.mode === "tournament" ? gameMultiplier(n(row.sequence) - 1) : 100),
    practice: Boolean(row.practice),
    feedback: !expired && row.phase === "feedback" && submitted[index] ? {
      correct: submitted[index].correct, answerIndex: submitted[index].answerIndex,
      correctIndex: question.answerIndex, explanation: question.explanation,
    } : null,
    result: result ? { ...result, creditedXp: newCredit } : null,
    trivia: policy?.kind === "genre" && policy.genre ? { game: policy.genre, difficulty: "mixed" } : row.mode === "arcade" && isTriviaSelection(selection) ? selection : null,
    difficulty: question?.difficulty ?? null,
    tournamentRound: policy,
  };
}

export class GameStore {
  constructor(readonly db: ProgressStore, private readonly tournamentId = process.env.ARCADIA_TOURNAMENT_ID || DEFAULT_TOURNAMENT.id) {}

  private async tournamentDay(executor: Executor, tournamentId: string, root: string, now: number): Promise<TournamentDay> {
    const day = challengeKey(new Date(now)), startsAt = Date.parse(`${day}T00:00:00Z`), resetsAt = startsAt + 86_400_000;
    const choice = (await executor.execute({ sql: "SELECT genre FROM tournament_days WHERE tournament_id = ? AND identity_root = ? AND day = ?", args: [tournamentId, root, day] })).rows[0];
    // Legacy completions count too, so rollout cannot grant a second allowance.
    const completed = (await executor.execute({ sql: `SELECT COUNT(*) AS count FROM game_attempts a
      LEFT JOIN game_tournament_rounds r ON r.game_id = a.id
      WHERE a.owner_id = ? AND a.scope_key = ? AND a.mode = 'tournament' AND a.phase = 'complete'
      AND (r.day = ? OR (r.day IS NULL AND a.completed_at >= ? AND a.completed_at < ?))`,
      args: [root, `tournament:${tournamentId}`, day, startsAt, resetsAt] })).rows[0];
    const completedGames = n(completed.count), rate = dailyTournamentRate(completedGames);
    return { day, genre: choice ? String(choice.genre) as TriviaSelection["game"] : null, completedGames,
      genreGamesRemaining: Math.max(0, DAILY_GENRE_GAMES - completedGames), normalGamesPlayed: Math.max(0, completedGames - DAILY_GENRE_GAMES),
      resetsAt, nextKind: rate.kind, nextMultiplier: rate.multiplier, nextMaxXp: tournamentGameXp(10, 10, rate).xpEarned };
  }

  async actionRoot(playerId: string, id: string, verify: () => Promise<string>): Promise<string | null> {
    const row = (await this.db.execute({ sql: `SELECT a.mode, a.owner_id, access.player_id AS authorized_player
      FROM game_attempts a LEFT JOIN game_attempt_access access ON access.game_id = a.id AND access.player_id = ?
      WHERE a.id = ?`, args: [playerId, id] })).rows[0];
    if (!row) return null; // act() still rejects unknown attempts.
    if (row.mode !== "tournament" && row.owner_id !== playerId) throw new WalletAuthError("This game belongs to another player.", 403);
    if (row.authorized_player === playerId) return row.mode === "tournament" ? String(row.owner_id) : null;
    // Legacy attempts and another linked wallet require one successful check.
    // Never infer authorization from an attempt ID or a client-provided root.
    const root = await verify();
    if (row.mode === "tournament" && root !== row.owner_id) throw new WalletAuthError("This game belongs to another player.", 403);
    await this.db.execute({ sql: "INSERT OR IGNORE INTO game_attempt_access (game_id, player_id) VALUES (?, ?)", args: [id, playerId] });
    return row.mode === "tournament" ? root : null;
  }

  private async tournament(executor: Executor = this.db) {
    if (this.tournamentId === DEFAULT_TOURNAMENT.id) await executor.execute({
      sql: "INSERT OR IGNORE INTO tournaments (id, title, starts_at, ends_at, rules_version) VALUES (?, ?, ?, ?, ?)",
      args: [DEFAULT_TOURNAMENT.id, DEFAULT_TOURNAMENT.title, DEFAULT_TOURNAMENT.startsAt, DEFAULT_TOURNAMENT.endsAt, TOURNAMENT_RULES_VERSION],
    });
    const row = (await executor.execute({ sql: "SELECT * FROM tournaments WHERE id = ?", args: [this.tournamentId] })).rows[0];
    if (!row) throw new WalletAuthError("This tournament is not available yet. Daily play is still open.", 503);
    return row;
  }

  async competition(root: string | null, now = Date.now()): Promise<CompetitionView> {
    const tournament = await this.tournament();
    const id = String(tournament.id);
    const [rows, totals, own] = await Promise.all([
      this.db.execute({ sql: `SELECT *, ROW_NUMBER() OVER (ORDER BY xp DESC, correct DESC, last_completed ASC, identity_root ASC) AS rank
        FROM tournament_entries WHERE tournament_id = ? AND completed_games > 0
        ORDER BY xp DESC, correct DESC, last_completed ASC, identity_root ASC LIMIT 50`, args: [id] }),
      this.db.execute({ sql: "SELECT COUNT(*) AS count, COALESCE(SUM(xp), 0) AS xp FROM tournament_entries WHERE tournament_id = ?", args: [id] }),
      this.db.execute({ sql: "SELECT * FROM tournament_entries WHERE tournament_id = ? AND identity_root = ?", args: [id, root ?? ""] }),
    ]);
    const standings: Standing[] = rows.rows.map((r) => ({ rank: n(r.rank), address: String(r.identity_root), xp: n(r.xp), correct: n(r.correct), completedGames: n(r.completed_games), isYou: r.identity_root === root }));
    let rank: number | null = null;
    if (own.rows[0] && n(own.rows[0].completed_games) > 0) {
      const ranked = await this.db.execute({ sql: `SELECT rank FROM (SELECT identity_root, ROW_NUMBER() OVER (ORDER BY xp DESC, correct DESC, last_completed ASC, identity_root ASC) AS rank
        FROM tournament_entries WHERE tournament_id = ? AND completed_games > 0) WHERE identity_root = ?`, args: [id, root!] });
      rank = n(ranked.rows[0].rank);
    }
    const daily = own.rows[0] ? await this.tournamentDay(this.db, id, root!, now) : null;
    return {
      id, title: String(tournament.title), startsAt: n(tournament.starts_at), endsAt: n(tournament.ends_at), rulesVersion: now < n(tournament.ends_at) ? TOURNAMENT_RULES_VERSION : String(tournament.rules_version),
      status: now < n(tournament.starts_at) ? "upcoming" : now >= n(tournament.ends_at) ? "closed" : "open",
      participantCount: n(totals.rows[0].count), collectiveXp: n(totals.rows[0].xp), standings,
      entry: own.rows[0] && daily ? { xp: n(own.rows[0].xp), completedGames: n(own.rows[0].completed_games), nextMultiplier: daily.nextMultiplier, rank, daily } : null,
    };
  }

  async enroll(root: string, now = Date.now()) {
    return this.db.write(async (tx) => {
      const tournament = await this.tournament(tx);
      if (now < n(tournament.starts_at) || now >= n(tournament.ends_at)) throw new WalletAuthError("Tournament entry is closed.", 409);
      await tx.execute({ sql: "INSERT OR IGNORE INTO tournament_entries (tournament_id, identity_root, joined_at) VALUES (?, ?, ?)", args: [tournament.id, root, now] });
    });
  }

  async start(playerId: string, mode: GameMode, root: string | null, practice = false, now = Date.now(), trivia?: TriviaSelection): Promise<GameView> {
    return this.db.write(async (tx) => {
      const day = challengeKey(new Date(now));
      let scope = `daily:${day}`, owner = playerId, sequence = 1, expiry = Date.parse(`${day}T00:00:00Z`) + 86400000;
      let policy: TournamentRoundPolicy | null = null;
      if (mode === "arcade") {
        scope = `arcade:${day}:mixed`;
        practice = true;
      }
      if (mode === "tournament") {
        if (!root) throw new WalletAuthError("Verify or link your GoodDollar identity before tournament play.", 403);
        const tournament = await this.tournament(tx);
        if (now < n(tournament.starts_at) || now >= n(tournament.ends_at)) throw new WalletAuthError("This tournament is not open.", 409);
        const entry = (await tx.execute({ sql: "SELECT * FROM tournament_entries WHERE tournament_id = ? AND identity_root = ?", args: [tournament.id, root] })).rows[0];
        if (!entry) throw new WalletAuthError("Join the free tournament before playing.", 403);
        scope = `tournament:${tournament.id}`; owner = root; sequence = n(entry.completed_games) + 1; expiry = Math.min(expiry, n(tournament.ends_at)); practice = false;
      }
      await tx.execute({ sql: "UPDATE game_attempts SET phase = 'expired' WHERE owner_id = ? AND scope_key = ? AND phase IN ('playing', 'feedback', 'ready') AND expires_at <= ?", args: [owner, scope, now] });
      const existing = (await tx.execute({ sql: `${ATTEMPTS_WITH_POLICY} WHERE a.owner_id = ? AND a.scope_key = ? AND a.phase IN ('playing', 'feedback', 'ready') LIMIT 1`, args: [owner, scope] })).rows[0];
      if (existing) {
        if (root) await tx.execute({ sql: "INSERT OR IGNORE INTO game_attempt_access (game_id, player_id) VALUES (?, ?)", args: [existing.id, playerId] });
        return view(existing, now);
      }
      if (mode === "tournament") {
        const daily = await this.tournamentDay(tx, this.tournamentId, root!, now);
        let genre = daily.genre;
        if (daily.nextKind === "genre") {
          if (!genre && !isTriviaSelection(trivia)) throw new WalletAuthError("Choose your tournament genre for today.", 400);
          if (genre && trivia && trivia.game !== genre) throw new WalletAuthError("Your tournament genre is locked until midnight UTC.", 409);
          genre ??= trivia!.game;
          await tx.execute({ sql: "INSERT OR IGNORE INTO tournament_days (tournament_id, identity_root, day, genre, selected_at) VALUES (?, ?, ?, ?, ?)", args: [this.tournamentId, root!, day, genre, now] });
        }
        policy = { rulesVersion: TOURNAMENT_RULES_VERSION, day, daySequence: daily.completedGames + 1, genre, ...dailyTournamentRate(daily.completedGames) };
        await tx.execute({ sql: "UPDATE tournaments SET rules_version = ? WHERE id = ?", args: [TOURNAMENT_RULES_VERSION, this.tournamentId] });
      }
      if (mode === "daily") {
        const previous = (await tx.execute({ sql: "SELECT * FROM game_attempts WHERE owner_id = ? AND scope_key = ? AND phase = 'complete' AND practice = 0 LIMIT 1", args: [owner, scope] })).rows[0];
        if (previous && !practice) return view(previous, now);
        const alreadyCredited = (await tx.execute({ sql: "SELECT 1 FROM daily_results WHERE player_id = ? AND challenge_id = ?", args: [playerId, day] })).rows.length > 0;
        practice = alreadyCredited;
      }
      const id = randomUUID();
      // Persist a fresh selection per tournament attempt. Linked wallets still
      // resume the same stored questions; one entrant cannot pre-play everyone
      // else's sequence to harvest its answer order.
      const selected = policy ? policy.kind === "genre" ? selectTriviaQuestions(`${scope}:${id}`, { game: policy.genre!, difficulty: "mixed" }) : selectMixedTriviaQuestions(`${scope}:${id}`)
        : mode === "arcade" ? selectMixedTriviaQuestions(`${scope}:${id}`) : mode === "daily" && day < MIXED_DAILY_FROM
        ? getDailyQuestions(day)
        : mixGameQuestions(mode === "tournament" ? `${scope}:${id}` : day, mode);
      const list = selected.map((question) => ({ ...question, timeLimitSeconds: SECONDS_PER_QUESTION }));
      await tx.execute({ sql: `INSERT INTO game_attempts (id, owner_id, mode, scope_key, sequence, practice, questions, phase, deadline, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'playing', ?, ?, ?)`, args: [id, owner, mode, scope, sequence, practice ? 1 : 0, JSON.stringify(list), now + SECONDS_PER_QUESTION * 1000, expiry, now] });
      if (root) await tx.execute({ sql: "INSERT INTO game_attempt_access (game_id, player_id) VALUES (?, ?)", args: [id, playerId] });
      if (mode === "tournament") {
        await tx.execute({ sql: "INSERT INTO game_tournament_rounds (game_id, day, policy) VALUES (?, ?, ?)", args: [id, day, JSON.stringify(policy)] });
      }
      return view((await tx.execute({ sql: `${ATTEMPTS_WITH_POLICY} WHERE a.id = ?`, args: [id] })).rows[0], now);
    });
  }

  async act(playerId: string, root: string | null, id: string, action: "read" | "answer" | "next" | "finish", expectedIndex?: number, answerIndex?: number, now = Date.now()): Promise<GameView> {
    return this.db.write(async (tx) => {
      let row = (await tx.execute({ sql: `${ATTEMPTS_WITH_POLICY} WHERE a.id = ?`, args: [id] })).rows[0];
      if (!row || (row.mode !== "tournament" ? row.owner_id !== playerId : !root || row.owner_id !== root)) throw new WalletAuthError("This game belongs to another player.", 403);
      // Reading an expired attempt lets the client leave its active game
      // screen. Mutations remain closed and can never award late XP.
      if (row.phase === "complete" || action === "read") return view(row, now);
      if (now >= n(row.expires_at)) throw new WalletAuthError("This game has expired. Unfinished games earn no XP.", 409);
      const list = questions(row), submitted = answers(row), index = n(row.question_index);
      if (action === "answer") {
        if (expectedIndex !== index) throw new WalletAuthError("That question is no longer active. Resume the current game.", 409);
        if (row.phase === "feedback") return view(row, now); // first committed answer always wins
        if (row.phase !== "playing") throw new WalletAuthError("This question is not accepting answers.", 409);
        if (!Number.isInteger(answerIndex) || answerIndex! < -1 || answerIndex! >= list[index].options.length) throw new WalletAuthError("Choose a valid answer.", 400);
        const accepted = now >= n(row.deadline) ? -1 : answerIndex!;
        const durationMs = questionSeconds(list[index]) * 1000;
        submitted.push({ answerIndex: accepted, correct: accepted === list[index].answerIndex, receivedAt: now,
          responseMs: Math.max(0, Math.min(durationMs, now - (n(row.deadline) - durationMs))) });
        await tx.execute({ sql: "UPDATE game_attempts SET answers = ?, phase = 'feedback' WHERE id = ?", args: [JSON.stringify(submitted), id] });
      } else if (action === "next") {
        if (expectedIndex !== index) return view(row, now); // retry cannot skip another question
        if (row.phase !== "feedback") throw new WalletAuthError("Answer this question first.", 409);
        await tx.execute({ sql: "UPDATE game_attempts SET question_index = ?, phase = ?, deadline = ? WHERE id = ?", args: [index + 1, index + 1 === list.length ? "ready" : "playing", now + questionSeconds(list[index + 1]) * 1000, id] });
      } else if (action === "finish") {
        if (row.phase !== "ready" || submitted.length !== list.length) throw new WalletAuthError("Finish every question before recording the game.", 409);
        const correct = submitted.filter((a) => a.correct).length;
        const policy = roundPolicy(row);
        const result: GameResult = { correct, total: list.length, ...(policy ? tournamentGameXp(correct, list.length, policy) : gameXp(correct, list.length, row.mode === "tournament" ? n(row.sequence) - 1 : 0)), creditedXp: 0 };
        if (row.mode === "tournament") {
          const advanced = await tx.execute({ sql: `UPDATE tournament_entries SET completed_games = completed_games + 1, xp = xp + ?, correct = correct + ?, last_completed = ?
            WHERE tournament_id = ? AND identity_root = ? AND completed_games = ?`, args: [result.xpEarned, correct, now, String(row.scope_key).slice(11), root!, n(row.sequence) - 1] });
          if (advanced.rowsAffected !== 1) throw new WalletAuthError("The game sequence changed. Reload your tournament.", 409);
          result.creditedXp = result.xpEarned;
        } else if (row.mode === "daily" && !row.practice) {
          const timestamp = new Date(now).toISOString();
          const day = String(row.scope_key).slice(6);
          await tx.execute({ sql: "INSERT OR IGNORE INTO players (id, created_at, updated_at) VALUES (?, ?, ?)", args: [playerId, timestamp, timestamp] });
          const current = await readProgress(tx, playerId);
          const inserted = await tx.execute({ sql: `INSERT OR IGNORE INTO daily_results (player_id, challenge_id, correct, total, xp_earned, completed_at) VALUES (?, ?, ?, ?, ?, ?)`, args: [playerId, day, correct, list.length, result.xpEarned, timestamp] });
          if (inserted.rowsAffected === 1) {
            const updated = applyDailyResult(current, { challengeId: day, correct, total: list.length, xpEarned: result.xpEarned }).progress;
            await tx.execute({ sql: "UPDATE players SET xp = ?, streak = ?, last_played = ?, updated_at = ? WHERE id = ?", args: [updated.xp, updated.streak, updated.lastPlayed, timestamp, playerId] });
            result.creditedXp = result.xpEarned;
          }
        }
        await tx.execute({ sql: "UPDATE game_attempts SET phase = 'complete', result = ?, completed_at = ? WHERE id = ?", args: [JSON.stringify(result), now, id] });
        row = (await tx.execute({ sql: `${ATTEMPTS_WITH_POLICY} WHERE a.id = ?`, args: [id] })).rows[0];
        return view(row, now, result.creditedXp);
      }
      row = (await tx.execute({ sql: `${ATTEMPTS_WITH_POLICY} WHERE a.id = ?`, args: [id] })).rows[0];
      return view(row, now);
    });
  }
}
