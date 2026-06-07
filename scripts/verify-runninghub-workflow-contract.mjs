import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf-8");
const admin = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf-8");
const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf-8");
const catalogService = await readFile(new URL("../apps/web/src/services/runninghubCatalog.ts", import.meta.url), "utf-8");

const checks = [
  ["API exposes runninghub catalog endpoint", /\/api\/runninghub\/catalog/.test(api) && /publicRunningHubCatalog/.test(api)],
  ["API normalizes workflow json and field definitions", /normalizeRunningHubFieldDefinitions/.test(api) && /workflowJson: normalizeOptionalJsonText/.test(api)],
  ["Admin workflow editor persists workflowJson and fields", /RhWorkflowEntryEditor/.test(admin) && /字段映射 JSON/.test(admin) && /工作流 JSON/.test(admin)],
  ["Web has runninghub catalog service", /fetchRunningHubCatalog/.test(catalogService) && /buildRunningHubAppInfoFromCatalog/.test(catalogService)],
  ["RunningHub node consumes workflow presets", /rhWorkflowPresetId/.test(node) && /fetchRunningHubCatalog/.test(node) && /工作流预设/.test(node)],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
