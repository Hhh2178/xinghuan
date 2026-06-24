import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const runningHubClient = await readFile(new URL("../apps/worker/src/worker-runninghub-client.ts", import.meta.url), "utf8");

assert.match(
  runningHubClient,
  /function humanizeRunningHubUpstreamError\(/,
  "RunningHub client should expose a RunningHub upstream error humanizer",
);

assert.match(
  runningHubClient,
  /NODE_INFO_MISMATCH/,
  "Worker should detect upstream node mismatch diagnostics",
);

assert.match(
  runningHubClient,
  /字段与 RunningHub 当前工作流不一致/,
  "Worker should translate node mismatch into a clear Chinese operator-facing error",
);

console.log("PASS runninghub upstream error contract");
