import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const cancelSync = await readFile(new URL("../apps/worker/src/worker-cancel-sync.ts", import.meta.url), "utf8");

assert.match(worker, /from "\.\/worker-cancel-sync\.js"/, "worker.ts should import extracted worker cancel sync helper");
assert.match(worker, /createWorkerCancelSync\(\{/, "worker.ts should initialize the extracted worker cancel sync helper");
assert.match(worker, /workerCancelSync\.handleCancelledClaim\(/, "worker.ts should delegate cancelled claim handling");
assert.match(worker, /workerCancelSync\.dropResultIfCancelled\(/, "worker.ts should delegate cancelled result dropping");
assert.match(worker, /workerCancelSync\.dropErrorIfCancelled\(/, "worker.ts should delegate cancelled error dropping");
assert.match(worker, /workerCancelSync\.keepCompletionCancelledState\(/, "worker.ts should delegate completion cancelled-state retention");
assert.match(worker, /workerCancelSync\.keepRetryCancelledState\(/, "worker.ts should delegate retry cancelled-state retention");
assert.doesNotMatch(worker, /cancel_requested drop result after cancellation/, "worker.ts should not keep cancelled result drop glue inline");
assert.doesNotMatch(worker, /cancel_requested drop error after cancellation/, "worker.ts should not keep cancelled error drop glue inline");
assert.doesNotMatch(worker, /completion kept cancelled state/, "worker.ts should not keep completion cancelled-state glue inline");
assert.doesNotMatch(worker, /retry kept cancelled state/, "worker.ts should not keep retry cancelled-state glue inline");
assert.match(cancelSync, /export function createWorkerCancelSync\(/, "worker cancel sync helper should export the cancel sync factory");
assert.match(cancelSync, /handleCancelledClaim/, "worker cancel sync helper should own cancelled claim handling");
assert.match(cancelSync, /dropResultIfCancelled/, "worker cancel sync helper should own cancelled result dropping");
assert.match(cancelSync, /dropErrorIfCancelled/, "worker cancel sync helper should own cancelled error dropping");
assert.match(cancelSync, /keepCancelledStateIfNeeded/, "worker cancel sync helper should own cancelled state retention glue");

console.log("PASS worker cancel sync split contract");
