import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const workerPath = join(root, "apps", "worker", "src", "worker.ts");
const outputMaterialsPath = join(root, "apps", "worker", "src", "output-materials.ts");
const taskStorePath = join(root, "apps", "worker", "src", "worker-task-store.ts");
const workerSource = readFileSync(workerPath, "utf8");
const outputMaterialsSource = readFileSync(outputMaterialsPath, "utf8");
const taskStoreSource = readFileSync(taskStorePath, "utf8");

assert.match(workerSource, /if \(task\.capability === "audio"\) return executeAudioTask\(task\)/);
assert.match(workerSource, /async function executeAudioTask/);
assert.match(workerSource, /createOpenAiAudioChatPayload/);
assert.match(workerSource, /extractAudioProviderResult/);
assert.match(workerSource, /if \(task\.capability === "chat"\) return executeChatTask\(task(?:, signal)?\)/);
assert.match(workerSource, /TASK_QUEUE_CAPABILITIES/);
assert.match(workerSource, /TASK_QUEUE_CAPABILITIES\.includes\(task\.capability as TaskQueueCapability\)/);
assert.match(workerSource, /if \(task\.capability === "image"\) return executeImageTask\(task\)/);
assert.match(workerSource, /if \(task\.capability === "video"\) return executeVideoTask\(task\)/);
assert.match(workerSource, /slotIndex/);
assert.match(workerSource, /buildTaskQueueRuntimeDescriptors/);
assert.match(workerSource, /const backgroundLoops = \[/);
assert.match(workerSource, /staleRunningTaskMs > 0 && staleTaskReaperIntervalMs > 0 \? \[runStaleTaskReaperLoop\(\)\] : \[\]/);
assert.match(workerSource, /Promise\.allSettled\(\[\.\.\.workerLoops, \.\.\.backgroundLoops\]\)/);
assert.match(workerSource, /readTaskQueueSettings/);
assert.match(workerSource, /touchTaskRuntime,\s*\n\s*touchQueuedTaskRuntime,/);
assert.match(taskStoreSource, /async function touchTaskRuntime/);
assert.match(workerSource, /heartbeatAt/);
assert.match(workerSource, /async function runStaleTaskReaperLoop/);
assert.match(workerSource, /worker_stalled_or_upstream_timeout/);

assert.match(outputMaterialsSource, /const audioUrls = readStringList\(result\.audioUrls\)/);
assert.match(outputMaterialsSource, /materializedAudioUrls/);
assert.match(outputMaterialsSource, /async function materializeAudioOutput/);

console.log(JSON.stringify({ ok: true }, null, 2));
