import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const workerCancelSync = await readFile(new URL("../apps/worker/src/worker-cancel-sync.ts", import.meta.url), "utf8");
const workerTaskLifecycle = await readFile(new URL("../apps/worker/src/worker-task-lifecycle.ts", import.meta.url), "utf8");
const workerGrsai = await readFile(new URL("../apps/worker/src/worker-grsai-image-client.ts", import.meta.url), "utf8");
const workerMediaPolling = await readFile(new URL("../apps/worker/src/worker-media-polling.ts", import.meta.url), "utf8");
const workerRunningHubClient = await readFile(new URL("../apps/worker/src/worker-runninghub-client.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const shared = await readFile(new URL("../packages/shared/src/index.ts", import.meta.url), "utf8");
const failedUpdateBlock = workerTaskLifecycle.match(/const normalized = normalizeUnifiedFailure\(input\.error\);[\s\S]*?const failedResult = await options\.updateTask\([\s\S]*?upstreamResponseSnippet:\s*normalized\.upstreamResponseSnippet,[\s\S]*?\}\s*\);/);

assert.match(shared, /failureCategory/);
assert.match(shared, /cancelState/);
assert.match(workerCancelSync, /cancel_requested/);
assert.ok(failedUpdateBlock, "worker failed update block should normalize runtime failure before updateTask");
assert.match(failedUpdateBlock[0], /failureReason:\s*normalized\.failureReason/);
assert.match(failedUpdateBlock[0], /failureCategory:\s*normalized\.failureCategory/);
assert.match(failedUpdateBlock[0], /providerDiagnostic:\s*normalized\.providerDiagnostic/);
assert.match(failedUpdateBlock[0], /upstreamHttpStatus:\s*normalized\.upstreamHttpStatus/);
assert.match(failedUpdateBlock[0], /upstreamResponseSnippet:\s*normalized\.upstreamResponseSnippet/);
assert.match(workerRunningHubClient, /upstream_poll_gateway_failed/);
assert.match(worker, /GRSAI 图像任务未返回可用图片/);
assert.match(workerGrsai, /return `GRSAI 任务状态 \$\{status\} 但未返回图片/);
assert.match(workerGrsai, /const message = buildMissingGrsaiImageResultError\(.*?failureCategory:\s*"upstream_business_failed"/s);
assert.match(workerGrsai, /upstreamHttpStatus:\s*status/);
assert.match(workerGrsai, /upstreamResponseSnippet:\s*responseBody\.bodySnippet/);
assert.match(workerMediaPolling, /APIMart 图像任务失败:\s\$\{status \|\| "unknown"\}/);
assert.match(workerMediaPolling, /ModelScope 图像任务失败:\s\$\{status \|\| "unknown"\}/);
assert.match(workerMediaPolling, /视频任务失败:\s\$\{failureDetail\}/);
assert.match(workerMediaPolling, /buildUpstreamBusinessFailurePatch\(status \|\| "unknown", text\)/);
assert.match(workerMediaPolling, /buildUpstreamBusinessFailurePatch\(failureDetail\)/);
assert.match(server, /queueHint/);

console.log("PASS unified protocol runtime contract");
