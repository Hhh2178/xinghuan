import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const deferredRequeue = await readFile(new URL("../apps/worker/src/worker-deferred-requeue.ts", import.meta.url), "utf8");
const adminEditor = await readFile(new URL("../apps/admin/src/admin-runninghub-item-editor.tsx", import.meta.url), "utf8");
const runninghubNode = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const runninghubNodeHelpers = await readFile(
  new URL("../apps/web/src/components/nodes/runninghubNodeHelpers.ts", import.meta.url),
  "utf8",
);
const rhToolsNode = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");
const rhToolsNodeHelpers = await readFile(
  new URL("../apps/web/src/components/nodes/rhToolsNodeHelpers.ts", import.meta.url),
  "utf8",
);
const apiCatalog = await readFile(new URL("../apps/api/src/runninghub-catalog.ts", import.meta.url), "utf8");
const adminTypes = await readFile(new URL("../apps/admin/src/admin-types.ts", import.meta.url), "utf8");
const sharedRunninghub = await readFile(new URL("../packages/shared/src/runninghub.ts", import.meta.url), "utf8");

assert.match(worker, /async function executeTask\(task: TaskRow(?:, signal\?: AbortSignal)?\): Promise<Record<string, unknown>> \{[\s\S]*const protocol = normalizeProtocol\(task\.providerProtocol\);[\s\S]*if \(protocol === "runninghub" && runningHubExecutionMode\(task\) !== "standard_model"\) return executeRunningHubTask\(task\);[\s\S]*if \(task\.capability === "image"\) return executeImageTask\(task\);/);
assert.match(worker, /async function executeImageTask\(task: TaskRow\): Promise<Record<string, unknown>> \{[\s\S]*if \(protocol === "runninghub"\) \{[\s\S]*runningHubExecutionMode\(task\) === "standard_model"[\s\S]*executeRunningHubStandardTask\(task, "image"\)[\s\S]*executeRunningHubTask\(task\);/);
assert.match(worker, /async function executeVideoTask\(task: TaskRow\): Promise<Record<string, unknown>> \{[\s\S]*if \(protocol === "runninghub"\) \{[\s\S]*runningHubExecutionMode\(task\) === "standard_model"[\s\S]*executeRunningHubStandardTask\(task, "video"\)[\s\S]*executeRunningHubTask\(task\);/);
assert.match(worker, /createWorkerDeferredRequeue\(\{/);
assert.match(worker, /workerDeferredRequeue\.requeueDeferredTaskAfterRelease\(/);
assert.match(deferredRequeue, /function capabilityToQueueCapability\(capability: string\): TaskQueueCapability \| null \{[\s\S]*if \(capability === "chat"\) return "video";/);
assert.match(deferredRequeue, /taskQueueNameForCapability\(options\.queueName, queueCapability\)/);

assert.match(adminTypes, /displayLabel\?: string;/);
assert.match(sharedRunninghub, /displayLabel\?: string;/);
assert.match(apiCatalog, /displayLabel: safeText\(row\.displayLabel \|\| row\.title,/);

assert.match(adminEditor, /<span>标注\/显示名<\/span>/);
assert.match(adminEditor, /字段类型预设/);
assert.match(adminEditor, /输出类型预设 \/ 允许自定义覆盖/);
assert.match(adminEditor, /结果路径预设 \/ 允许自定义覆盖/);
assert.match(adminEditor, /允许自定义覆盖/);

assert.doesNotMatch(runninghubNode, /输出映射 ·/);
assert.doesNotMatch(runninghubNode, /来自 requestExample\.nodeInfoList 的/);
assert.match(
  runninghubNode,
  /import\s*\{[\s\S]*?fieldDisplayLabel,[\s\S]*?\}\s*from\s*['"]\.\/runninghubNodeHelpers['"]/,
);
assert.match(runninghubNodeHelpers, /function fieldDisplayLabel\(it: any\)/);
assert.match(runninghubNodeHelpers, /displayLabel\s*\|\|\s*it\??\.label\s*\|\|\s*it\??\.fieldName/);

assert.doesNotMatch(rhToolsNode, /来自 requestExample\.nodeInfoList 的/);
assert.match(
  rhToolsNode,
  /import\s*\{[\s\S]*?extractRhToolsDefaultValue,[\s\S]*?inferRhToolsValueType,[\s\S]*?\}\s*from\s*['"]\.\/rhToolsNodeHelpers['"]/,
);
assert.match(rhToolsNodeHelpers, /export function rhToolsFieldDisplayLabel\(it: any\)/);
assert.match(rhToolsNodeHelpers, /displayLabel\s*\|\|\s*it\??\.label\s*\|\|\s*it\??\.fieldName/);

console.log("PASS runninghub worker and label contract");
