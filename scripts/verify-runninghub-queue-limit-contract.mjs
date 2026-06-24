import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const deferredRequeue = await readFile(new URL("../apps/worker/src/worker-deferred-requeue.ts", import.meta.url), "utf8");

assert.match(worker, /function isRetryableRunningHubQueueLimitError[\s\S]*421[\s\S]*api queue limit reached[\s\S]*API 并发数已达上线/i);
assert.match(worker, /workerDeferredRequeue\.requeueRunningTask\(/);
assert.match(deferredRequeue, /status:\s*"queued"[\s\S]*waitReason:\s*"waiting_runninghub_window"/i);
assert.match(worker, /if \(isRetryableRunningHubQueueLimitError\(error\)\) \{[\s\S]*return;[\s\S]*\}[\s\S]*await workerTaskLifecycle\.failTask\(/);

console.log("PASS runninghub queue limit contract");
