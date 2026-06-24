import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const dispatch = await readFile(new URL("../apps/worker/src/worker-runninghub-dispatch.ts", import.meta.url), "utf8");
const runningHubClient = await readFile(new URL("../apps/worker/src/worker-runninghub-client.ts", import.meta.url), "utf8");
const runningHubResponse = await readFile(new URL("../apps/worker/src/worker-runninghub-response.ts", import.meta.url), "utf8");
const runtimeDiagnostics = await readFile(new URL("../apps/worker/src/worker-runtime-diagnostics.ts", import.meta.url), "utf8");
const lifecycle = await readFile(new URL("../apps/worker/src/worker-task-lifecycle.ts", import.meta.url), "utf8");

assert.match(worker, /createRunningHubClient/);
assert.match(worker, /worker-runninghub-dispatch/);
assert.match(dispatch, /selectExecutableRunningHubKey/);
assert.match(worker, /worker-runtime-diagnostics/);
assert.match(runningHubClient, /parseRunningHubPollJsonResponse/);
assert.match(runningHubClient, /export function createRunningHubClient/);
assert.match(runningHubResponse, /export function parseRunningHubPollJsonResponse/);
assert.match(runningHubResponse, /upstream_poll_gateway_failed/);
assert.match(runtimeDiagnostics, /normalizeUnifiedFailure/);
assert.match(runtimeDiagnostics, /readWorkerTaskResultPatch/);
assert.match(lifecycle, /normalizeUnifiedFailure/);

console.log("PASS worker runninghub runtime second stage contract");
