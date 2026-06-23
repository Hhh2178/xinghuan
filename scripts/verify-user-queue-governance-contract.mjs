import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const shared = await readFile(new URL("../packages/shared/src/task-queue-settings.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const dispatch = await readFile(new URL("../apps/worker/src/worker-runninghub-dispatch.ts", import.meta.url), "utf8");
const admin = await readFile(new URL("../apps/admin/src/admin-readonly-panels.tsx", import.meta.url), "utf8");

assert.match(shared, /userConcurrency/);
assert.match(shared, /runninghub/);
assert.match(worker, /acquireUserExecutionWindow/);
assert.match(worker, /releaseUserExecutionWindow/);
assert.match(worker, /acquireRunningHubExecutionWindow/);
assert.match(worker, /releaseRunningHubExecutionWindow/);
assert.match(dispatch, /export async function acquireRunningHubExecutionWindow/);
assert.match(dispatch, /export async function releaseRunningHubExecutionWindow/);
assert.match(admin, /单用户并发/);
assert.match(admin, /RunningHub 平台并发/);

console.log("PASS user queue governance contract");
