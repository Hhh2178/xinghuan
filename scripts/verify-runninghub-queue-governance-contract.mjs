import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

assert.match(worker, /acquireRunningHubExecutionWindow/);
assert.match(worker, /releaseRunningHubExecutionWindow/);
assert.match(worker, /waiting_provider_window|waiting_runninghub_window/);
assert.match(worker, /task\.payload\.webappId|task\.payload\.workflowId|task\.payload\.runTargetId/);
assert.match(worker, /openapi\/v2\/run\/workflow/);
assert.match(worker, /openapi\/v2\/query/);
assert.match(server, /runninghub/);
assert.match(server, /workflowId/);
assert.match(server, /targetType/);
assert.match(server, /taskCapability/);
assert.match(server, /runTargetId/);

console.log("PASS runninghub queue governance contract");
