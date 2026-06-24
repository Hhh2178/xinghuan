import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function run() {
  const node = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");
  const runnerView = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNodeRunnerView.tsx", import.meta.url), "utf8");
  const paramSection = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNodeParamSection.tsx", import.meta.url), "utf8");
  const runtimeSection = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNodeRuntimeSection.tsx", import.meta.url), "utf8");

  assert.match(runnerView, /from '\.\/RHToolsNodeParamSection'/, "runner view should import extracted param section");
  assert.match(runnerView, /from '\.\/RHToolsNodeRuntimeSection'/, "runner view should import extracted runtime section");
  assert.match(runnerView, /<RHToolsNodeParamSection[\s\S]*nodeInfoList=\{nodeInfoList\}/, "runner view should render extracted param section");
  assert.match(runnerView, /<RHToolsNodeRuntimeSection[\s\S]*isBusy=\{isBusy\}/, "runner view should render extracted runtime section");
  assert.match(paramSection, /export default function RHToolsNodeParamSection\(/, "param section should own parameter rendering");
  assert.match(runtimeSection, /export default function RHToolsNodeRuntimeSection\(/, "runtime section should own runtime rendering");
  assert.doesNotMatch(node, /from '\.\/RHToolsNodeParamSection'|from '\.\/RHToolsNodeRuntimeSection'/, "RHToolsNode should delegate section rendering to extracted runner view");
  assert.doesNotMatch(runnerView, /\{nodeInfoList\.length > 0 && \(/, "runner view should stop rendering parameter section inline");
  assert.doesNotMatch(runnerView, /\{isBusy && \(\s*<div className="flex items-center gap-1 text-\[10px\]"/, "runner view should stop rendering runtime status inline");

  console.log("PASS rh tools node section split contract");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
