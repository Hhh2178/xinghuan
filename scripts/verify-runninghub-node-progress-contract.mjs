import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const runninghubNode = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const generation = await readFile(new URL("../apps/web/src/services/generation.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

assert.match(server, /task\.status === "running" \? "45%" : task\.status === "queued" \? "5%"/);
assert.match(generation, /queueHint\?: string;/);
assert.match(runninghubNode, /任务队列排队中/);
assert.match(runninghubNode, /45%/);
assert.match(runninghubNode, /5%/);

console.log("PASS runninghub node progress contract");
