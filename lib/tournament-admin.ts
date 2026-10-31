import type { ProgressStore } from "./progress-store";
import { TOURNAMENT_RULES_VERSION } from "./game-rules";

export interface TournamentSetup { id: string; title: string; startsAt: number; endsAt: number }
export async function createTournament(store: ProgressStore, setup: TournamentSetup, now = Date.now()) {
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(setup.id) || !setup.title.trim() || setup.title.length > 80) throw new Error("Use a 3–64 character lowercase tournament ID and a title of 1–80 characters.");
  if (!Number.isSafeInteger(setup.startsAt) || !Number.isSafeInteger(setup.endsAt) || setup.startsAt < now || setup.endsAt <= setup.startsAt) throw new Error("Tournament times must be valid, start in the future and end after the start.");
  // Never rewrite the rules or dates of a published tournament.
  await store.execute({
    sql: "INSERT INTO tournaments (id, title, starts_at, ends_at, rules_version) VALUES (?, ?, ?, ?, ?)",
    args: [setup.id, setup.title.trim(), setup.startsAt, setup.endsAt, TOURNAMENT_RULES_VERSION],
  });
}
