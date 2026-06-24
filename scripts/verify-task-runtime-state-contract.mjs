import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const shared = read("packages/shared/src/provider-generation-task.ts");
const sharedIndex = read("packages/shared/src/index.ts");
const projection = read("apps/api/src/task-runtime-projection.ts");
const service = read("apps/api/src/provider-generation-task-service.ts");
const server = read("apps/api/src/server.ts");
const adminTypes = read("apps/admin/src/admin-types.ts");
const adminViewModel = read("apps/admin/src/admin-view-model.ts");
const adminPanel = read("apps/admin/src/admin-task-panel.tsx");
const adminMain = read("apps/admin/src/main.tsx");
const webGeneration = read("apps/web/src/services/generation.ts");

assert.match(shared, /export const TASK_DISPLAY_TONES = \[/);
assert.match(shared, /export type TaskDisplayTone =/);
assert.match(shared, /export const TASK_RUNTIME_STAGES = \[/);
assert.match(shared, /export type TaskRuntimeStage =/);
assert.match(shared, /displayStatus\?: string;/);
assert.match(shared, /displayMessage\?: string;/);
assert.match(shared, /displayTone\?: TaskDisplayTone;/);
assert.match(shared, /runtimeStage\?: TaskRuntimeStage;/);
assert.match(shared, /providerState\?: string;/);

assert.match(sharedIndex, /TaskDisplayTone/);
assert.match(sharedIndex, /TaskRuntimeStage/);

assert.match(projection, /export function projectTaskRuntimeDisplayState\(/);
assert.match(projection, /displayStatus/);
assert.match(projection, /displayMessage/);
assert.match(projection, /displayTone/);

assert.match(service, /projectTaskRuntimeDisplayState/);
assert.match(service, /displayStatus:/);
assert.match(service, /displayMessage:/);
assert.match(service, /displayTone:/);
assert.match(service, /runtimeStage:/);
assert.match(service, /providerState:/);

assert.match(server, /task-runtime-projection\.js/);
assert.match(server, /projectTaskRuntimeDisplayState/);
assert.match(server, /displayStatus:/);
assert.match(server, /displayMessage:/);
assert.match(server, /displayTone:/);

assert.match(adminTypes, /displayStatus\?: string;/);
assert.match(adminTypes, /displayMessage\?: string;/);
assert.match(adminTypes, /displayTone\?:/);
assert.match(adminTypes, /runtimeStage\?: string;/);
assert.match(adminTypes, /providerState\?: string;/);

assert.match(adminViewModel, /taskStatusText\(/);
assert.match(adminViewModel, /taskDisplayTone\(/);

assert.match(adminPanel, /taskDisplayTone\(task\)/);
assert.match(adminPanel, /taskStatusText\(task\)/);
assert.match(adminPanel, /task\.displayMessage/);

assert.match(adminMain, /setInterval\(/);
assert.match(adminMain, /activeTab === "tasks"/);
assert.match(adminMain, /taskPage\.items\.some\(\(task\) => task\.status === "queued" \|\| task\.status === "running"\)/);

assert.match(webGeneration, /displayStatus\?: string;/);
assert.match(webGeneration, /displayMessage\?: string;/);
assert.match(webGeneration, /displayTone\?: string;/);
assert.match(webGeneration, /runtimeStage\?: string;/);
assert.match(webGeneration, /providerState\?: string;/);

console.log(JSON.stringify({ ok: true }, null, 2));
