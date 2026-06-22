import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");

const workerPath = resolve(rootDir, "apps/worker/src/worker.ts");
const serverPath = resolve(rootDir, "apps/api/src/server.ts");
const adminTypesPath = resolve(rootDir, "apps/admin/src/admin-types.ts");
const adminPanelsPath = resolve(rootDir, "apps/admin/src/admin-readonly-panels.tsx");
const sharedIndexPath = resolve(rootDir, "packages/shared/src/index.ts");

const [workerSource, serverSource, adminTypesSource, adminPanelsSource, sharedIndexSource] = await Promise.all([
  readFile(workerPath, "utf8"),
  readFile(serverPath, "utf8"),
  readFile(adminTypesPath, "utf8"),
  readFile(adminPanelsPath, "utf8"),
  readFile(sharedIndexPath, "utf8"),
]);

assert.match(
  workerSource,
  /refreshQueueControllers|reconcileQueueControllers|syncQueueControllers/,
  "worker must expose a runtime queue-controller refresh mechanism",
);
assert.match(
  workerSource,
  /duplicate\(\)/,
  "worker must dedicate separate redis connections to blocking queue reads",
);
assert.match(
  workerSource,
  /controller\.redis\.\s*brPop\(/,
  "worker queue loop must read from a dedicated controller redis client",
);
assert.doesNotMatch(
  workerSource,
  /await\s+redis\.\s*brPop\(/,
  "worker must not use the control redis client for blocking queue reads",
);
assert.match(
  workerSource,
  /setInterval\(\s*(?:\(\)\s*=>\s*)?(?:void\s+)?(?:refreshQueueControllers|reconcileQueueControllers|syncQueueControllers)|await\s+(?:refreshQueueControllers|reconcileQueueControllers|syncQueueControllers)\(/,
  "worker must periodically refresh queue controllers or invoke an equivalent runtime sync",
);
assert.doesNotMatch(
  workerSource,
  /const workerLoops = queueDescriptors\.flatMap/,
  "worker must not keep concurrency fixed only at startup",
);

assert.match(serverSource, /effectiveConcurrency/, "system API must return effectiveConcurrency observability");
assert.match(serverSource, /workerCount/, "system API must return workerCount observability");
assert.match(serverSource, /slotCount/, "system API must return slotCount observability");
assert.match(
  serverSource,
  /workerCount:\s*new Set\(capabilityRuntimeSlots\.map\(\(slot\) => slot\.workerId\)\.filter\(Boolean\)\)\.size/s,
  "workerCount must be derived from distinct workerId values rather than raw slot totals",
);
assert.match(
  serverSource,
  /effectiveConcurrency:\s*capabilityRuntimeSlots\.filter\(\(slot\) => slot\.state === "active"\)\.length/s,
  "effectiveConcurrency must count only active runtime slots",
);
assert.doesNotMatch(
  serverSource,
  /effectiveConcurrency:\s*taskQueueSettings\.runninghub\.enabled\s*\?\s*taskQueueSettings\.runninghub\.concurrency\s*:\s*0/s,
  "runninghub runtime observability must not mirror configured concurrency as a fake effective value",
);
assert.match(serverSource, /activeWindowCount/, "system API must expose runninghub active window observability");
assert.match(adminTypesSource, /effectiveConcurrency/, "admin types must model effectiveConcurrency");
assert.match(adminTypesSource, /workerCount/, "admin types must model workerCount");
assert.match(adminTypesSource, /slotCount/, "admin types must model slotCount");
assert.match(adminTypesSource, /activeWindowCount/, "admin types must model runninghub active window count");
assert.match(adminPanelsSource, /effectiveConcurrency/, "admin system panel must display effectiveConcurrency");
assert.match(adminPanelsSource, /workerCount/, "admin system panel must display workerCount");
assert.match(adminPanelsSource, /slotCount/, "admin system panel must display slotCount");
assert.match(adminPanelsSource, /当前占用/, "admin system panel must distinguish runninghub configured limit from current runtime occupancy");
assert.match(sharedIndexSource, /task-queue-settings/, "shared exports must keep task queue settings available");

console.log(
  JSON.stringify({
    ok: true,
    contract: "worker-runtime-concurrency",
    checkedFiles: [
      "apps/worker/src/worker.ts",
      "apps/api/src/server.ts",
      "apps/admin/src/admin-types.ts",
      "apps/admin/src/admin-readonly-panels.tsx",
      "packages/shared/src/index.ts",
    ],
  }),
);
