import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const servicePath = join(root, "apps/api/src/environment-sync-service.ts");
const sharedPath = join(root, "packages/shared/src/environment-sync.ts");
const serverPath = join(root, "apps/api/src/server.ts");
assert.equal(existsSync(servicePath), true);
const source = readFileSync(servicePath, "utf8");
const shared = readFileSync(sharedPath, "utf8");
const server = readFileSync(serverPath, "utf8");
assert(source.includes("createEnvironmentSyncService"));
assert(source.includes("previewEnvironmentSync"));
assert(source.includes("applyEnvironmentSync"));
assert(source.includes("providerModelSummary"));
assert(source.includes("sourceModels"));
assert(source.includes("targetModels"));
assert(source.includes("modelNaturalKey"));
assert(source.includes("writableModels"));
assert(source.includes("providerModels"));
assert(shared.includes("providerModelSummary"));
assert(server.includes("normalizeEnvironmentSyncModelRecord"));
assert(server.includes("upsertEnvironmentSyncProviderModel"));

console.log(JSON.stringify({ ok: true }, null, 2));
