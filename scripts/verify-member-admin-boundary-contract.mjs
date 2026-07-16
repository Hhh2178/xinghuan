import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routes = await readFile(new URL("../apps/api/src/shared-resource-routes.ts", import.meta.url), "utf8");
const actions = await readFile(new URL("../apps/api/src/permissions/permission-subject-actions.ts", import.meta.url), "utf8");

for (const marker of [
  'url.pathname === "/api/shared-resources/categories"',
  'url.pathname === "/api/shared-resources/items/add"',
  'url.pathname === "/api/shared-resources/workflows/add"',
  "const sharedResourceItemMatch",
]) {
  assert.ok(routes.includes(marker), `missing shared resource management route: ${marker}`);
}
assert.match(routes, /shared-resources\/items\/add[\s\S]{0,260}requireAdmin\(currentUser\)/);
assert.match(routes, /shared-resources\/workflows\/add[\s\S]{0,320}requireAdmin\(currentUser\)/);
assert.match(routes, /const sharedResourceItemMatch[\s\S]{0,220}requireAdmin\(currentUser\)/);
assert.doesNotMatch(actions, /return \[[^\]]*"manage"/);
console.log("PASS member/admin public resource boundary contract");
