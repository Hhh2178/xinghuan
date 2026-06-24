import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function run() {
  const node = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");
  const helper = await readFile(new URL("../apps/web/src/components/nodes/rhToolsNodeHelpers.ts", import.meta.url), "utf8");

  assert.match(node, /from '\.\/rhToolsNodeHelpers'/, "RHToolsNode should import extracted helper module");
  assert.match(helper, /export function inferRhToolsValueType\(/, "helper should own inferRhToolsValueType");
  assert.match(helper, /export function extractRhToolsFieldOptions\(/, "helper should own extractRhToolsFieldOptions");
  assert.match(helper, /export function extractRhToolsDefaultValue\(/, "helper should own extractRhToolsDefaultValue");
  assert.match(helper, /export function rhToolsFieldDisplayLabel\(/, "helper should own rhToolsFieldDisplayLabel");
  assert.match(helper, /export function emptyRhToolsOutputState\(/, "helper should own emptyRhToolsOutputState");
  assert.match(helper, /export function buildRhToolsOutputStateFromUrls\(/, "helper should own buildRhToolsOutputStateFromUrls");
  assert.doesNotMatch(
    node,
    /function inferValueType\(|function extractFieldOptions\(|function extractDefaultValue\(|function fieldDisplayLabel\(|function emptyRhOutputState\(|function buildRhOutputStateFromUrls\(/,
    "RHToolsNode should stop defining extracted helper functions inline",
  );

  console.log("PASS rh tools node helper split contract");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
