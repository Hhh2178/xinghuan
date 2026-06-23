import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf-8");
const adminSettings = await readFile(new URL("../apps/admin/src/admin-api-settings-panel.tsx", import.meta.url), "utf-8");
const adminWorkspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf-8");
const adminEditor = await readFile(new URL("../apps/admin/src/admin-runninghub-item-editor.tsx", import.meta.url), "utf-8");
const adminTypes = await readFile(new URL("../apps/admin/src/admin-types.ts", import.meta.url), "utf-8");
const adminMain = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf-8");
const adminApiClient = await readFile(new URL("../apps/admin/src/admin-api-client.ts", import.meta.url), "utf-8");
const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf-8");
const nodeSchema = await readFile(new URL("../apps/web/src/utils/runninghubNodeSchema.ts", import.meta.url), "utf-8");
const catalogService = await readFile(new URL("../apps/web/src/services/runninghubCatalog.ts", import.meta.url), "utf-8");
const sharedRunninghub = await readFile(new URL("../packages/shared/src/runninghub.ts", import.meta.url), "utf-8");

const checks = [
  ["API exposes runninghub catalog endpoint", /\/api\/runninghub\/catalog/.test(api) && /publicRunningHubCatalog/.test(api)],
  [
    "API normalizes workflow json and field definitions",
    /normalizeRunningHubFieldDefinitions/.test(api)
      && /normalizeRunningHubFieldOptions/.test(api)
      && /normalizeOptionalJsonText/.test(api),
  ],
  [
    "Admin exposes RunningHub workspace shell instead of inline workflow editor",
    /进入 RH 工作台/.test(adminSettings) &&
      /runninghub-workspace/.test(adminMain) &&
      /RunningHub 工作台/.test(adminWorkspace) &&
      /工作流/.test(adminWorkspace) &&
      /AI 应用/.test(adminWorkspace) &&
      /admin-runninghub-editor__section-chip/.test(adminEditor),
  ],
  [
    "Admin hands selected provider context into RunningHub workspace",
    /onOpenRunningHubWorkspace/.test(adminSettings) &&
      /setRunningHubWorkspaceProviderId/.test(adminMain) &&
      /selectedProviderId/.test(adminWorkspace),
  ],
  [
    "Admin workspace preserves detected RH kind drift and migration hints",
    /const analyzeTargetKind = analyzeDraft\?\.detectedKind === "app"/.test(adminWorkspace) &&
      /setAnalyzeHint\(autoSwitchHint \|\| draft\.autoSwitchMessage \|\| draft\.summary\)/.test(adminWorkspace) &&
      /检测到这是 AI App，应用草案时会自动迁移到 AI 应用目录/.test(adminWorkspace) &&
      /检测到这是工作流，应用草案时会自动迁移到工作流目录/.test(adminWorkspace),
  ],
  [
    "Admin types expose detect metadata for RH analyze draft",
    /detectedKind\?: "app" \| "workflow"/.test(adminTypes) &&
      /detectedTargetId\?: string;/.test(adminTypes) &&
      /autoSwitchMessage\?: string;/.test(adminTypes),
  ],
  ["Web has runninghub catalog service", /fetchRunningHubCatalog/.test(catalogService) && /buildRunningHubAppInfoFromCatalog/.test(catalogService)],
  [
    "RunningHub node consumes backend catalog items",
    /rhWorkflowPresetId/.test(node) &&
      /fetchRunningHubCatalog/.test(node) &&
      /后台条目/.test(node) &&
      /runTargetId=/.test(node),
  ],
  [
    "RunningHub node fails fast on mixed app/workflow preset state",
    /selectedWorkflowPreset\?\.kind === 'app'[\s\S]*selectedWorkflowPreset\.workflowId/.test(node) &&
      /当前 RunningHub 条目是 AI 应用，但仍残留 workflowId，请先在后台重新保存该条目/.test(node),
  ],
  [
    "RunningHub node resolves workflowId only for normalized workflow presets",
    /const resolvedTargetType: 'app' \| 'workflow' = selectedWorkflowPreset\?\.kind === 'app' \? 'app' : 'workflow';/.test(node) &&
      /const resolvedWorkflowId = resolvedTargetType === 'workflow'/.test(node),
  ],
  [
    "RunningHub node can auto-hydrate remote parameter fields",
    /handleFetchInfo/.test(node) &&
      /autoHydratedCatalogRef/.test(node) &&
      /presetFieldCount/.test(node),
  ],
  [
    "RunningHub admin blocks enabling empty-shell entries",
    /assertRunningHubEntryCanBeEnabled/.test(api) &&
      /缺少输入槽定义，不能启用/.test(api) &&
      /validFieldCount/.test(adminEditor) &&
      /待补输入槽，启用后节点不会展开参数区/.test(adminWorkspace),
  ],
  [
    "RunningHub node warns when selected preset still has no resolved fields",
    /selectedPresetHasNoResolvedFields/.test(node) &&
      /没有可用的输入槽定义/.test(node),
  ],
  [
    "RunningHub catalog preserves parameterSchema for non-binding schema drafts",
    /parameterSchema\?: string;/.test(sharedRunninghub) &&
      /parameterSchema: typeof row\.parameterSchema === "string"/.test(catalogService),
  ],
  [
    "RunningHub catalog preserves outputSchema for node runtime adaptation",
    /outputSchema\?: Array<\{/.test(sharedRunninghub) &&
      /outputSchema: Array\.isArray\(row\.outputSchema\)/.test(catalogService),
  ],
  [
    "RunningHub catalog runtime keeps kind-owned IDs normalized",
    /const kind = row\.kind === "app" \? "app" : "workflow";/.test(catalogService) &&
      /appId: kind === "app"/.test(catalogService) &&
      /workflowId: kind === "workflow"/.test(catalogService) &&
      /runTargetId: runTargetId/.test(catalogService),
  ],
  [
    "RunningHub catalog app info uses kind-specific targets",
    /webappId: item\.kind === "app"/.test(catalogService) &&
      /workflowId: item\.kind === "workflow"/.test(catalogService),
  ],
  [
    "RunningHub node schema prefers backend outputSchema over workflowJson guessing",
    /item\.outputSchema/.test(catalogService) &&
      /outputSchema/.test(sharedRunninghub) &&
      /inferOutputs\(item\)/.test(node) === false &&
      /item\.outputSchema/.test(nodeSchema),
  ],
  [
    "RunningHub admin can scaffold input-slot drafts from parameterSchema",
    /buildFieldsFromParameterSchema/.test(adminEditor) &&
      /从 Schema 生成输入槽草稿/.test(adminEditor) &&
      /仍需补齐 nodeId/.test(adminEditor),
  ],
  [
    "RunningHub admin can sync real remote input slots from run target",
    /fetchRemoteAppInfo/.test(adminApiClient) &&
      /\/api\/proxy\/runninghub\/app-info\?webappId=/.test(adminApiClient) &&
      /buildFieldsFromRemoteNodeInfoList/.test(adminEditor) &&
      /从运行目标同步输入槽/.test(adminEditor),
  ],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
