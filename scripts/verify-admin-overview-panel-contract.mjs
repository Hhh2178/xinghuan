import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-overview-panel.tsx");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const panelSource = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : "";

const metricLabels = ["成员", "Provider", "模型", "任务", "审计"];

const checks = [
  {
    name: "admin overview panel module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "main imports overview panel",
    pass: mainSource.includes('from "./admin-overview-panel"') || mainSource.includes('from "./admin-overview-panel.js"'),
  },
  {
    name: "main no longer inlines Overview",
    pass: !/function\s+Overview\s*\(/.test(mainSource),
  },
  {
    name: "main exports overview data types",
    pass:
      /export\s+interface\s+ProviderRecord\s*\{/.test(mainSource) &&
      /export\s+interface\s+ModelRecord\s*\{/.test(mainSource) &&
      /export\s+interface\s+Summary\s*\{/.test(mainSource),
  },
  {
    name: "module exports Overview",
    pass: /export\s+function\s+Overview\s*\(/.test(panelSource),
  },
  {
    name: "overview preserves metric cards",
    pass:
      panelSource.includes('className="metric-grid"') &&
      panelSource.includes('className="metric-card"') &&
      metricLabels.every((label) => panelSource.includes(`label: "${label}"`)) &&
      panelSource.includes("summary?.enabledUsers ?? 0") &&
      panelSource.includes("summary?.enabledProviders ?? 0") &&
      panelSource.includes("summary?.enabledModels ?? 0") &&
      panelSource.includes("summary?.runningTasks ?? 0") &&
      panelSource.includes("summary?.auditLogs ?? 0"),
  },
  {
    name: "overview preserves provider status table",
    pass:
      panelSource.includes('title="Provider 状态"') &&
      panelSource.includes('columns={["名称", "Base URL", "状态", "Key"]}') &&
      panelSource.includes('item.enabled ? "启用" : "停用"') &&
      panelSource.includes('item.hasApiKey ? item.apiKeyPreview : "未配置"'),
  },
  {
    name: "overview preserves recent tasks table",
    pass:
      panelSource.includes('title="最近任务"') &&
      panelSource.includes('columns={["任务", "状态", "模型"]}') &&
      panelSource.includes("tasks.slice(0, 6)") &&
      panelSource.includes("statusText(item.status)") &&
      panelSource.includes('item.modelId || "-"'),
  },
  {
    name: "overview preserves model catalog table",
    pass:
      panelSource.includes('title="模型目录"') &&
      panelSource.includes('columns={["Provider", "模型", "能力", "状态"]}') &&
      panelSource.includes("item.providerId") &&
      panelSource.includes("item.displayName") &&
      panelSource.includes("item.capability") &&
      panelSource.includes('item.enabled ? "启用" : "停用"'),
  },
  {
    name: "overview uses shared DataTable and status helper",
    pass:
      panelSource.includes('from "./admin-common-components"') &&
      panelSource.includes('from "./admin-view-model"') &&
      panelSource.includes("<DataTable"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin overview panel contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
