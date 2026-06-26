import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relPath) {
  return readFileSync(join(root, relPath), "utf8");
}

const migrationPath = join(root, "apps", "api", "db", "019_group_permission_policies.sql");
const policyModulePath = join(root, "apps", "api", "src", "group-permission-policy.ts");
const policyRoutesPath = join(root, "apps", "api", "src", "group-permission-policy-routes.ts");
const usersPanelPath = join(root, "apps", "admin", "src", "admin-users-panel.tsx");
const sharedRoutesPath = join(root, "apps", "api", "src", "shared-resource-routes.ts");
const serverPath = join(root, "apps", "api", "src", "server.ts");
const drawerPath = join(root, "apps", "web", "src", "components", "ResourceLibraryDrawer.tsx");

const usersPanelSource = existsSync(usersPanelPath) ? read("apps/admin/src/admin-users-panel.tsx") : "";
const sharedRoutesSource = existsSync(sharedRoutesPath) ? read("apps/api/src/shared-resource-routes.ts") : "";
const serverSource = existsSync(serverPath) ? read("apps/api/src/server.ts") : "";
const drawerSource = existsSync(drawerPath) ? read("apps/web/src/components/ResourceLibraryDrawer.tsx") : "";

const checks = [
  {
    name: "group permission migration exists",
    pass: existsSync(migrationPath),
  },
  {
    name: "group permission helper module exists",
    pass: existsSync(policyModulePath),
  },
  {
    name: "group permission routes module exists",
    pass: existsSync(policyRoutesPath),
  },
  {
    name: "admin users panel references permission tab",
    pass: usersPanelSource.includes("权限"),
  },
  {
    name: "shared resources route filters member visibility",
    pass:
      sharedRoutesSource.includes("filterSharedResourceItemsForUser") ||
      sharedRoutesSource.includes("canUseSharedResource"),
  },
  {
    name: "runninghub catalog route enforces group policy",
    pass:
      serverSource.includes("/api/runninghub/catalog") &&
      (serverSource.includes("filterRunningHubCatalogForUser") || serverSource.includes("assertCanUseRunningHubCatalogItem")),
  },
  {
    name: "runninghub submit enforces group policy",
    pass:
      serverSource.includes("/api/proxy/runninghub/submit") &&
      serverSource.includes("assertCanUseRunningHubCatalogItem"),
  },
  {
    name: "resource drawer no longer calls copy-to-personal",
    pass:
      !drawerSource.includes("copySharedItemToPersonal") &&
      !drawerSource.includes("另存为我的资源") &&
      !drawerSource.includes("发送到我的资源库"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Group permission governance contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
