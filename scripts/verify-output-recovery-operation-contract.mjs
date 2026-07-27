import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [adminRoute, workerOperation, workerEntry, apiTest, workerTest, packageJson, releasePackage] = await Promise.all([
  read("apps/api/src/admin-task-list-routes.ts"),
  read("apps/worker/src/worker-task-operation.ts"),
  read("apps/worker/src/worker.ts"),
  read("apps/api/src/admin-task-list-routes.test.ts"),
  read("apps/worker/src/worker-task-operation.test.ts"),
  read("package.json"),
  read("scripts/package-release.mjs"),
]);

assert.match(adminRoute, /payload:\s*\{[\s\S]*outputRecoveryMode:\s*"output_only"/, "Admin recovery must persist the operation in payload");
assert.match(adminRoute, /result:\s*\{[\s\S]*outputRecoveryMode:\s*"output_only"/, "Admin recovery must retain the diagnostic result marker");
assert.match(workerOperation, /task\.payload\.outputRecoveryMode === "output_only"[\s\S]*task\.result\.outputRecoveryMode === "output_only"/, "Resolver must support payload and v0.8.2 result-only tasks");
assert.match(workerOperation, /executeWorkerTaskOperation/, "Worker operation module must own dispatch");
assert.match(workerEntry, /executeWorkerTaskOperation\(\{/, "Worker dispatch must use the operation module before Provider execution");
assert.doesNotMatch(workerEntry, /resolveWorkerTaskOperation/, "Worker entry must not grow another operation decision");
assert.match(apiTest, /payload: expect\.objectContaining\(\{ outputRecoveryMode: "output_only" \}\)/, "API regression test must lock the payload marker");
assert.match(workerTest, /result:\s*\{ outputRecoveryMode: "output_only" \}/, "Worker regression test must lock result-only compatibility");
assert.match(packageJson, /"verify:output-recovery-operation-contract"/, "Root package must expose the recovery contract verifier");
assert.match(releasePackage, /scripts\/verify-output-recovery-operation-contract\.mjs/, "Release archive must include the recovery contract verifier");

console.log(JSON.stringify({ ok: true, contract: "output-recovery-operation" }, null, 2));

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}
