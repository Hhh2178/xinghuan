import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const runningHubNode = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const rhToolsNode = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");

assert.match(worker, /all_keys_busy/);
assert.match(worker, /cancel_requested/);
assert.match(runningHubNode, /handleStop/);
assert.match(runningHubNode, /cancelGenerationTask/);
assert.match(rhToolsNode, /handleStop/);
assert.match(rhToolsNode, /cancelGenerationTask/);

console.log("PASS runninghub governance phase-a contract");
