import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";

const [policyRoutes, apiClient, adminMain] = await Promise.all([
  readFile(new URL("../apps/api/src/group-permission-policy-routes.ts", import.meta.url), "utf8"),
  readFile(new URL("../apps/admin/src/admin-api-client.ts", import.meta.url), "utf8"),
  readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8"),
]);

assert.match(policyRoutes, /policyForUser\(/, "permission UI must display the runtime-effective policy for missing group records");
assert.match(apiClient, /isAuthRequiredError/, "admin API client must classify AUTH_REQUIRED responses");
assert.match(adminMain, /setCurrentUser\(null\)/, "admin shell must clear stale user state after session loss");
assert.match(adminMain, /isAuthRequiredError\(/, "admin shell must react to AUTH_REQUIRED instead of retaining the dashboard");

console.log(JSON.stringify({ ok: true }, null, 2));
