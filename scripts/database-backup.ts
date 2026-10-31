import { createClient } from "@libsql/client";
import { mkdir, writeFile } from "node:fs/promises";
import { backupDatabase } from "../lib/database-backup";

async function main() {
  const url = process.env.ARCADIA_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("Configure the database URL before backing up.");
  const source = createClient({ url, authToken: process.env.ARCADIA_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN });
  try {
    const destination = `.data/backups/arcadia-${new Date().toISOString().replaceAll(":", "-")}.db`;
    const evidence = { ...await backupDatabase(source, destination), note: "Consistent source snapshot restored to a new private local database; row contents, counts, integrity and foreign keys verified. Production was not modified." };
    await mkdir("docs/evidence", { recursive: true });
    await writeFile("docs/evidence/database-restore.json", JSON.stringify(evidence, null, 2) + "\n");
    console.log(JSON.stringify(evidence, null, 2));
  } finally { source.close(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Backup failed"); process.exitCode = 1; });
