import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");

const checks = [
  [
    "Worker identifies RunningHub upstream queue-limit failures as retryable",
    /function isRetryableRunningHubQueueLimitError[\s\S]*421[\s\S]*api queue limit reached[\s\S]*API 并发数已达上线/i.test(worker),
  ],
  [
    "Worker requeues claimed RunningHub tasks instead of failing them on queue-limit",
    /await requeueRunningTask\([\s\S]*status:\s*"queued"[\s\S]*waitReason:\s*"waiting_runninghub_window"/i.test(worker),
  ],
  [
    "Process task short-circuits retryable RunningHub queue-limit failures before generic failed update",
    /if \(isRetryableRunningHubQueueLimitError\(error\)\) \{[\s\S]*return;[\s\S]*\}[\s\S]*const failedResult = await updateTask/i.test(worker),
  ],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
