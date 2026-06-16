import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checklistPath = join(root, "ops", "production-acceptance-checklist.md");
const readmePath = join(root, "ops", "README.md");
const gateDocPath = join(root, "ops", "phase-e-observability-release-gate-2026-06-15.md");

if (!existsSync(checklistPath)) throw new Error("missing ops/production-acceptance-checklist.md");
if (!existsSync(readmePath)) throw new Error("missing ops/README.md");
if (!existsSync(gateDocPath)) throw new Error("missing phase e release gate doc");

const checklist = readFileSync(checklistPath, "utf8");
const readme = readFileSync(readmePath, "utf8");
const gateDoc = readFileSync(gateDocPath, "utf8");

assertIncludes(checklist, "x-request-id", "production checklist missing x-request-id gate");
assertIncludes(checklist, "/api/admin/system", "production checklist missing /api/admin/system gate");
assertIncludes(checklist, "verify:request-chain-observability", "production checklist missing request-chain verification");
assertIncludes(checklist, "verify:system-observability", "production checklist missing system observability verification");

assertIncludes(readme, "phase-e-observability-release-gate-2026-06-15.md", "ops README missing phase e gate doc entry");

assertIncludes(gateDoc, "gray", "phase e gate doc missing gray section");
assertIncludes(gateDoc, "production", "phase e gate doc missing production section");
assertIncludes(gateDoc, "rollback", "phase e gate doc missing rollback section");
assertIncludes(gateDoc, "x-request-id", "phase e gate doc missing requestId gate");
assertIncludes(gateDoc, "/api/admin/system", "phase e gate doc missing system api gate");

console.log(JSON.stringify({
  ok: true,
  files: [
    "ops/production-acceptance-checklist.md",
    "ops/README.md",
    "ops/phase-e-observability-release-gate-2026-06-15.md",
  ],
}, null, 2));

function assertIncludes(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message);
  }
}
