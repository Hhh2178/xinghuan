import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const store = await readFile(new URL("../apps/worker/src/worker-task-store.ts", import.meta.url), "utf8");

assert.match(worker, /from "\.\/worker-task-store\.js"/, "worker.ts should import extracted worker task store");
assert.match(worker, /createWorkerTaskStore\(pool\)/, "worker.ts should initialize the extracted worker task store");
assert.doesNotMatch(worker, /async function readTask\(/, "worker.ts should not keep readTask inline after task store split");
assert.doesNotMatch(worker, /async function updateTask\(/, "worker.ts should not keep updateTask inline after task store split");
assert.doesNotMatch(worker, /async function appendTaskLog\(/, "worker.ts should not keep appendTaskLog inline after task store split");
assert.doesNotMatch(worker, /async function touchTaskRuntime\(/, "worker.ts should not keep touchTaskRuntime inline after task store split");
assert.doesNotMatch(worker, /async function touchQueuedTaskRuntime\(/, "worker.ts should not keep touchQueuedTaskRuntime inline after task store split");
assert.doesNotMatch(worker, /async function isTaskCancelled\(/, "worker.ts should not keep isTaskCancelled inline after task store split");
assert.match(store, /export function createWorkerTaskStore\(pool: Pool\)/, "worker task store should export the factory");
assert.match(store, /export interface TaskRow/, "worker task store should own the TaskRow shape");

console.log("PASS worker task store split contract");
