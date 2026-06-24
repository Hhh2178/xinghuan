import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function run() {
  const node = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");
  const runnerView = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNodeRunnerView.tsx", import.meta.url), "utf8");
  const launcherView = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNodeLauncherView.tsx", import.meta.url), "utf8");

  assert.match(node, /from '\.\/RHToolsNodeRunnerView'/, "RHToolsNode should import extracted runner view");
  assert.match(node, /from '\.\/RHToolsNodeLauncherView'/, "RHToolsNode should import extracted launcher view");
  assert.match(node, /<RHToolsNodeRunnerView[\s\S]*activeApp=\{activeApp\}/, "RHToolsNode should render extracted runner view");
  assert.match(node, /<RHToolsNodeLauncherView[\s\S]*filteredTools=\{filteredTools\}/, "RHToolsNode should render extracted launcher view");
  assert.match(runnerView, /export default function RHToolsNodeRunnerView\(/, "runner view should export split runner shell");
  assert.match(launcherView, /export default function RHToolsNodeLauncherView\(/, "launcher view should export split launcher shell");
  assert.doesNotMatch(node, /title="返回应用列表"/, "RHToolsNode should stop rendering runner header inline");
  assert.doesNotMatch(node, /悬停应用查看简介，点击启动/, "RHToolsNode should stop rendering launcher footer inline");

  console.log("PASS rh tools node view split contract");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
