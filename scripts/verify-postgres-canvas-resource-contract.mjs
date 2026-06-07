import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf-8");
const workerOutput = await readFile(new URL("../apps/worker/src/output-materials.ts", import.meta.url), "utf-8");
const prune = await readFile(new URL("./prune-old-output-materials.mjs", import.meta.url), "utf-8");
const adminCoreMigration = await readFile(new URL("../apps/api/db/001_admin_core.sql", import.meta.url), "utf-8");
const migration = await readFile(new URL("../apps/api/db/003_canvas_resource_repository.sql", import.meta.url), "utf-8").catch(() => "");

const checks = [
  ["Migration 001 creates xh_canvases.name", /create table if not exists xh_canvases[\s\S]*\bname text not null/i.test(adminCoreMigration)],
  ["Migration 003 exists", migration.length > 0],
  ["Migration 003 creates resource category table", /create table if not exists xh_resource_categories/i.test(migration)],
  ["Migration 003 upgrades xh_assets for resource repository", /alter table xh_assets add column if not exists category_id/i.test(migration)],
  ["API canvas list reads xh_canvases.name", /async function readCanvasList[\s\S]*usePostgresRepository\(\)[\s\S]*select id, name, node_count, created_at, updated_at from xh_canvases/i.test(api)],
  ["API canvas detail has postgres repository branch", /async function readCanvasData[\s\S]*usePostgresRepository\(\)[\s\S]*from xh_canvases/i.test(api)],
  ["API canvas write uses xh_canvases.name", /async function writeCanvasData[\s\S]*usePostgresRepository\(\)[\s\S]*insert into xh_canvases \(id, owner_id, project_id, name, node_count, data, created_at, updated_at\)/i.test(api)],
  ["API resource db has postgres repository branch", /async function readResourceDb[\s\S]*usePostgresRepository\(\)[\s\S]*xh_assets[\s\S]*xh_resource_categories/i.test(api)],
  ["API resource db write has postgres repository branch", /async function writeResourceDb[\s\S]*usePostgresRepository\(\)[\s\S]*xh_assets/i.test(api)],
  ["Worker output materializer can persist postgres resources", /storageDriver[\s\S]*postgres/i.test(workerOutput) && /insert into xh_assets/i.test(workerOutput)],
  ["Prune script can read postgres resource repository", /xh_assets/i.test(prune) && /xh_resource_categories/i.test(prune)],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
