import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const dispatch = await readFile(new URL("../apps/worker/src/worker-runninghub-dispatch.ts", import.meta.url), "utf8");

assert.match(server, /inspectRunningHubKeyPoolAvailability/);
assert.match(server, /preferredRhKeyId/);
assert.match(worker, /worker-runninghub-dispatch/);
assert.match(dispatch, /selectExecutableRunningHubKey/);
assert.match(dispatch, /all_keys_busy/);
assert.match(dispatch, /isDefault/);
assert.match(dispatch, /preferredRhKeyId/);
assert.match(worker, /assignedRhKeyId/);

console.log("PASS runninghub dynamic key selection contract");
