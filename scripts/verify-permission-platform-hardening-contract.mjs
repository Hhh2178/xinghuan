import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  runtime,
  readiness,
  reconciliation,
  repository,
  routes,
  server,
  externalProxy,
  providerTaskService,
  adminPanel,
  adminUsers,
  webApp,
  grayVerify,
  environmentExample,
  packageJson,
  memberCatalogVerify,
] = await Promise.all([
  read("apps/api/src/permissions/permission-runtime.ts"),
  read("apps/api/src/permissions/permission-readiness.ts"),
  read("apps/api/src/permissions/permission-reconciliation.ts"),
  read("apps/api/src/permissions/permission-repository.ts"),
  read("apps/api/src/permissions/permission-routes.ts"),
  read("apps/api/src/server.ts"),
  read("apps/api/src/external-proxy.ts"),
  read("apps/api/src/provider-generation-task-service.ts"),
  read("apps/admin/src/permission-platform/panel.tsx"),
  read("apps/admin/src/admin-users-panel.tsx"),
  read("apps/web/src/App.tsx"),
  read("scripts/release/verify-gray-runtime.mjs"),
  read("config/canvas-next.env.example"),
  read("package.json"),
  read("scripts/verify-permission-member-catalog.mjs"),
]);

const checks = [
  ["runtime defines legacy shadow enforced", /"legacy"[\s\S]*"shadow"[\s\S]*"enforced"/.test(runtime)],
  ["shadow keeps legacy authoritative", /authority:\s*"legacy"[\s\S]*unified/.test(runtime)],
  ["readiness rejects zero published subjects", readiness.includes("NO_PUBLISHED_SUBJECTS")],
  ["readiness requires subject action coverage", readiness.includes("MISSING_SUBJECT_ACTION_COVERAGE")],
  ["reconciliation preserves legacy identifiers", reconciliation.includes("legacySubjectIdentifiers")],
  ["subject updates use atomic revision guards", /where xh_permission_subjects\.revision = excluded\.revision - 1[\s\S]*metadata is not distinct from excluded\.metadata[\s\S]*returning subject_key/.test(repository)],
  ["rule updates and deletes use atomic revision guards", /where xh_permission_rules\.revision = excluded\.revision - 1[\s\S]*returning id/.test(repository) && /delete from xh_permission_rules where id = \$1 and revision = \$2 returning id/.test(repository)],
  ["repository revision races map to HTTP 409", routes.includes("writeWithRevisionConflict") && routes.includes("new deps.HttpError(409, conflictCode)")],
  ["enforced startup has readiness gate", server.includes("PERMISSION_RUNTIME_NOT_READY")],
  ["subject reconciliation is single-flight", server.includes("permissionSubjectReconciliation") && server.includes("permissionSubjectReconciliation === current") && server.indexOf("let permissionSubjectReconciliation") < server.indexOf("void startApiServer()")],
  ["model catalog uses permission runtime", /publicModelCatalog[\s\S]*permissionRuntime\.decide/.test(server)],
  ["RH catalog uses permission runtime", /filterRunningHubItems[\s\S]*permissionRuntime\.decide/.test(server)],
  ["sync proxy authorizes model execution", externalProxy.includes("authorizeModelExecution")],
  ["queued task service authorizes model execution", providerTaskService.includes("authorizeModelExecution")],
  ["admin uses unified lazy panel", adminUsers.includes("lazy(() =>") && adminUsers.includes("PermissionPlatformPanel")],
  ["admin panel supports account principal", adminPanel.includes('setPrincipalType("user")')],
  ["web loads effective node permissions", webApp.includes("getEffectivePermissions")],
  ["gray verify supports permission readiness", grayVerify.includes("expected-permission-ready")],
  ["gray environment defaults to shadow", environmentExample.includes("XINGHUAN_PERMISSION_MODE=shadow")],
  ["package exposes reconciliation command", packageJson.includes('"permissions:reconcile"')],
  ["package exposes readiness command", packageJson.includes('"permissions:verify"')],
  ["gray acceptance verifies both account override directions", memberCatalogVerify.includes("denyOverAllow") && memberCatalogVerify.includes("allowOverDeny")],
  ["gray acceptance cleanup carries rule revision", memberCatalogVerify.includes("revision: rule.revision")],
];

for (const [name, passed] of checks) assert.equal(passed, true, name);
console.log(JSON.stringify({ ok: true, checks: checks.map(([name]) => name) }, null, 2));

async function read(pathname) {
  return readFile(new URL(`../${pathname}`, import.meta.url), "utf8");
}
