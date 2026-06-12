import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modelEditorSource = readFileSync(join(root, "apps", "admin", "src", "admin-model-editor.tsx"), "utf8");
const adminTypesSource = readFileSync(join(root, "apps", "admin", "src", "admin-types.ts"), "utf8");
const apiSettingsSource = readFileSync(join(root, "apps", "admin", "src", "admin-api-settings-panel.tsx"), "utf8");
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");

assert.match(adminTypesSource, /executionMode\?: ProviderGenerationExecutionMode;/);
assert.match(modelEditorSource, /EXECUTION_MODE_OPTIONS/);
assert.match(modelEditorSource, /worker_queue/);
assert.match(modelEditorSource, /async_poll_then_final_lookup/);
assert.match(apiSettingsSource, /assistantResult\.executionMode/);
assert.match(serverSource, /executionMode\?: ProviderGenerationExecutionMode;/);
assert.match(serverSource, /advancedConfig\.executionMode = executionMode/);

console.log(JSON.stringify({ ok: true }, null, 2));
