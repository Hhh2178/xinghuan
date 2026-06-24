import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

assert.match(worker, /function resolveRunningHubPollTimeoutMs\(task: TaskRow\)/, "worker should expose a dedicated RunningHub timeout resolver");
assert.match(worker, /function resolveRunningHubPollIntervalMs\(task: TaskRow\)/, "worker should expose a dedicated RunningHub poll interval resolver");
assert.match(worker, /task\.payload\.timeoutMs[\s\S]*task\.payload\.maxPollMs[\s\S]*task\.payload\.pollTimeoutMs[\s\S]*executionRules\.pollingTimeoutMs/, "RunningHub timeout resolver should honor explicit payload timeout before executionRules.pollingTimeoutMs");
assert.match(worker, /return clampOptionalNumber\(explicitTimeoutMs, 5000, 24 \* 60 \* 60 \* 1000\);/, "RunningHub timeout resolver should only clamp explicit timeout values");
assert.doesNotMatch(worker, /inferRunningHubDefaultTimeoutMs/, "RunningHub timeout governance should no longer force a default local timeout");
assert.match(worker, /resolveRunningHubPollIntervalMs\(task\)/, "executeRunningHubTask should use the unified poll interval resolver");
assert.match(worker, /resolveRunningHubPollTimeoutMs\(task\)/, "executeRunningHubTask should use the unified poll timeout resolver");

assert.match(server, /executionRules:\s*matchedCatalogItem\?\.executionRules/, "RunningHub queued task payload should persist matched catalog executionRules");
assert.match(server, /pollTimeoutMs:\s*matchedCatalogItem\?\.executionRules\?\.pollingTimeoutMs/, "RunningHub queued task payload should flatten catalog pollingTimeoutMs");
assert.match(server, /pollIntervalMs:\s*matchedCatalogItem\?\.executionRules\?\.pollingIntervalMs/, "RunningHub queued task payload should flatten catalog pollingIntervalMs");

console.log("PASS runninghub timeout governance contract");
