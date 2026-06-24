import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const client = await readFile(new URL("../apps/worker/src/worker-runninghub-client.ts", import.meta.url), "utf8");

assert.match(worker, /function resolveRunningHubPollTimeoutMs\(task: TaskRow\)/, "worker should keep a dedicated RunningHub timeout resolver");
assert.match(worker, /return clampOptionalNumber\(/, "RunningHub timeout resolver should now be optional and only clamp explicit timeout values");
assert.doesNotMatch(worker, /inferRunningHubDefaultTimeoutMs/, "worker should no longer infer a default RunningHub polling timeout");
assert.match(client, /if \(typeof input\.timeoutMs === "number" && Number\.isFinite\(input\.timeoutMs\) && input\.timeoutMs > 0\) \{[\s\S]*?RunningHub 轮询超时/, "RunningHub worker client should enforce timeout only when an explicit timeout is configured");

console.log("PASS runninghub worker no-default-timeout contract");
