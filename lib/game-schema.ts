export const GAME_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tournament_entry_proofs (
    tournament_id TEXT NOT NULL, identity_root TEXT NOT NULL, payer TEXT NOT NULL,
    tx_hash TEXT NOT NULL UNIQUE, block_number TEXT NOT NULL, confirmed_at INTEGER NOT NULL,
    PRIMARY KEY (tournament_id, identity_root)
  )`,
  `CREATE TABLE IF NOT EXISTS request_limits (
    bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS request_limits_expiry ON request_limits(expires_at)`,
  `CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL,
    rules_version TEXT NOT NULL, CHECK (ends_at > starts_at)
  )`,
  `CREATE TABLE IF NOT EXISTS tournament_entries (
    tournament_id TEXT NOT NULL REFERENCES tournaments(id), identity_root TEXT NOT NULL,
    joined_at INTEGER NOT NULL, completed_games INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0, last_completed INTEGER,
    PRIMARY KEY (tournament_id, identity_root)
  )`,
  `CREATE TABLE IF NOT EXISTS game_attempts (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, mode TEXT NOT NULL, scope_key TEXT NOT NULL,
    sequence INTEGER NOT NULL, practice INTEGER NOT NULL DEFAULT 0, questions TEXT NOT NULL,
    answers TEXT NOT NULL DEFAULT '[]', question_index INTEGER NOT NULL DEFAULT 0,
    phase TEXT NOT NULL, deadline INTEGER, expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL, completed_at INTEGER, result TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS one_active_game ON game_attempts(owner_id, scope_key)
    WHERE phase IN ('playing', 'feedback', 'ready')`,
  `CREATE INDEX IF NOT EXISTS completed_games ON game_attempts(owner_id, scope_key, phase, sequence)`,
  `CREATE INDEX IF NOT EXISTS tournament_day_completions ON game_attempts(owner_id, scope_key, completed_at) WHERE phase = 'complete'`,
  `CREATE TABLE IF NOT EXISTS tournament_days (
    tournament_id TEXT NOT NULL, identity_root TEXT NOT NULL, day TEXT NOT NULL,
    genre TEXT NOT NULL, selected_at INTEGER NOT NULL,
    PRIMARY KEY (tournament_id, identity_root, day),
    FOREIGN KEY (tournament_id, identity_root) REFERENCES tournament_entries(tournament_id, identity_root)
  )`,
  `CREATE TABLE IF NOT EXISTS game_tournament_rounds (
    game_id TEXT PRIMARY KEY REFERENCES game_attempts(id) ON DELETE CASCADE,
    day TEXT NOT NULL, policy TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS game_attempt_access (
    game_id TEXT NOT NULL REFERENCES game_attempts(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL, PRIMARY KEY (game_id, player_id)
  )`,
  `CREATE TABLE IF NOT EXISTS wallet_identities (
    player_id TEXT PRIMARY KEY, identity_root TEXT NOT NULL, checked_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reward_plans (
    tournament_id TEXT PRIMARY KEY, plan_hash TEXT NOT NULL UNIQUE, plan_json TEXT NOT NULL, created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reward_receipts (
    tournament_id TEXT NOT NULL, identity_root TEXT NOT NULL, tx_hash TEXT NOT NULL UNIQUE,
    amount TEXT NOT NULL, block_number TEXT NOT NULL, recorded_at INTEGER NOT NULL,
    PRIMARY KEY (tournament_id, identity_root)
  )`,
] as const;
