import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modulePath = join(root, "apps", "admin", "src", "admin-readonly-panels.tsx");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const panelSource = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : "";

const checks = [
  {
    name: "admin readonly panels module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "main imports readonly panels",
    pass: mainSource.includes('from "./admin-readonly-panels"') || mainSource.includes('from "./admin-readonly-panels.js"') || mainSource.includes('import("./admin-readonly-panels")'),
  },
  {
    name: "main no longer inlines readonly panels",
    pass: !/function\s+AuditPanel\s*\(/.test(mainSource) && !/function\s+SystemPanel\s*\(/.test(mainSource),
  },
  {
    name: "module exports AuditPanel and SystemPanel",
    pass: /export\s+function\s+AuditPanel\s*\(/.test(panelSource) && /export\s+function\s+SystemPanel\s*\(/.test(panelSource),
  },
  {
    name: "audit panel preserves title and columns",
    pass:
      panelSource.includes('title="审计日志"') &&
      panelSource.includes('columns={["时间", "操作者", "动作", "对象", "请求", "来源", "说明"]}') &&
      panelSource.includes("`${item.targetType}:${item.targetId}`"),
  },
  {
    name: "audit panel shows request and source context",
    pass:
      panelSource.includes("item.requestId") &&
      panelSource.includes("item.ip") &&
      panelSource.includes("item.userAgent"),
  },
  {
    name: "system panel delegates health visualization without changing runtime settings",
    pass:
      panelSource.includes('from "./components/observability/AdminSystemHealthDashboard"') &&
      panelSource.includes("<AdminSystemHealthDashboard") &&
      panelSource.includes('activeView === "runtime-settings"') &&
      panelSource.includes('title="任务并发设置"'),
  },
  {
    name: "system panel wires health refresh and range callbacks",
    pass:
      panelSource.includes("refreshing={refreshing}") &&
      panelSource.includes("onRangeChange={onHealthRangeChange}") &&
      panelSource.includes("onRefresh={onHealthRefresh}"),
  },
  {
    name: "readonly panels use shared DataTable",
    pass: panelSource.includes('from "./admin-common-components"') && panelSource.includes("<DataTable"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin readonly panels contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
