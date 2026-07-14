import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const migration = await readFile(new URL("../apps/api/db/020_ungrouped_permission_policy.sql", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/group-permission-policy-routes.ts", import.meta.url), "utf8");
const policy = await readFile(new URL("../apps/api/src/group-permission-policy.ts", import.meta.url), "utf8");

assert.match(migration, /drop constraint if exists xh_group_permission_policies_group_id_fkey/);
assert.match(routes, /id: "ungrouped"/);
assert.match(routes, /groupPolicyMatch/);
assert.match(policy, /const DEFAULT_GROUP_ID = "ungrouped"/);
assert.match(policy, /policies\.find\(\(item\) => item\.groupId === groupId\)/);

console.log(JSON.stringify({ ok: true }, null, 2));
