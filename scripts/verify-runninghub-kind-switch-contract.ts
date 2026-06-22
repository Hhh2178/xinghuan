import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";

const root = process.cwd();
const types = readFileSync(join(root, "apps", "admin", "src", "admin-types.ts"), "utf8");
const workspace = readFileSync(join(root, "apps", "admin", "src", "admin-runninghub-workspace.tsx"), "utf8");
const server = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");

assert.match(
  types,
  /export interface RunningHubAdminItemUpdatePayload[\s\S]*kind\?: "app" \| "workflow";/,
);

assert.match(
  workspace,
  /const analyzeTargetKind = analyzeDraft\?\.detectedKind === "app"\s*\?\s*"app"\s*:\s*analyzeDraft\?\.detectedKind === "workflow"\s*\?\s*"workflow"\s*:\s*activeTab;/,
);
assert.match(
  workspace,
  /function buildUpdatePayloadFromDraft\([\s\S]*targetKind: RunningHubWorkspaceTab[\s\S]*kind:\s*targetKind,/,
);
assert.match(
  workspace,
  /handleCreate\(analyzeTargetKind, undefined, buildCreatePayloadFromDraft\(/,
);
assert.match(
  workspace,
  /handleCreate\(analyzeTargetKind, undefined, mergeDraftSectionsToCreatePayload\(/,
);
assert.match(
  workspace,
  /setSelectedCatalogId\(updated\.catalogId\);[\s\S]*setActiveTab\(updated\.kind === "app" \? "app" : "workflow"\);/,
);

assert.match(
  server,
  /const runTargetId = safeText\(\s*referenceTargetId \|\| input\.runTargetId \|\| requestExampleRunTargetId \|\| detectedTarget\.targetId,/,
);
assert.match(
  server,
  /async function updateAdminRunningHubCatalogItem\([\s\S]*kind\?: "app" \| "workflow";/,
);
assert.match(
  server,
  /const nextKind = patch\.kind === "app" \? "app" : patch\.kind === "workflow" \? "workflow" : kind;/,
);
assert.match(
  server,
  /rhApps: nextApps,/,
);
assert.match(
  server,
  /rhWorkflows: nextWorkflows,/,
);

console.log("PASS runninghub kind switch contract");
