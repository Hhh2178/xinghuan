import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageScriptPath = resolve(rootDir, "scripts/package-release.mjs");
const source = await readFile(packageScriptPath, "utf8");

assertArrayIncludes("requiredPaths", "scripts/prune-old-output-materials.mjs");
assertArrayIncludes("includedPaths", "scripts/prune-old-output-materials.mjs");
assertArrayIncludes("requiredPaths", "scripts/capture-release-preflight.mjs");
assertArrayIncludes("includedPaths", "scripts/capture-release-preflight.mjs");
assertArrayIncludes("requiredPaths", "scripts/verify-task-cancellation-phase-d.mjs");
assertArrayIncludes("includedPaths", "scripts/verify-task-cancellation-phase-d.mjs");
assertArrayIncludes("requiredPaths", "scripts/verify-admin-task-pagination.mjs");
assertArrayIncludes("includedPaths", "scripts/verify-admin-task-pagination.mjs");
assertArrayIncludes("requiredPaths", "scripts/verify-task-lifecycle.mjs");
assertArrayIncludes("includedPaths", "scripts/verify-task-lifecycle.mjs");
assertArrayIncludes("requiredPaths", "scripts/verify-request-chain-observability.mjs");
assertArrayIncludes("includedPaths", "scripts/verify-request-chain-observability.mjs");
assertArrayIncludes("requiredPaths", "scripts/verify-system-observability.mjs");
assertArrayIncludes("includedPaths", "scripts/verify-system-observability.mjs");
assertArrayIncludes("requiredPaths", "scripts/verify-environment-sync-smoke.mjs");
assertArrayIncludes("includedPaths", "scripts/verify-environment-sync-smoke.mjs");
assertArrayIncludes("requiredPaths", "scripts/verify-worker-observability-contract.mjs");
assertArrayIncludes("includedPaths", "scripts/verify-worker-observability-contract.mjs");
assertArrayIncludes("requiredPaths", "scripts/verify-provider-generation-task-service.mjs");
assertArrayIncludes("includedPaths", "scripts/verify-provider-generation-task-service.mjs");
assertArrayIncludes("requiredPaths", "scripts/verify-provider-generation-worker.mjs");
assertArrayIncludes("includedPaths", "scripts/verify-provider-generation-worker.mjs");
assertArrayIncludes("requiredPaths", "apps/api/src/server.ts");
assertArrayIncludes("requiredPaths", "apps/api/src/provider-generation-task-service.ts");
assertArrayIncludes("requiredPaths", "apps/worker/src/worker.ts");
assertArrayIncludes("requiredPaths", "apps/worker/src/output-materials.ts");
assertArrayIncludes("includedPaths", "apps/api/src");
assertArrayIncludes("includedPaths", "apps/worker/src");

console.log(
  JSON.stringify(
    {
      ok: true,
      verifiedFile: packageScriptPath,
      requiredScripts: [
        "scripts/prune-old-output-materials.mjs",
        "scripts/capture-release-preflight.mjs",
        "scripts/verify-task-cancellation-phase-d.mjs",
        "scripts/verify-admin-task-pagination.mjs",
        "scripts/verify-task-lifecycle.mjs",
        "scripts/verify-request-chain-observability.mjs",
        "scripts/verify-system-observability.mjs",
        "scripts/verify-environment-sync-smoke.mjs",
        "scripts/verify-worker-observability-contract.mjs",
        "scripts/verify-provider-generation-task-service.mjs",
        "scripts/verify-provider-generation-worker.mjs",
      ],
      requiredSources: [
        "apps/api/src/server.ts",
        "apps/api/src/provider-generation-task-service.ts",
        "apps/worker/src/worker.ts",
        "apps/worker/src/output-materials.ts",
      ],
      requiredSourceDirs: [
        "apps/api/src",
        "apps/worker/src",
      ],
    },
    null,
    2,
  ),
);

function assertArrayIncludes(arrayName, expectedItem) {
  const block = readArrayBlock(arrayName);
  if (!block.includes(`"${expectedItem}"`)) {
    throw new Error(`${arrayName} missing ${expectedItem}`);
  }
}

function readArrayBlock(arrayName) {
  const pattern = new RegExp(`const ${arrayName} = \\[(.*?)\\];`, "s");
  const match = source.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Unable to locate ${arrayName} in package-release.mjs`);
  }
  return match[1];
}
