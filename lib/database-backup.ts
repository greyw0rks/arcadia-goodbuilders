import { createClient, type Client, type InValue } from "@libsql/client";
import { createHash } from "node:crypto";
import { chmod, mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";

function quoted(name: string) { return '"' + name.replaceAll('"', '""') + '"'; }
function digest(values: unknown) {
  return createHash("sha256").update(JSON.stringify(values, (_key, value) => {
    if (typeof value === "bigint") return { bigint: String(value) };
    if (value instanceof ArrayBuffer) return { blob: Buffer.from(value).toString("base64") };
    return value;
  })).digest("hex");
}

export async function backupDatabase(source: Client, destination: string) {
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await chmod(dirname(destination), 0o700);
  // Exclusive creation prevents restoring over an existing DB.
  const file = await open(destination, "wx", 0o600); await file.close();
  const restored = createClient({ url: `file:${destination}` });
  const snapshot = await source.transaction("read");
  const tables: Record<string, { rows: number; sha256: string }> = {};
  try {
    const schema = await snapshot.execute("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, rowid");
    const tx = await restored.transaction("write");
    try {
      for (const definition of schema.rows) {
        await tx.execute(String(definition.sql));
        if (definition.type !== "table") continue;
        const name = String(definition.name);
        const columns = (await snapshot.execute(`SELECT * FROM ${quoted(name)} LIMIT 0`)).columns;
        const data = await snapshot.execute(`SELECT * FROM ${quoted(name)} ORDER BY ${columns.map(quoted).join(",")}`);
        const values = data.rows.map((row) => columns.map((column) => row[column]));
        tables[name] = { rows: values.length, sha256: digest(values) };
        for (const row of values) await tx.execute({ sql: `INSERT INTO ${quoted(name)} VALUES (${columns.map(() => "?").join(",")})`, args: row as InValue[] });
      }
      await tx.commit();
    } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
    const integrity = String((await restored.execute("PRAGMA integrity_check")).rows[0].integrity_check);
    if (integrity !== "ok" || (await restored.execute("PRAGMA foreign_key_check")).rows.length) throw new Error("Restored database integrity or references failed.");
    for (const [name, expected] of Object.entries(tables)) {
      const columns = (await restored.execute(`SELECT * FROM ${quoted(name)} LIMIT 0`)).columns;
      const result = await restored.execute(`SELECT * FROM ${quoted(name)} ORDER BY ${columns.map(quoted).join(",")}`);
      if (result.rows.length !== expected.rows || digest(result.rows.map((row) => columns.map((column) => row[column]))) !== expected.sha256) throw new Error(`Restore content mismatch: ${name}`);
    }
    restored.close();
    return { checkedAt: new Date().toISOString(), snapshot: destination, sha256: createHash("sha256").update(await readFile(destination)).digest("hex"), tables, integrity, restoredContentsMatch: true, foreignKeysValid: true };
  } finally { snapshot.close(); restored.close(); }
}
