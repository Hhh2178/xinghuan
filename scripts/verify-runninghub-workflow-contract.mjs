import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf-8");
const adminSettings = await readFile(new URL("../apps/admin/src/admin-api-settings-panel.tsx", import.meta.url), "utf-8");
const adminWorkspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf-8");
const adminEditor = await readFile(new URL("../apps/admin/src/admin-runninghub-item-editor.tsx", import.meta.url), "utf-8");
const adminMain = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf-8");
const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf-8");
const catalogService = await readFile(new URL("../apps/web/src/services/runninghubCatalog.ts", import.meta.url), "utf-8");

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
      /Task 3/.test(adminEditor),
  ],
  [
    "Admin hands selected provider context into RunningHub workspace",
    /onOpenRunningHubWorkspace/.test(adminSettings) &&
      /setRunningHubWorkspaceProviderId/.test(adminMain) &&
      /selectedProviderId/.test(adminWorkspace),
  ],
  ["Web has runninghub catalog service", /fetchRunningHubCatalog/.test(catalogService) && /buildRunningHubAppInfoFromCatalog/.test(catalogService)],
  ["RunningHub node consumes workflow presets", /rhWorkflowPresetId/.test(node) && /fetchRunningHubCatalog/.test(node) && /工作流预设/.test(node)],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
