import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");

assert.match(worker, /async function acquireRunningHubExecutionWindow/);
assert.match(worker, /preferredRhKeyId/);
assert.match(worker, /assignedRhKeyId/);

assert.match(
  worker,
  /for \(const item of ordered\)/,
  "runninghub key acquisition should iterate ordered keys",
);

assert.match(
  worker,
  /await redisControl\.incr\(key\)/,
  "runninghub key acquisition must still use redis incr guard",
);

assert.match(
  worker,
  /continue;/,
  "runninghub key acquisition should continue to later keys after one key loses the race",
);

assert.match(
  worker,
  /RunningHub 所有 Key 并发已满 \(all_keys_busy\)/,
  "worker should only report all_keys_busy after all keys are exhausted",
);

console.log("PASS runninghub key acquire fallback contract");
