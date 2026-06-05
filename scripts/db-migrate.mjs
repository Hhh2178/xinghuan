import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(rootDir, "apps", "api", "db");
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";

if (!databaseUrl) {
  console.error("DATABASE_NOT_CONFIGURED");
  process.exit(2);
}

let pg;
try {
  pg = await import("pg");
} catch {
  console.error("PG_DRIVER_NOT_INSTALLED");
  process.exit(3);
}

const { Client } = pg.default || pg;
const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("begin");
  await client.query("create table if not exists xh_schema_migrations (id text primary key, applied_at timestamptz not null default now())");
  const appliedResult = await client.query("select id from xh_schema_migrations");
  const applied = new Set(appliedResult.rows.map((row) => row.id));
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  const appliedNow = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(migrationsDir, file), "utf-8");
    await client.query(sql);
    await client.query("insert into xh_schema_migrations (id) values ($1) on conflict do nothing", [file]);
    appliedNow.push(file);
  }
  await client.query("commit");
  console.log(JSON.stringify({ ok: true, applied: appliedNow, skipped: files.length - appliedNow.length }, null, 2));
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
