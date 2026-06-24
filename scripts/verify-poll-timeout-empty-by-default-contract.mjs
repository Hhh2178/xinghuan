import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const adminModelEditor = await readFile(new URL("../apps/admin/src/admin-model-editor.tsx", import.meta.url), "utf8");
const adminRunninghubEditor = await readFile(new URL("../apps/admin/src/admin-runninghub-item-editor.tsx", import.meta.url), "utf8");
const apiServer = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const externalProxy = await readFile(new URL("../apps/api/src/external-proxy.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const workerMediaPolling = await readFile(new URL("../apps/worker/src/worker-media-polling.ts", import.meta.url), "utf8");
const workerGrsaiClient = await readFile(new URL("../apps/worker/src/worker-grsai-image-client.ts", import.meta.url), "utf8");
const apiGrsaiClient = await readFile(new URL("../apps/api/src/grsai-image-adapter.ts", import.meta.url), "utf8");

assert.match(adminModelEditor, /if \(!Number\.isFinite\(value\) \|\| value <= 0\) return "";/, "admin model editor should display empty poll timeout by default");
assert.match(adminModelEditor, /placeholder="留空表示不设置"/, "admin model editor should explain empty poll timeout input");
assert.match(adminModelEditor, /delete advancedConfig\.pollTimeoutMs;/, "admin model editor should remove poll timeout when left empty");
assert.doesNotMatch(adminModelEditor, /默认 360 秒/, "admin model editor should no longer advertise a default poll timeout");

assert.match(adminRunninghubEditor, /pollingTimeoutMs: undefined/, "RunningHub editor should initialize empty timeout");
assert.match(adminRunninghubEditor, /pollingTimeoutMs: raw \? Math\.max\(0, Number\(raw\) \|\| 0\) : undefined/, "RunningHub editor should keep timeout undefined when input is empty");

assert.doesNotMatch(apiServer, /advancedConfig\.pollTimeoutMs = 360000;/, "AI analysis should not auto-fill 360000ms timeout");
assert.doesNotMatch(apiServer, /advancedConfig\.pollTimeoutMs = 600000;/, "AI analysis should not auto-fill 600000ms timeout");
assert.match(apiServer, /pollingTimeoutMs: undefined/, "RunningHub execution rules derived from examples should default to empty timeout");

assert.match(externalProxy, /const pollTimeoutMs = clampOptionalInteger\(input\.advancedConfig\.pollTimeoutMs, 30000, 600000\);/, "external proxy should only use explicit poll timeout values");
assert.match(worker, /timeoutMs: clampOptionalNumber\(task\.payload\.timeoutMs \|\| task\.payload\.maxPollMs \|\| task\.payload\.pollTimeoutMs, 5000, 1800000\)/, "worker provider tasks should only use explicit timeout values");
assert.match(workerMediaPolling, /timeoutMs\?: number;/, "worker polling helpers should accept optional timeout");
assert.match(workerGrsaiClient, /typeof options\.timeoutMs === "number" && Number\.isFinite\(options\.timeoutMs\) && options\.timeoutMs > 0/, "worker GRSAI client should enable timeout only when explicitly configured");
assert.match(apiGrsaiClient, /typeof options\.timeoutMs === "number" && Number\.isFinite\(options\.timeoutMs\) && options\.timeoutMs > 0/, "API GRSAI client should enable timeout only when explicitly configured");

console.log("PASS poll timeout empty-by-default contract");
