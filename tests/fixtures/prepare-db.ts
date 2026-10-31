import { ProgressStore } from "../../lib/progress-store";
import { TOURNAMENT_RULES_VERSION } from "../../lib/game-rules";

async function main() {
  const url = process.env.ARCADIA_DATABASE_URL;
  if (!url?.startsWith("file:") || !url.includes("arcadia-wallet-e2e-")) throw new Error("Browser fixtures require their own temporary local database.");
  const db = new ProgressStore({ url });
  try {
    const now = Date.now();
    await db.execute({ sql: "INSERT INTO tournaments (id, title, starts_at, ends_at, rules_version) VALUES (?, ?, ?, ?, ?)", args: ["browser-test", "Browser test tournament", now - 60_000, now + 86_400_000, TOURNAMENT_RULES_VERSION] });
  } finally { db.close(); }
}
void main();
