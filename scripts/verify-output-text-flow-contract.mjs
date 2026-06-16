import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const upstreamSource = await readFile(
  new URL("../apps/web/src/components/nodes/useUpstreamMaterials.ts", import.meta.url),
  "utf8",
);
const outputNodeSource = await readFile(
  new URL("../apps/web/src/components/nodes/OutputNode.tsx", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  upstreamSource,
  /pushText\(sid,\s*ud\.reply,\s*`text-field:/,
  "useUpstreamMaterials should not expose the same LLM text twice via reply/prompt field-key overrides",
);
assert.doesNotMatch(
  upstreamSource,
  /pushText\(sid,\s*ud\.prompt,\s*`text-field:/,
  "useUpstreamMaterials should not expose the same fallback text twice via prompt field-key overrides",
);
assert.doesNotMatch(
  outputNodeSource,
  /maxHeight:\s*200/,
  "OutputNode text preview should not hardcode a 200px max height",
);
assert.match(
  outputNodeSource,
  /overflow-hidden flex flex-col/,
  "OutputNode resized body should constrain text content inside the node frame",
);

console.log(JSON.stringify({ ok: true }, null, 2));
