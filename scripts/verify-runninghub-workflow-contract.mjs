import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf-8");
const adminSettings = await readFile(new URL("../apps/admin/src/admin-api-settings-panel.tsx", import.meta.url), "utf-8");
const adminWorkspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf-8");
const adminEditor = await readFile(new URL("../apps/admin/src/admin-runninghub-item-editor.tsx", import.meta.url), "utf-8");
const adminMain = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf-8");
const adminApiClient = await readFile(new URL("../apps/admin/src/admin-api-client.ts", import.meta.url), "utf-8");
const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf-8");
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
  ["Web has runninghub catalog service", /fetchRunningHubCatalog/.test(catalogService) && /buildRunningHubAppInfoFromCatalog/.test(catalogService)],
  [
    "RunningHub node consumes backend catalog items",
    /rhWorkflowPresetId/.test(node) &&
      /fetchRunningHubCatalog/.test(node) &&
      /后台条目/.test(node) &&
      /runTargetId=/.test(node),
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
