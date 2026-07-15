import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const adminTypes = await readFile(new URL("../apps/admin/src/admin-types.ts", import.meta.url), "utf8");
const workspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../apps/admin/src/styles.css", import.meta.url), "utf8");

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
assert.match(workspace, /Provider 级共享 Key 池/, "workspace should describe the Key pool as Provider-owned configuration");
assert.match(workspace, /当前 Provider：\{resolvedProviderLabel\}/, "Key pool summary should identify its current Provider");

const keyPoolIndex = workspace.indexOf('className="api-card admin-runninghub-key-pool-panel"');
const filtersIndex = workspace.indexOf('className="admin-runninghub-workspace__sticky-shell"');
const layoutIndex = workspace.indexOf('className="admin-runninghub-workspace__layout"');
assert.ok(keyPoolIndex >= 0, "workspace should render the RH Key pool panel");
assert.ok(keyPoolIndex < filtersIndex, "Provider Key pool should appear before catalog filters");
assert.ok(keyPoolIndex < layoutIndex, "Provider Key pool should appear before the item rail/editor layout");
assert.doesNotMatch(
  workspace,
  /admin-runninghub-workspace__editor-stack[\s\S]*?admin-runninghub-key-pool-panel[\s\S]*?admin-runninghub-analyze-panel/,
  "Provider Key pool must not be nested inside the selected item editor stack",
);
assert.match(workspace, /admin-runninghub-key-pool-panel__body/, "expanded Key pool controls should have an explicit body");
assert.match(workspace, /admin-runninghub-key-pool-row/, "Key entries should use bounded rows instead of nested cards");
assert.match(styles, /\.admin-runninghub-key-pool-row\s*\{[\s\S]{0,320}min-width:\s*0;/, "Key rows should be shrink-safe");

console.log("PASS runninghub key pool contract");
