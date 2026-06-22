import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const adminEditor = await readFile(new URL("../apps/admin/src/admin-runninghub-item-editor.tsx", import.meta.url), "utf8");
const runninghubNode = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const rhToolsNode = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");
const apiCatalog = await readFile(new URL("../apps/api/src/runninghub-catalog.ts", import.meta.url), "utf8");
const adminTypes = await readFile(new URL("../apps/admin/src/admin-types.ts", import.meta.url), "utf8");
const sharedRunninghub = await readFile(new URL("../packages/shared/src/runninghub.ts", import.meta.url), "utf8");

assert.match(worker, /async function executeTask\(task: TaskRow\): Promise<Record<string, unknown>> \{[\s\S]*const protocol = normalizeProtocol\(task\.providerProtocol\);[\s\S]*if \(protocol === "runninghub"\) return executeRunningHubTask\(task\);[\s\S]*if \(task\.capability === "image"\) return executeImageTask\(task\);/);
assert.match(worker, /async function requeueDeferredTask\(taskId: string, capability: string\) \{[\s\S]*const queueCapability = capabilityToQueueCapability\(capability\);/);
assert.match(worker, /function capabilityToQueueCapability\(capability: string\): TaskQueueCapability \| null \{[\s\S]*if \(capability === "chat"\) return "video";/);

assert.match(adminTypes, /displayLabel\?: string;/);
assert.match(sharedRunninghub, /displayLabel\?: string;/);
assert.match(apiCatalog, /displayLabel: safeText\(row\.displayLabel \|\| row\.title,/);

assert.match(adminEditor, /<span>标注\/显示名<\/span>/);
assert.match(adminEditor, /字段类型预设/);
assert.match(adminEditor, /输出类型预设 \/ 允许自定义覆盖/);
assert.match(adminEditor, /结果路径预设 \/ 允许自定义覆盖/);
assert.match(adminEditor, /允许自定义覆盖/);

assert.doesNotMatch(runninghubNode, /输出映射 ·/);
assert.match(runninghubNode, /function fieldDisplayLabel\(it: any\)/);
assert.match(runninghubNode, /currentFieldDisplayLabel \|\| it\.fieldName/);

assert.match(rhToolsNode, /function fieldDisplayLabel\(it: any\)/);
assert.match(rhToolsNode, /currentFieldDisplayLabel \|\| it\.fieldName/);

console.log("PASS runninghub worker and label contract");
