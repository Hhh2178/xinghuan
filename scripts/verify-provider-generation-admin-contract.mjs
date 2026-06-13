import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const modelEditorSource = readFileSync(join(root, "apps", "admin", "src", "admin-model-editor.tsx"), "utf8");
const adminTypesSource = readFileSync(join(root, "apps", "admin", "src", "admin-types.ts"), "utf8");
const apiSettingsSource = readFileSync(join(root, "apps", "admin", "src", "admin-api-settings-panel.tsx"), "utf8");
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");
const readonlyPanelsSource = readFileSync(join(root, "apps", "admin", "src", "admin-readonly-panels.tsx"), "utf8");

assert.match(adminTypesSource, /executionMode\?: ProviderGenerationExecutionMode;/);
assert.match(adminTypesSource, /taskQueueSettings:/);
assert.match(modelEditorSource, /EXECUTION_MODE_OPTIONS/);
assert.match(modelEditorSource, /worker_queue/);
assert.match(modelEditorSource, /async_poll_then_final_lookup/);
assert.match(apiSettingsSource, /assistantResult\.executionMode/);
assert.match(serverSource, /executionMode\?: ProviderGenerationExecutionMode;/);
assert.match(serverSource, /advancedConfig\.executionMode = executionMode/);
assert.match(serverSource, /\/api\/admin\/system/);
assert.match(serverSource, /request\.method === "PATCH"/);
assert.match(serverSource, /taskQueueSettings/);
assert.match(readonlyPanelsSource, /任务并发设置/);
assert.match(readonlyPanelsSource, /按类别并发/);

console.log(JSON.stringify({ ok: true }, null, 2));
