import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const runninghubNode = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const runninghubNodeHelpers = await readFile(
  new URL("../apps/web/src/components/nodes/runninghubNodeHelpers.ts", import.meta.url),
  "utf8",
);
const rhToolsNode = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");

assert.match(
  runninghubNode,
  /import\s*\{[\s\S]*?buildRhOutputStateFromUrls,[\s\S]*?emptyRhOutputState,[\s\S]*?\}\s*from\s*['"]\.\/runninghubNodeHelpers['"]/,
  "RunningHubNode should import output reset helpers from runninghubNodeHelpers",
);

assert.match(
  runninghubNodeHelpers,
  /function emptyRhOutputState\(\)/,
  "RunningHubNode helper module should define an explicit output reset helper",
);

assert.match(
  runninghubNodeHelpers,
  /function buildRhOutputStateFromUrls\(list: string\[\]\)/,
  "RunningHubNode helper module should normalize success output state from the latest RH url list",
);

assert.match(
  rhToolsNode,
  /import\s*\{[\s\S]*?buildRhToolsOutputStateFromUrls,[\s\S]*?emptyRhToolsOutputState,[\s\S]*?\}\s*from\s*['"]\.\/rhToolsNodeHelpers['"]/,
  "RHToolsNode should import explicit output reset helpers from rhToolsNodeHelpers",
);

assert.match(
  rhToolsNode,
  /const patch: any = \{ status: 'success', \.\.\.buildRhToolsOutputStateFromUrls\(list\) \};/,
  "RHToolsNode should overwrite all output carrier fields with the newest RH results on success",
);

assert.match(
  rhToolsNode,
  /update\(\{\s*status: 'submitting',[\s\S]*?error: null,[\s\S]*?taskId: null,[\s\S]*?\.\.\.emptyRhToolsOutputState\(\),?[\s\S]*?\}\);/,
  "RHToolsNode should clear all previous output fields before a new RH run starts",
);

for (const [name, source] of [
  ["RunningHubNode", runninghubNode],
]) {
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
