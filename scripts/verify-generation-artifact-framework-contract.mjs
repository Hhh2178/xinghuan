import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = {
  migration: await read("apps/api/db/024_generation_artifacts.sql"),
  repository: await read("apps/api/src/generation-artifact-repository.ts"),
  artifactStore: await read("apps/api/src/artifact-store.ts"),
  lifecycle: await read("apps/api/src/generation-artifact-lifecycle.ts"),
  routes: await read("apps/api/src/generation-artifact-routes.ts"),
  server: await read("apps/api/src/server.ts"),
  worker: await read("apps/worker/src/output-materials.ts"),
  canvas: await read("apps/web/src/components/Canvas.tsx"),
  api: await read("apps/web/src/services/api.ts"),
  migrationScript: await read("scripts/migrate-generation-library-artifacts.mjs"),
  reconcileScript: await read("scripts/reconcile-generation-artifacts.mjs"),
  packageJson: JSON.parse(await read("package.json")),
};

for (const column of [
  "owner_id", "status", "storage_key", "file_url", "source_task_id", "expires_at", "promoted_asset_id", "dedupe_key",
]) {
  assert.match(files.migration, new RegExp(`\\b${column}\\b`), `generation artifact schema missing ${column}`);
}
for (const status of ["active", "promoted", "expired", "missing", "deleted"]) {
  assert.match(files.migration, new RegExp(`'${status}'`), `generation artifact schema missing status ${status}`);
}
assert.match(files.migration, /unique \(owner_id, dedupe_key\)/, "schema must enforce owner-scoped idempotency");
assert.match(files.repository, /on conflict \(owner_id, dedupe_key\)/, "repository must upsert idempotently");
assert.match(files.repository, /owner_id = \$1/, "repository reads must constrain owner");
assert.match(files.lifecycle, /resolveContent/, "lifecycle must own content resolution");
assert.match(files.artifactStore, /interface ArtifactStore/, "artifact binary access must use the ADR-defined ArtifactStore seam");
assert.match(files.lifecycle, /artifactStore\.resolveOwned/, "lifecycle must delegate binary resolution to ArtifactStore");
assert.match(files.routes, /promoteOwned/, "routes must expose promotion");
assert.match(files.server, /handleGenerationArtifactRoutes/, "server must delegate generation artifact routes");
assert.doesNotMatch(files.server, /function readGenerationLibraryDb/, "server must not own legacy generation JSON lifecycle");
assert.match(files.worker, /writeTaskGenerationArtifactsToPostgres/, "worker must register generation artifacts");
assert.doesNotMatch(files.worker, /insert into xh_assets/, "worker must not auto-promote task outputs into resource assets");
assert.doesNotMatch(files.canvas, /generationLibraryRegisteredRef/, "Canvas must not scan and register generation artifacts");
assert.match(files.api, /promoteGenerationLibraryItem/, "web API must expose explicit promotion");
assert.match(files.migrationScript, /const apply = process\.argv\.includes\("--apply"\)/, "legacy migration must default to dry-run");
assert.match(files.reconcileScript, /apply = Boolean\(options\.apply\)/, "reconciliation must default to dry-run");

const scripts = files.packageJson.scripts || {};
assert.equal(scripts["verify:generation-artifact-framework-contract"], "node scripts/verify-generation-artifact-framework-contract.mjs");
assert.match(scripts["cleanup:output-materials:dry-run"], /reconcile-generation-artifacts\.mjs$/);
assert.match(scripts["generation-artifacts:migrate:dry-run"], /migrate-generation-library-artifacts\.mjs$/);

console.log(JSON.stringify({ ok: true, contract: "generation-artifact-framework" }, null, 2));

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}
