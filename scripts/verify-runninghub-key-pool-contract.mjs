import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const adminTypes = await readFile(new URL("../apps/admin/src/admin-types.ts", import.meta.url), "utf8");
const workspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf8");

assert.match(adminTypes, /export interface RunningHubKeyPoolItem \{/);
assert.match(adminTypes, /isDefault:\s*boolean;/);
assert.match(adminTypes, /rhKeyPool\?: RunningHubKeyPoolItem\[\];/);
assert.match(server, /function normalizeRunningHubKeyPool\(/);
assert.match(server, /function summarizeRunningHubKeyPool\(/);
assert.match(server, /selectedDefault/);
assert.match(server, /isDefault === true/);
assert.match(server, /selected = selectedDefault \|\| selectedFallback \|\| null/);
assert.match(workspace, /RH Key 池管理/);
assert.match(workspace, /新增 Key/);
assert.match(workspace, /默认 Key/);
assert.match(workspace, /设为默认/);

console.log("PASS runninghub key pool contract");
