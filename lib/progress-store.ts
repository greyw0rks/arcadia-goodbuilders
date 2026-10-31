import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type Client, type Transaction, type InStatement } from "@libsql/client";
import { GAME_SCHEMA } from "./game-schema";
import { WalletAuthError, type WalletChallenge, type WalletSession } from "./wallet-identity";
import {
  applyDailyResult,
  EMPTY_PROGRESS,
  type DailyResult,
  type PlayerProgress,
} from "./progress";

interface ProgressStoreOptions {
  url: string;
  authToken?: string;
}

type DatabaseExecutor = Pick<Client, "execute"> | Pick<Transaction, "execute">;

function localDatabasePath(url: string): string | null {
  if (!url.startsWith("file:")) return null;
  const path = url.slice("file:".length);
  if (!path || path === ":memory:") return null;
  return path;
}

function numeric(value: unknown): number {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

export async function readProgress(executor: DatabaseExecutor, playerId: string): Promise<PlayerProgress> {
  const result = await executor.execute({
    sql: `
      SELECT
        p.xp,
        p.streak,
        p.last_played,
        d.challenge_id,
        d.correct,
        d.total,
        d.xp_earned,
        d.completed_at
      FROM players p
      LEFT JOIN daily_results d
        ON d.player_id = p.id
       AND d.challenge_id = (
         SELECT MAX(latest.challenge_id)
         FROM daily_results latest
         WHERE latest.player_id = p.id
       )
      WHERE p.id = ?
      LIMIT 1
    `,
    args: [playerId],
  });
  const row = result.rows[0];
  if (!row) return EMPTY_PROGRESS;

  const challengeId = typeof row.challenge_id === "string" ? row.challenge_id : null;
  const daily: DailyResult | null = challengeId
    ? {
        challengeId,
        correct: numeric(row.correct),
        total: numeric(row.total),
        xpEarned: numeric(row.xp_earned),
        completedAt: typeof row.completed_at === "string" ? row.completed_at : new Date(0).toISOString(),
      }
    : null;

  return {
    version: 1,
    xp: numeric(row.xp),
    streak: numeric(row.streak),
    lastPlayed: typeof row.last_played === "string" ? row.last_played : null,
    daily,
  };
}

export class ProgressStore {
  private readonly client: Client;
  private readonly ready: Promise<void>;

  constructor(options: ProgressStoreOptions) {
    const localPath = localDatabasePath(options.url);
    if (localPath) mkdirSync(dirname(localPath), { recursive: true });
    this.client = createClient({
      url: options.url,
      ...(options.authToken ? { authToken: options.authToken } : {}),
      intMode: "number",
      timeout: 5_000,
    });
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.client.batch([
      `CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
        streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
        last_played TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS daily_results (
        player_id TEXT NOT NULL,
        challenge_id TEXT NOT NULL,
        correct INTEGER NOT NULL CHECK (correct >= 0),
        total INTEGER NOT NULL CHECK (total > 0),
        xp_earned INTEGER NOT NULL CHECK (xp_earned >= 0),
        completed_at TEXT NOT NULL,
        PRIMARY KEY (player_id, challenge_id),
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      )`,
      "CREATE INDEX IF NOT EXISTS daily_results_player_challenge ON daily_results(player_id, challenge_id DESC)",
      `CREATE TABLE IF NOT EXISTS wallets (
        address TEXT PRIMARY KEY,
        player_id TEXT NOT NULL UNIQUE REFERENCES players(id)
      )`,
      `CREATE TABLE IF NOT EXISTS wallet_challenges (
        browser_id TEXT PRIMARY KEY,
        nonce TEXT NOT NULL UNIQUE,
        address TEXT NOT NULL,
        origin TEXT NOT NULL,
        message TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS wallet_sessions (
        token_hash TEXT PRIMARY KEY,
        address TEXT NOT NULL REFERENCES wallets(address),
        expires_at INTEGER NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS wallet_sessions_expiry ON wallet_sessions(expires_at)",
      "CREATE INDEX IF NOT EXISTS wallet_challenges_expiry ON wallet_challenges(expires_at)",
      ...GAME_SCHEMA,
    ], "write");
  }

  async get(playerId: string): Promise<PlayerProgress> {
    await this.ready;
    return readProgress(this.client, playerId);
  }

  async execute(statement: InStatement) {
    await this.ready;
    return this.client.execute(statement);
  }

  async write<T>(operation: (transaction: Transaction) => Promise<T>): Promise<T> {
    await this.ready;
    const transaction = await this.client.transaction("write");
    try {
      const result = await operation(transaction);
      await transaction.commit();
      return result;
    } catch (error) { await transaction.rollback(); throw error; }
    finally { transaction.close(); }
  }

  async saveWalletChallenge(challenge: WalletChallenge, now: number): Promise<void> {
    await this.ready;
    await this.client.batch([
      { sql: "DELETE FROM wallet_challenges WHERE expires_at <= ?", args: [now] },
      { sql: "DELETE FROM wallet_sessions WHERE expires_at <= ?", args: [now] },
      {
        sql: `INSERT OR REPLACE INTO wallet_challenges
              (browser_id, nonce, address, origin, message, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [challenge.browserId, challenge.nonce, challenge.address, challenge.origin, challenge.message, challenge.expiresAt],
      },
    ], "write");
  }

  async getWalletChallenge(browserId: string, nonce: string): Promise<WalletChallenge | null> {
    await this.ready;
    const result = await this.client.execute({
      sql: "SELECT * FROM wallet_challenges WHERE browser_id = ? AND nonce = ?",
      args: [browserId, nonce],
    });
    const row = result.rows[0];
    return row ? {
      browserId: String(row.browser_id), nonce: String(row.nonce), address: String(row.address),
      origin: String(row.origin), message: String(row.message), expiresAt: numeric(row.expires_at),
    } : null;
  }

  async getWalletSession(tokenHash: string, now: number): Promise<WalletSession | null> {
    await this.ready;
    const result = await this.client.execute({
      sql: `SELECT w.player_id, w.address FROM wallet_sessions s
            JOIN wallets w ON w.address = s.address WHERE s.token_hash = ? AND s.expires_at > ?`,
      args: [tokenHash, now],
    });
    const row = result.rows[0];
    return row ? { playerId: String(row.player_id), address: String(row.address) } : null;
  }

  async revokeWalletSession(tokenHash: string): Promise<void> {
    await this.ready;
    await this.client.execute({ sql: "DELETE FROM wallet_sessions WHERE token_hash = ?", args: [tokenHash] });
  }

  // The signature is verified before entering this transaction. Consuming the
  // exact challenge, merging guest results and issuing a session are atomic.
  async linkWallet(
    challenge: WalletChallenge,
    tokenHash: string,
    expiresAt: number,
    now: number,
    previousTokenHash?: string,
  ): Promise<WalletSession & { progress: PlayerProgress }> {
    await this.ready;
    const transaction = await this.client.transaction("write");
    try {
      const consumed = await transaction.execute({
        sql: `DELETE FROM wallet_challenges
              WHERE browser_id = ? AND nonce = ? AND message = ? AND expires_at > ?`,
        args: [challenge.browserId, challenge.nonce, challenge.message, now],
      });
      if (consumed.rowsAffected !== 1) throw new WalletAuthError("This sign-in expired or was already used. Start again.");

      const wallet = await transaction.execute({ sql: "SELECT player_id FROM wallets WHERE address = ?", args: [challenge.address] });
      // The prefix deliberately cannot be used as an anonymous UUID cookie.
      const playerId = wallet.rows[0] ? String(wallet.rows[0].player_id) : `wallet:${randomUUID()}`;
      const timestamp = new Date(now).toISOString();
      await transaction.execute({
        sql: "INSERT OR IGNORE INTO players (id, created_at, updated_at) VALUES (?, ?, ?)",
        args: [playerId, timestamp, timestamp],
      });
      await transaction.execute({ sql: "INSERT OR IGNORE INTO wallets (address, player_id) VALUES (?, ?)", args: [challenge.address, playerId] });

      // Existing account results win on overlapping days; sign-in never
      // upgrades a recorded score or credits the same challenge twice.
      await transaction.execute({
        sql: `INSERT OR IGNORE INTO daily_results (player_id, challenge_id, correct, total, xp_earned, completed_at)
              SELECT ?, challenge_id, correct, total, xp_earned, completed_at FROM daily_results WHERE player_id = ?`,
        args: [playerId, challenge.browserId],
      });
      const results = await transaction.execute({
        sql: "SELECT challenge_id, correct, total, xp_earned, completed_at FROM daily_results WHERE player_id = ? ORDER BY challenge_id",
        args: [playerId],
      });
      let progress = EMPTY_PROGRESS;
      for (const row of results.rows) {
        progress = applyDailyResult(progress, {
          challengeId: String(row.challenge_id), correct: numeric(row.correct),
          total: numeric(row.total), xpEarned: numeric(row.xp_earned),
        }).progress;
        progress = { ...progress, daily: progress.daily ? { ...progress.daily, completedAt: String(row.completed_at) } : null };
      }
      await transaction.execute({
        sql: "UPDATE players SET xp = ?, streak = ?, last_played = ?, updated_at = ? WHERE id = ?",
        args: [progress.xp, progress.streak, progress.lastPlayed, timestamp, playerId],
      });
      await transaction.execute({ sql: "DELETE FROM daily_results WHERE player_id = ?", args: [challenge.browserId] });
      await transaction.execute({ sql: "DELETE FROM players WHERE id = ?", args: [challenge.browserId] });
      if (previousTokenHash) {
        await transaction.execute({ sql: "DELETE FROM wallet_sessions WHERE token_hash = ?", args: [previousTokenHash] });
      }
      await transaction.execute({
        sql: "INSERT INTO wallet_sessions (token_hash, address, expires_at) VALUES (?, ?, ?)",
        args: [tokenHash, challenge.address, expiresAt],
      });
      await transaction.commit();
      return { playerId, address: challenge.address, progress };
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  }

  async applyDailyResult(
    playerId: string,
    result: Omit<DailyResult, "completedAt">,
  ): Promise<{ progress: PlayerProgress; creditedXp: number }> {
    await this.ready;
    const transaction = await this.client.transaction("write");
    try {
      const now = new Date().toISOString();
      await transaction.execute({
        sql: `INSERT OR IGNORE INTO players (id, xp, streak, last_played, created_at, updated_at)
              VALUES (?, 0, 0, NULL, ?, ?)`,
        args: [playerId, now, now],
      });
      const current = await readProgress(transaction, playerId);
      const inserted = await transaction.execute({
        sql: `INSERT OR IGNORE INTO daily_results
              (player_id, challenge_id, correct, total, xp_earned, completed_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [playerId, result.challengeId, result.correct, result.total, result.xpEarned, now],
      });

      if (inserted.rowsAffected === 0) {
        await transaction.commit();
        return { progress: current, creditedXp: 0 };
      }

      const applied = applyDailyResult(current, result);
      const progress: PlayerProgress = {
        ...applied.progress,
        daily: applied.progress.daily ? { ...applied.progress.daily, completedAt: now } : null,
      };
      await transaction.execute({
        sql: `UPDATE players
              SET xp = ?, streak = ?, last_played = ?, updated_at = ?
              WHERE id = ?`,
        args: [progress.xp, progress.streak, progress.lastPlayed, now, playerId],
      });
      await transaction.commit();
      return { progress, creditedXp: applied.creditedXp };
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  }

  close(): void {
    this.client.close();
  }
}

let configuredStore: ProgressStore | null = null;

export function progressStore(): ProgressStore {
  if (configuredStore) return configuredStore;
  const configuredUrl = process.env.ARCADIA_DATABASE_URL?.trim() || process.env.TURSO_DATABASE_URL?.trim();
  const url = configuredUrl || (process.env.NODE_ENV === "production" ? null : "file:.data/arcadia-goodbuilders.db");
  if (!url) throw new Error("ARCADIA_DATABASE_URL is required in production");
  configuredStore = new ProgressStore({
    url,
    authToken: process.env.ARCADIA_DATABASE_AUTH_TOKEN?.trim() || process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
  });
  return configuredStore;
}
