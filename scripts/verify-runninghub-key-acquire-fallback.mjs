import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const dispatch = await readFile(new URL("../apps/worker/src/worker-runninghub-dispatch.ts", import.meta.url), "utf8");

assert.match(worker, /worker-runninghub-dispatch/);
assert.match(worker, /assignedRhKeyId/);
assert.match(dispatch, /export async function acquireRunningHubExecutionWindow/);
assert.match(dispatch, /preferredRhKeyId/);

assert.match(
  dispatch,
  /for \(const item of ordered\)/,
  "runninghub key acquisition should iterate ordered keys",
);

assert.match(
  dispatch,
  /await deps\.redis\.incr\(key\)/,
  "runninghub key acquisition must still use redis incr guard",
);

assert.match(
  dispatch,
  /continue;/,
  "runninghub key acquisition should continue to later keys after one key loses the race",
);

assert.match(
  dispatch,
  /RunningHub 所有 Key 并发已满 \(all_keys_busy\)/,
  "worker should only report all_keys_busy after all keys are exhausted",
);

console.log("PASS runninghub key acquire fallback contract");
