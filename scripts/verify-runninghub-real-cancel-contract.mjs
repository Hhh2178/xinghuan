import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const runninghubNode = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const rhToolsNode = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");
const generation = await readFile(new URL("../apps/web/src/services/generation.ts", import.meta.url), "utf8");

assert.match(generation, /export async function cancelGenerationTask/);

for (const [label, source] of [
  ["RunningHubNode", runninghubNode],
  ["RHToolsNode", rhToolsNode],
]) {
  assert.match(source, /cancelGenerationTask/, `${label} must use cancelGenerationTask`);
  assert.match(source, /const handleStop = async \(\)/, `${label} handleStop must be async`);
  assert.match(source, /取消任务/, `${label} should expose explicit cancel wording`);
  assert.match(source, /停止观察/, `${label} should expose explicit local-stop wording`);
}

console.log("PASS runninghub real cancel contract");
