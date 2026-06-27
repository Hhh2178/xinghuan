import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const viewModelPath = join(root, "apps", "admin", "src", "admin-view-model.ts");
const mainPath = join(root, "apps", "admin", "src", "main.tsx");
const stylesPath = join(root, "apps", "admin", "src", "styles.css");

const viewModel = readFileSync(viewModelPath, "utf8");
const main = readFileSync(mainPath, "utf8");
const styles = readFileSync(stylesPath, "utf8");

const requiredWorkspaceIds = [
  "command-center",
  "capability-console",
  "resource-content",
  "governance-center",
  "ops-center",
];

const checks = [
  {
    name: "admin view model exists",
    pass: existsSync(viewModelPath),
  },
  {
    name: "workspace model defines all five domains",
    pass: requiredWorkspaceIds.every((id) => viewModel.includes(`id: "${id}"`)),
  },
  {
    name: "workspace labels use product language",
    pass:
      viewModel.includes('label: "运营总览"') &&
      viewModel.includes('label: "能力配置"') &&
      viewModel.includes('label: "资源与内容"') &&
      viewModel.includes('label: "组织与治理"') &&
      viewModel.includes('label: "系统与发布"'),
  },
  {
    name: "existing tabs remain mapped into workspaces",
    pass:
      viewModel.includes('"overview"') &&
      viewModel.includes('"providers"') &&
      viewModel.includes('"runninghub-workspace"') &&
      viewModel.includes('"public-resources"') &&
      viewModel.includes('"users"') &&
      viewModel.includes('"tasks"') &&
      viewModel.includes('"system"') &&
      viewModel.includes('"environment-sync"'),
  },
  {
    name: "main renders new shell classes",
    pass:
      main.includes("starlight-shell") &&
      main.includes("starlight-sidebar") &&
      main.includes("starlight-topbar") &&
      main.includes("starlight-domain-nav") &&
      main.includes("starlight-workspace-home"),
  },
  {
    name: "main keeps existing business panels",
    pass:
      main.includes("<Overview") &&
      main.includes("<UsersPanel") &&
      main.includes("<ApiSettingsPanel") &&
      main.includes("<AdminRunningHubWorkspace") &&
      main.includes("<AdminPublicResourcesPanel") &&
      main.includes("<TasksPanel") &&
      main.includes("<AuditPanel") &&
      main.includes("<SystemPanel") &&
      main.includes("<AdminEnvironmentSyncPanel"),
  },
  {
    name: "lazy loading boundary is present",
    pass: main.includes("Suspense") && main.includes("starlight-page-loading"),
  },
  {
    name: "refresh controls are visible in shell",
    pass: main.includes("refreshPolicy") && main.includes("最近刷新"),
  },
  {
    name: "stitch visual tokens are present",
    pass:
      styles.includes("--starlight-bg") &&
      styles.includes("--starlight-cyan") &&
      styles.includes("--starlight-panel") &&
      styles.includes(".starlight-shell") &&
      styles.includes(".starlight-domain-nav"),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Admin Starlight shell contract failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
