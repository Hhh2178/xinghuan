import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function run() {
  const main = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf8");
  const editor = await readFile(new URL("../apps/admin/src/admin-runninghub-item-editor.tsx", import.meta.url), "utf8");
  const providerPanel = await readFile(new URL("../apps/admin/src/admin-api-settings-panel.tsx", import.meta.url), "utf8");
  const sharedRunningHub = await readFile(new URL("../packages/shared/src/runninghub.ts", import.meta.url), "utf8");

  assert.match(main, /runninghub-workspace/, "admin main should register a RunningHub workspace view id");
  assert.match(workspace, /RunningHub 工作台/, "workspace should render RunningHub 工作台");
  assert.match(workspace, /工作流/, "workspace should render 工作流 tab or section");
  assert.match(workspace, /AI 应用/, "workspace should render AI 应用 tab or section");
  assert.match(editor, /输入槽定义/, "item editor should render 输入槽定义 section");
  assert.match(editor, /参数 Schema/, "item editor should render 参数 Schema section");
  assert.match(editor, /输出定义/, "item editor should render 输出定义 section");
  assert.match(editor, /执行描述/, "item editor should render 执行描述 section");
  assert.match(editor, /测试运行/, "item editor should render 测试运行 section");
  assert.match(editor, /预览校验|预览运行|校验预览/, "item editor should make test-run wording explicit as preview/validation");
  assert.doesNotMatch(
    editor,
    /结构化编辑器将在 Task 3 接入|当前任务只提供工作台入口、列表和编辑区域壳子/,
    "item editor should no longer be only a Task 3 placeholder shell",
  );
  assert.doesNotMatch(
    editor,
    /字段映射 JSON[\s\S]{0,600}rows=\{10\}/,
    "item editor should not regress to a giant JSON textarea as the primary RH editing UX",
  );
  assert.match(providerPanel, /进入 RH 工作台/, "provider settings panel should expose workspace entry action");
  assert.doesNotMatch(
    providerPanel,
    /字段映射 JSON|工作流 JSON/,
    "provider settings panel should no longer contain old inline RunningHub JSON editing copy",
  );
  assert.doesNotMatch(
    sharedRunningHub,
    /parameterSchema\??:|outputSchema\??:|executionRules\??:|testPayload\??:/,
    "shared RunningHub catalog contract should stay free of admin editor metadata",
  );

  console.log("PASS admin RunningHub workspace contract");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
