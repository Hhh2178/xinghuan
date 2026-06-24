import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function run() {
  const node = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");
  const paramSection = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNodeParamSection.tsx", import.meta.url), "utf8");
  const runtimeSection = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNodeRuntimeSection.tsx", import.meta.url), "utf8");

  assert.match(node, /from '\.\/RHToolsNodeParamSection'/, "RHToolsNode should import extracted param section");
  assert.match(node, /from '\.\/RHToolsNodeRuntimeSection'/, "RHToolsNode should import extracted runtime section");
  assert.match(node, /<RHToolsNodeParamSection[\s\S]*nodeInfoList=\{nodeInfoList\}/, "RHToolsNode should render extracted param section");
  assert.match(node, /<RHToolsNodeRuntimeSection[\s\S]*isBusy=\{isBusy\}/, "RHToolsNode should render extracted runtime section");
  assert.match(paramSection, /export default function RHToolsNodeParamSection\(/, "param section should own parameter rendering");
  assert.match(runtimeSection, /export default function RHToolsNodeRuntimeSection\(/, "runtime section should own runtime rendering");
  assert.doesNotMatch(node, /\{nodeInfoList\.length > 0 && \(/, "RHToolsNode should stop rendering parameter section inline");
  assert.doesNotMatch(node, /\{isBusy && \(\s*<div className="flex items-center gap-1 text-\[10px\]"/, "RHToolsNode should stop rendering runtime status inline");

  console.log("PASS rh tools node section split contract");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
