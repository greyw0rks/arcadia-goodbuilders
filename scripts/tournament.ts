import { ProgressStore } from "../lib/progress-store";
import { createTournament } from "../lib/tournament-admin";

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!["list", "create"].includes(command)) throw new Error("Usage: tournament.ts list | create --id ID --title TITLE --start ISO_UTC --end ISO_UTC");
  const url = process.env.ARCADIA_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("Configure ARCADIA_DATABASE_URL or TURSO_DATABASE_URL first.");
  const store = new ProgressStore({ url, authToken: process.env.ARCADIA_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN });
  try {
    if (command === "create") {
      const values = new Map<string, string>();
      for (let i = 0; i < args.length; i += 2) {
        if (!["--id", "--title", "--start", "--end"].includes(args[i]) || !args[i + 1] || values.has(args[i])) throw new Error("Supply --id, --title, --start and --end exactly once.");
        values.set(args[i], args[i + 1]);
      }
      if (values.size !== 4 || !values.get("--start")!.endsWith("Z") || !values.get("--end")!.endsWith("Z")) throw new Error("Supply all four values, with UTC dates ending in Z.");
      await createTournament(store, { id: values.get("--id")!, title: values.get("--title")!, startsAt: Date.parse(values.get("--start")!), endsAt: Date.parse(values.get("--end")!) });
      console.log("Tournament created. Set ARCADIA_TOURNAMENT_ID to its ID when ready to publish, then redeploy.");
    } else if (args.length) throw new Error("The list command has no arguments.");
    const tournaments = await store.execute("SELECT id, title, starts_at, ends_at, rules_version FROM tournaments ORDER BY starts_at DESC");
    console.log(JSON.stringify(tournaments.rows, null, 2));
  } finally { store.close(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Tournament command failed"); process.exitCode = 1; });
