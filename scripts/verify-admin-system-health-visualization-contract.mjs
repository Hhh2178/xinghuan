import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dashboardPath = join(root, "apps", "admin", "src", "components", "observability", "AdminSystemHealthDashboard.tsx");
const viewModelPath = join(root, "apps", "admin", "src", "admin-system-health-view-model.ts");
const mainSource = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const healthHookSource = readFileSync(join(root, "apps", "admin", "src", "use-admin-system-health.ts"), "utf8");
const dashboardSource = existsSync(dashboardPath) ? readFileSync(dashboardPath, "utf8") : "";
const viewModelSource = existsSync(viewModelPath) ? readFileSync(viewModelPath, "utf8") : "";

const checks = [
  { name: "health dashboard exists", pass: existsSync(dashboardPath) },
  { name: "health domain view model exists", pass: existsSync(viewModelPath) },
  {
    name: "dashboard exposes five truthful health domains",
    pass: ["api", "database", "redis", "worker", "storage"].every((id) => viewModelSource.includes(`id: "${id}"`)),
  },
  {
    name: "dashboard contains alert topology trend capacity timeline and inspector regions",
    pass: ["AlertRail", "ServiceTopology", "TaskTrendChart", "QueueCapacityChart", "IncidentTimeline", "ObservabilityInspector"]
      .every((name) => dashboardSource.includes(name)),
  },
  {
    name: "task chart keeps failed and cancelled separate",
    pass: dashboardSource.includes('"failed" | "cancelled"') && dashboardSource.includes('points("failed")') && dashboardSource.includes('points("cancelled")'),
  },
  {
    name: "missing provider and storage metrics remain unknown",
    pass: dashboardSource.includes("尚未接入历史探测指标") && viewModelSource.includes('status: "unknown"'),
  },
  {
    name: "range refresh is bounded and stale requests are cancelled",
    pass:
      mainSource.includes("useAdminSystemHealth") &&
      healthHookSource.includes("abortController.current?.abort()") &&
      healthHookSource.includes("document.visibilityState") &&
      healthHookSource.includes("15_000"),
  },
  {
    name: "system requests send explicit range",
    pass: healthHookSource.includes("/api/admin/system?range=${nextRange}"),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Admin system health visualization contract verification failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
