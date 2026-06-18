import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function run() {
  const main = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf8");
  const providerPanel = await readFile(new URL("../apps/admin/src/admin-api-settings-panel.tsx", import.meta.url), "utf8");

  assert.match(main, /runninghub-workspace/, "admin main should register a RunningHub workspace view id");
  assert.match(workspace, /RunningHub 工作台/, "workspace should render RunningHub 工作台");
  assert.match(workspace, /工作流/, "workspace should render 工作流 tab or section");
  assert.match(workspace, /AI 应用/, "workspace should render AI 应用 tab or section");
  assert.match(providerPanel, /进入 RH 工作台/, "provider settings panel should expose workspace entry action");
  assert.doesNotMatch(
    providerPanel,
    /字段映射 JSON|工作流 JSON/,
    "provider settings panel should no longer contain old inline RunningHub JSON editing copy",
  );

  console.log("PASS admin RunningHub workspace contract");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
