import { createHash } from "node:crypto";
import type { ProgressStore } from "./progress-store";
import { WalletAuthError } from "./wallet-identity";

export class RateLimitError extends WalletAuthError {
  constructor(readonly retryAfter: number) {
    super(`Too many requests. Try again in ${retryAfter} seconds.`, 429);
  }
}

// Durable, atomic fixed-window limits shared by all server instances. Store
// only a hash of the subject; no wallet/session token is recorded in this table.
export async function limitRequests(store: ProgressStore, scope: string, subject: string, limit: number, windowMs = 60_000, now = Date.now()) {
  const bucket = createHash("sha256").update(`${scope}:${subject}`).digest("hex");
  const expiresAt = now - now % windowMs + windowMs;
  const result = await store.execute({
    sql: `INSERT INTO request_limits (bucket, hits, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(bucket) DO UPDATE SET
        hits = CASE WHEN request_limits.expires_at <= ? THEN 1 ELSE request_limits.hits + 1 END,
        expires_at = CASE WHEN request_limits.expires_at <= ? THEN excluded.expires_at ELSE request_limits.expires_at END
      WHERE request_limits.expires_at <= ? OR request_limits.hits < ?
      RETURNING hits`,
    args: [bucket, expiresAt, now, now, now, limit],
  });
  if (!result.rows.length) throw new RateLimitError(Math.max(1, Math.ceil((expiresAt - now) / 1000)));
}
