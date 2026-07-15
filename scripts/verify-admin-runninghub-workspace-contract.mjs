import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function run() {
  const main = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf8");
  const workspaceHelpers = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace-helpers.tsx", import.meta.url), "utf8");
  const editor = await readFile(new URL("../apps/admin/src/admin-runninghub-item-editor.tsx", import.meta.url), "utf8");
  const providerPanel = await readFile(new URL("../apps/admin/src/admin-api-settings-panel.tsx", import.meta.url), "utf8");
  const sharedRunningHub = await readFile(new URL("../packages/shared/src/runninghub.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../apps/admin/src/styles.css", import.meta.url), "utf8");

  assert.match(main, /runninghub-workspace/, "admin main should register a RunningHub workspace view id");
  assert.match(workspace, /RunningHub 工作台/, "workspace should render RunningHub 工作台");
  assert.match(workspace, /工作流/, "workspace should render 工作流 tab or section");
  assert.match(workspace, /AI 应用/, "workspace should render AI 应用 tab or section");
  assert.match(
    workspaceHelpers,
    /section\.key === "inputs"[\s\S]{0,300}payload\.fields/,
    "workspace should apply analyzed input-slot drafts into item fields",
  );
  assert.match(editor, /输入槽定义/, "item editor should render 输入槽定义 section");
  assert.match(editor, /参数 Schema/, "item editor should render 参数 Schema section");
  assert.match(editor, /输出定义/, "item editor should render 输出定义 section");
  assert.match(editor, /执行规则/, "item editor should render 执行规则 section");
  assert.match(editor, /测试运行/, "item editor should render 测试运行 section");
  assert.match(editor, /预览校验|预览运行|校验预览/, "item editor should make test-run wording explicit as preview/validation");
  assert.match(
    workspaceHelpers,
    /export function mergeDraftSectionsToUpdatePayload/,
    "workspace helpers should expose analyzed-section merging",
  );
  assert.match(
    workspace,
    /const payload = mergeDraftSectionsToUpdatePayload[\s\S]{0,220}handleSave\(selectedItem\.catalogId, payload\)/,
    "workspace should merge analyzed sections into one save when applying all drafts",
  );
  assert.match(
    workspaceHelpers,
    /function readMeaningfulDraftText\(value: unknown\)[\s\S]{0,220}value\.trim\(\) \? value : undefined;/,
    "workspace should normalize analyzed base text before applying drafts",
  );
  assert.match(
    workspaceHelpers,
    /payload\.title = readMeaningfulDraftText\(section\.payload\.title\) \?\? selectedItem\.title;/,
    "workspace should keep existing title when analyzed base title is blank",
  );
  assert.match(
    workspaceHelpers,
    /payload\.pageId = readMeaningfulDraftText\(section\.payload\.pageId\) \?\? selectedItem\.pageId;/,
    "workspace should keep existing pageId when analyzed base pageId is blank",
  );
  assert.match(
    workspaceHelpers,
    /const nextRunTargetId = readMeaningfulDraftText\(section\.payload\.runTargetId\)[\s\S]{0,600}payload\.runTargetId = nextRunTargetId;/,
    "workspace should keep existing runTargetId when analyzed base target id is blank",
  );
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
  assert.doesNotMatch(providerPanel, /进入 RH 工作台/, "provider settings should not duplicate the independent RH workspace entry");
  assert.doesNotMatch(
    providerPanel,
    /字段映射 JSON|工作流 JSON/,
    "provider settings panel should no longer contain old inline RunningHub JSON editing copy",
  );
  assert.doesNotMatch(
    sharedRunningHub,
    /executionRules\??:|testPayload\??:/,
    "shared RunningHub catalog contract should stay free of admin-only execution/test metadata",
  );
  assert.match(sharedRunningHub, /parameterSchema\??:/, "shared RunningHub contract should expose parameterSchema for node rendering");
  assert.match(sharedRunningHub, /outputSchema\??:/, "shared RunningHub contract should expose outputSchema for node output adaptation");
  assert.match(workspace, /admin-runninghub-list-item__title/, "catalog cards should expose an explicit title track");
  assert.match(workspace, /admin-runninghub-list-item__note/, "catalog cards should expose an explicit note track");
  assert.match(workspace, /admin-runninghub-list-item__summary/, "catalog cards should expose an explicit capability summary track");
  assert.match(workspace, /admin-runninghub-list-item__warning/, "catalog cards should expose a bounded warning track");
  assert.match(workspace, /admin-runninghub-list-item__footer/, "catalog cards should expose a footer track for status and Provider");
  assert.match(workspace, /title=\{item\.title \|\| item\.catalogId\}/, "truncated catalog titles should retain a native tooltip");
  assert.match(styles, /\.admin-runninghub-list-item__title\s*\{[\s\S]{0,320}white-space:\s*nowrap;[\s\S]{0,160}text-overflow:\s*ellipsis;/, "catalog titles should clamp to one line");
  assert.match(styles, /\.admin-runninghub-list-item__note\s*\{[\s\S]{0,320}-webkit-line-clamp:\s*2;/, "catalog notes should clamp to two lines");
  assert.match(styles, /\.admin-runninghub-list-item__summary\s*\{[\s\S]{0,320}white-space:\s*nowrap;[\s\S]{0,160}text-overflow:\s*ellipsis;/, "catalog summaries should clamp to one line");
  assert.match(styles, /\.admin-runninghub-list-item__warning\s*\{[\s\S]{0,320}-webkit-line-clamp:\s*2;/, "catalog warnings should clamp to two lines");
  assert.match(styles, /\.admin-main\s*>\s*\*[\s\S]{0,400}min-width:\s*0;/, "Admin page children should be shrink-safe");

  console.log("PASS admin RunningHub workspace contract");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
