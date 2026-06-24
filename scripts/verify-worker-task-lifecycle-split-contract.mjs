import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const lifecycle = await readFile(new URL("../apps/worker/src/worker-task-lifecycle.ts", import.meta.url), "utf8");

assert.match(worker, /from "\.\/worker-task-lifecycle\.js"/, "worker.ts should import extracted worker task lifecycle helper");
assert.match(worker, /createWorkerTaskLifecycle\(\{/, "worker.ts should initialize the extracted worker task lifecycle helper");
assert.match(worker, /workerTaskLifecycle\.dropCancelledAttempt\(/, "worker.ts should delegate cancelled result/error drop handling");
assert.match(worker, /workerTaskLifecycle\.keepCancelledState\(/, "worker.ts should delegate cancelled state retention handling");
assert.match(worker, /workerTaskLifecycle\.failTask\(/, "worker.ts should delegate failed task writeback handling");
assert.doesNotMatch(worker, /function createWorkerTaskError\(/, "worker.ts should not keep createWorkerTaskError inline after lifecycle split");
assert.match(lifecycle, /export function createWorkerTaskLifecycle\(/, "worker task lifecycle helper should export the lifecycle factory");
assert.match(lifecycle, /export function createWorkerTaskError\(/, "worker task lifecycle helper should own worker task error creation");
assert.match(lifecycle, /export function buildUpstreamBusinessFailurePatch\(/, "worker task lifecycle helper should own upstream business failure patch builder");

console.log("PASS worker task lifecycle split contract");
