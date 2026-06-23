import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function run() {
  const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
  const helper = await readFile(new URL("../apps/web/src/components/nodes/runninghubNodeHelpers.ts", import.meta.url), "utf8");

  assert.match(node, /from '\.\/runninghubNodeHelpers'/, "RunningHubNode should import extracted helper module");
  assert.match(helper, /export function inferValueType\(/, "helper should own inferValueType");
  assert.match(helper, /export function extractFieldOptions\(/, "helper should own extractFieldOptions");
  assert.match(helper, /export function extractDefaultValue\(/, "helper should own extractDefaultValue");
  assert.match(helper, /export function fieldDisplayLabel\(/, "helper should own fieldDisplayLabel");
  assert.match(helper, /export function emptyRhOutputState\(/, "helper should own emptyRhOutputState");
  assert.match(helper, /export function buildRhOutputStateFromUrls\(/, "helper should own buildRhOutputStateFromUrls");
  assert.match(helper, /export function countSchemaProperties\(/, "helper should own countSchemaProperties");
  assert.match(helper, /export function mergeNodeInfoListWithPresetMetadata\(/, "helper should own preset metadata merge");
  assert.match(helper, /export function normalizeRemoteNodeInfoList\(/, "helper should own remote node info normalization");
  assert.doesNotMatch(
    node,
    /function inferValueType\(|function extractFieldOptions\(|function extractDefaultValue\(|function fieldDisplayLabel\(|function emptyRhOutputState\(|function buildRhOutputStateFromUrls\(|function countSchemaProperties\(|function mergeNodeInfoListWithPresetMetadata\(|function normalizeRemoteNodeInfoList\(/,
    "RunningHubNode should stop defining extracted helper functions inline",
  );

  console.log("PASS runninghub node helper split contract");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
