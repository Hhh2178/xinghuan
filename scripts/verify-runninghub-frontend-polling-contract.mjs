import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const runningHubNode = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const rhToolsNode = await readFile(new URL("../apps/web/src/components/nodes/RHToolsNode.tsx", import.meta.url), "utf8");

for (const [label, source] of [
  ["RunningHubNode", runningHubNode],
  ["RHToolsNode", rhToolsNode],
]) {
  assert.doesNotMatch(source, /轮询超时/, `${label} should not hard-fail locally with polling timeout copy`);
  assert.doesNotMatch(source, /let elapsed = 0;/, `${label} should no longer track a local polling timeout counter`);
  assert.doesNotMatch(source, /const MAX = 480;/, `${label} should no longer use a fixed local polling timeout ceiling`);
  assert.match(source, /rhQueueHint:\s*r\.queueHint \|\| \(r\.status === 'QUEUED' \? '任务队列排队中' : '任务已提交，正在生成'\)/, `${label} should keep reflecting upstream queue or running state`);
}

console.log("PASS runninghub frontend polling contract");
