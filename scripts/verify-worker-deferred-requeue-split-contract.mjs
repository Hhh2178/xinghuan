import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const deferredRequeue = await readFile(new URL("../apps/worker/src/worker-deferred-requeue.ts", import.meta.url), "utf8");

assert.match(worker, /from "\.\/worker-deferred-requeue\.js"/, "worker.ts should import extracted deferred/requeue helper");
assert.match(worker, /createWorkerDeferredRequeue\(\{/, "worker.ts should initialize the extracted deferred/requeue helper");
assert.match(worker, /workerDeferredRequeue\.deferTaskExecution\(/, "worker.ts should delegate deferred wait handling");
assert.match(worker, /workerDeferredRequeue\.requeueRunningTask\(/, "worker.ts should delegate running-task requeue glue");
assert.match(worker, /workerDeferredRequeue\.requeueDeferredTaskAfterRelease\(/, "worker.ts should delegate deferred requeue-after-release glue");
assert.match(worker, /shouldRequeueAfterRelease\(queuedResult\)/, "worker.ts should reuse extracted shouldRequeueAfterRelease helper");
assert.doesNotMatch(worker, /async function deferTaskExecution\(/, "worker.ts should not keep deferTaskExecution inline after split");
assert.doesNotMatch(worker, /async function requeueDeferredTask\(/, "worker.ts should not keep requeueDeferredTask inline after split");
assert.doesNotMatch(worker, /async function requeueRunningTask\(/, "worker.ts should not keep requeueRunningTask inline after split");
assert.doesNotMatch(worker, /function capabilityToQueueCapability\(/, "worker.ts should not keep queue capability mapping inline after split");

assert.match(deferredRequeue, /export function createWorkerDeferredRequeue\(/, "deferred/requeue helper should export the factory");
assert.match(deferredRequeue, /deferTaskExecution/, "deferred/requeue helper should own deferred execution wait glue");
assert.match(deferredRequeue, /requeueRunningTask/, "deferred/requeue helper should own running-task requeue glue");
assert.match(deferredRequeue, /requeueDeferredTaskAfterRelease/, "deferred/requeue helper should own post-release deferred requeue glue");
assert.match(deferredRequeue, /export function shouldRequeueAfterRelease\(/, "deferred/requeue helper should own the requeue-after-release policy");
assert.match(deferredRequeue, /export function capabilityToQueueCapability\(/, "deferred/requeue helper should own queue capability mapping");
assert.match(deferredRequeue, /if \(capability === "chat"\) return "video";/, "deferred/requeue helper should preserve chat queue fallback");
assert.match(deferredRequeue, /waitReason:\s*"waiting_runninghub_window"/, "deferred/requeue helper should preserve runninghub wait reason");
assert.match(deferredRequeue, /export type DeferredWaitReason = "waiting_user_window" \| "waiting_runninghub_window";/, "deferred/requeue helper should preserve user/runninghub wait reason boundary");

console.log("PASS worker deferred requeue split contract");
