import { ProgressStore } from "../../lib/progress-store";
import { GameStore } from "../../lib/game-store";

async function main() {
  const [url, player, now] = process.argv.slice(2);
  if (!url.startsWith("file:") || !url.includes("arcadia-daily-concurrent-")) throw new Error("Concurrent fixture requires its temporary test database.");
  const db = new ProgressStore({ url });
  try {
    const game = await new GameStore(db).start(player, "tournament", "root", false, Number(now));
    process.stdout.write(JSON.stringify(game));
  } finally { db.close(); }
}
void main();
