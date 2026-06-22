import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");

assert.match(
  worker,
  /function humanizeRunningHubUpstreamError\(/,
  "Worker should expose a RunningHub upstream error humanizer",
);

assert.match(
  worker,
  /NODE_INFO_MISMATCH/,
  "Worker should detect upstream node mismatch diagnostics",
);

assert.match(
  worker,
  /字段与 RunningHub 当前工作流不一致/,
  "Worker should translate node mismatch into a clear Chinese operator-facing error",
);

console.log("PASS runninghub upstream error contract");
