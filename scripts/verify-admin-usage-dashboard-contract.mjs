import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const checks = [];

function check(name, pass) {
  checks.push({ name, pass: Boolean(pass) });
}

const readonlyPanelsPath = "apps/admin/src/admin-readonly-panels.tsx";
const usageDashboardPath = "apps/admin/src/admin-usage-dashboard.tsx";
const adminTypesPath = "apps/admin/src/admin-types.ts";
const adminApiClientPath = "apps/admin/src/admin-api-client.ts";
const mainPath = "apps/admin/src/main.tsx";
const serverPath = "apps/api/src/server.ts";
const adminAuditRoutesPath = "apps/api/src/admin-audit-routes.ts";

const readonlyPanelsSource = existsSync(join(root, readonlyPanelsPath)) ? read(readonlyPanelsPath) : "";
const usageDashboardSource = existsSync(join(root, usageDashboardPath)) ? read(usageDashboardPath) : "";
const adminTypesSource = read(adminTypesPath);
const adminApiClientSource = read(adminApiClientPath);
const mainSource = read(mainPath);
const serverSource = read(serverPath);
const adminAuditRoutesSource = existsSync(join(root, adminAuditRoutesPath)) ? read(adminAuditRoutesPath) : "";

check("usage dashboard module exists", existsSync(join(root, usageDashboardPath)));
check("readonly panels import usage dashboard", readonlyPanelsSource.includes('from "./admin-usage-dashboard"'));
check("audit panel accepts usageSummary prop", /AuditPanel\s*\(\{\s*auditLogs,\s*usageSummary\s*\}/.test(readonlyPanelsSource));
check("audit panel renders usage dashboard above audit table", readonlyPanelsSource.includes("<AdminUsageDashboard usageSummary={usageSummary} />"));
check("admin types expose AdminUsageSummary", adminTypesSource.includes("export interface AdminUsageSummary"));
check("admin types expose UsageModelRow", adminTypesSource.includes("export interface UsageModelRow"));
check("admin types expose UsageRunningHubEntryRow", adminTypesSource.includes("export interface UsageRunningHubEntryRow"));
check("admin api client exposes usage summary fetch", adminApiClientSource.includes("/api/admin/audit/usage-summary"));
check("main loads usage summary", mainSource.includes("api<AdminUsageSummary>(\"/api/admin/audit/usage-summary\")"));
check("main passes usage summary into audit panel", mainSource.includes("<AuditPanel auditLogs={auditLogs} usageSummary={usageSummary} />"));
check(
  "server exposes usage summary endpoint",
  adminAuditRoutesSource.includes('url.pathname === "/api/admin/audit/usage-summary"')
  && serverSource.includes("createAdminAuditRouteHandler")
  && serverSource.includes("handleAdminAuditRoutes"),
);
check("server records RH catalog snapshot fields", serverSource.includes("rhCatalogId") && serverSource.includes("rhCatalogTitle") && serverSource.includes("rhCatalogKind"));
check("server records task-backed LLM analytics row", serverSource.includes("扩展对话任务") || serverSource.includes("taskCapability: \"chat\""));
check("usage dashboard renders KPI strip", usageDashboardSource.includes("usage-kpi-grid"));
check("usage dashboard renders model matrix", usageDashboardSource.includes("模型矩阵"));
check("usage dashboard renders RH entry matrix", usageDashboardSource.includes("RH 条目矩阵"));

const failed = checks.filter((item) => !item.pass);

if (failed.length > 0) {
  console.error("Admin usage dashboard contract verification failed:");
  for (const item of failed) {
    console.error(`- ${item.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((item) => item.name) }, null, 2));
