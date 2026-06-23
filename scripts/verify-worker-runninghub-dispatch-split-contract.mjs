import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const dispatch = await readFile(new URL("../apps/worker/src/worker-runninghub-dispatch.ts", import.meta.url), "utf8");

assert.match(worker, /worker-runninghub-dispatch/);
assert.match(worker, /buildRunningHubDispatchDeps/);
assert.match(worker, /acquireRunningHubExecutionWindow/);
assert.match(worker, /releaseRunningHubExecutionWindow/);

assert.match(dispatch, /export async function acquireRunningHubExecutionWindow/);
assert.match(dispatch, /export async function releaseRunningHubExecutionWindow/);
assert.match(dispatch, /export async function selectExecutableRunningHubKey/);
assert.match(dispatch, /preferredRhKeyId/);
assert.match(dispatch, /legacy-default/);
assert.match(dispatch, /all_keys_busy/);

console.log("PASS worker runninghub dispatch split contract");
