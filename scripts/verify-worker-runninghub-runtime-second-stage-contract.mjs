import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const runningHubResponse = await readFile(new URL("../apps/worker/src/worker-runninghub-response.ts", import.meta.url), "utf8");
const runtimeDiagnostics = await readFile(new URL("../apps/worker/src/worker-runtime-diagnostics.ts", import.meta.url), "utf8");

assert.match(worker, /parseRunningHubPollJsonResponse/);
assert.match(worker, /selectExecutableRunningHubKey/);
assert.match(worker, /normalizeUnifiedFailure/);
assert.match(worker, /worker-runtime-diagnostics/);
assert.match(runningHubResponse, /export function parseRunningHubPollJsonResponse/);
assert.match(runningHubResponse, /upstream_poll_gateway_failed/);
assert.match(runtimeDiagnostics, /export function normalizeUnifiedFailure/);
assert.match(runtimeDiagnostics, /export function readWorkerTaskResultPatch/);

console.log("PASS worker runninghub runtime second stage contract");
