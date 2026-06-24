import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const taskStore = await readFile(new URL("../apps/worker/src/worker-task-store.ts", import.meta.url), "utf8");
const runningHubClient = await readFile(new URL("../apps/worker/src/worker-runninghub-client.ts", import.meta.url), "utf8");
const projection = await readFile(new URL("../apps/api/src/task-runtime-projection.ts", import.meta.url), "utf8");

assert.match(taskStore, /replaceResult:\s*boolean/, "worker task store should support replaceResult updates");
assert.match(taskStore, /result = \$\{replaceResult \? "\$4::jsonb" : "coalesce\(result, '\{\}'::jsonb\) \|\| \$4::jsonb"\}/, "worker task store should support full result replacement when requested");

assert.match(runningHubClient, /providerState:/, "RunningHub client heartbeat should emit providerState");
assert.match(runningHubClient, /runtimeStage: "submitted"/, "RunningHub client should emit submitted stage");
assert.match(runningHubClient, /runtimeStage: "polling"/, "RunningHub client should emit polling stage");
assert.match(runningHubClient, /failureCategory: "upstream_poll_timeout"/, "RunningHub timeout should normalize to upstream_poll_timeout");
assert.match(runningHubClient, /upstreamTaskId/, "RunningHub timeout should preserve upstream task id context");
assert.match(worker, /resolveRunningHubPollTimeoutMs\(task\)/, "worker RunningHub execution should use the unified timeout resolver");
assert.match(worker, /resolveRunningHubPollIntervalMs\(task\)/, "worker RunningHub execution should use the unified poll interval resolver");

assert.match(worker, /clearTransientRuntimeFields/, "worker should clear stale queue/runtime hints before terminal writeback");
assert.match(worker, /replaceResult: normalizeProtocol\(task\.providerProtocol\) === "runninghub"/, "worker terminal RunningHub writeback should replace stale transient fields");
assert.match(worker, /providerState: normalizeProtocol\(task\.providerProtocol\) === "runninghub" \? "SUCCESS"/, "worker success writeback should normalize providerState");
assert.match(taskStore, /replaceResult:\s*boolean/, "worker failure writeback path depends on replaceResult-capable store");
assert.match(runningHubClient, /providerState: "FAILED"/, "RunningHub timeout should normalize failed providerState");

assert.match(projection, /providerStateText\.toUpperCase\(\) === "QUEUED"/);
assert.match(projection, /displayMessage: waitDetail \|\| queueHint \|\| "任务正在等待可用执行窗口。"/);

console.log("PASS runninghub runtime state contract");
