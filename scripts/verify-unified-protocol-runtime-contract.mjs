import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const workerGrsai = await readFile(new URL("../apps/worker/src/worker-grsai-image-client.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const shared = await readFile(new URL("../packages/shared/src/index.ts", import.meta.url), "utf8");
const failedUpdateBlock = worker.match(/const normalized = normalizeUnifiedFailure\(error\);[\s\S]*?const failedResult = await updateTask\(taskId, "failed", \[[\s\S]*?\}\);/);

assert.match(shared, /failureCategory/);
assert.match(shared, /cancelState/);
assert.match(worker, /cancel_requested/);
assert.ok(failedUpdateBlock, "worker failed update block should normalize runtime failure before updateTask");
assert.match(failedUpdateBlock[0], /failureReason:\s*normalized\.failureReason/);
assert.match(failedUpdateBlock[0], /failureCategory:\s*normalized\.failureCategory/);
assert.match(failedUpdateBlock[0], /providerDiagnostic:\s*normalized\.providerDiagnostic/);
assert.match(failedUpdateBlock[0], /upstreamHttpStatus:\s*normalized\.upstreamHttpStatus/);
assert.match(failedUpdateBlock[0], /upstreamResponseSnippet:\s*normalized\.upstreamResponseSnippet/);
assert.match(worker, /upstream_poll_gateway_failed/);
assert.match(worker, /GRSAI 图像任务未返回可用图片[\s\S]*failureCategory:\s*"upstream_business_failed"/);
assert.match(workerGrsai, /return `GRSAI 任务状态 \$\{status\} 但未返回图片/);
assert.match(workerGrsai, /const message = buildMissingGrsaiImageResultError\(.*?failureCategory:\s*"upstream_business_failed"/s);
assert.match(workerGrsai, /upstreamHttpStatus:\s*status/);
assert.match(workerGrsai, /upstreamResponseSnippet:\s*responseBody\.bodySnippet/);
assert.match(worker, /APIMart 图像任务失败[\s\S]*failureCategory:\s*"upstream_business_failed"/);
assert.match(worker, /ModelScope 图像任务失败[\s\S]*failureCategory:\s*"upstream_business_failed"/);
assert.match(worker, /视频任务失败[\s\S]*failureCategory:\s*"upstream_business_failed"/);
assert.match(server, /queueHint/);

console.log("PASS unified protocol runtime contract");
