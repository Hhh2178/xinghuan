import { readFile } from "node:fs/promises";

const files = {
  api: await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8"),
  route: await readFile(new URL("../apps/api/src/admin-runninghub-routes.ts", import.meta.url), "utf8"),
  gate: await readFile(new URL("../apps/api/src/runninghub-permission-gate.ts", import.meta.url), "utf8"),
  registrar: await readFile(new URL("../apps/api/src/permissions/permission-subject-registrars.ts", import.meta.url), "utf8"),
  admin: await readFile(new URL("../apps/admin/src/admin-runninghub-group-manager.tsx", import.meta.url), "utf8"),
  canvas: await readFile(new URL("../apps/web/src/services/runninghubCatalog.ts", import.meta.url), "utf8"),
};
const checks = [
  ["Provider groups persist", /rh_groups/.test(files.api)],
  ["Admin group CRUD routes exist", /runninghub\/groups/.test(files.route)],
  ["Group gate requires both decisions", /groupDecision.*itemDecision|groupDecision && itemDecision/.test(files.gate)],
  ["Group permission subjects reconcile", /runningHubGroupSubjectKey/.test(files.registrar)],
  ["Admin grouped manager exists", /分组/.test(files.admin) && /onDelete/.test(files.admin)],
  ["Canvas grouped selector exists", /groupRunningHubCatalogItems/.test(files.canvas) && /optgroup/.test(await readFile(new URL("../apps/web/src/components/nodes/RunningHubNodeConfigSection.tsx", import.meta.url), "utf8"))],
];
let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
