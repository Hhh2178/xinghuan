import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const runninghubNode = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const rhToolsNode = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");

for (const [name, source] of [
  ["RunningHubNode", runninghubNode],
  ["RHToolsNode", rhToolsNode],
]) {
  assert.match(
    source,
    /function emptyRhOutputState\(\)/,
    `${name} should define an explicit output reset helper`,
  );

  assert.match(
    source,
    /function buildRhOutputStateFromUrls\(list: string\[\]\)/,
    `${name} should normalize success output state from the latest RH url list`,
  );

  assert.match(
    source,
    /update\(\{\s*status: 'submitting',[\s\S]*?error: null,[\s\S]*?taskId: null,[\s\S]*?\.\.\.emptyRhOutputState\(\),?[\s\S]*?\}\);/,
    `${name} should clear all previous output fields before a new RH run starts`,
  );

  assert.match(
    source,
    /const patch: any = \{ status: 'success', \.\.\.buildRhOutputStateFromUrls\(list\) \};/,
    `${name} should overwrite all output carrier fields with the newest RH results on success`,
  );
}

console.log("PASS runninghub output reset contract");
