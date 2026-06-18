import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile(new URL("../apps/web/src/components/nodes/VideoNode.tsx", import.meta.url), "utf8");

assert.match(source, /taskRuns/, "VideoNode should track per-task runtime state");
assert.match(source, /outputCount/, "VideoNode task run state should record output count");
assert.match(source, /Promise\.allSettled/, "VideoNode should preserve concurrent multi-task execution");
assert.match(source, /videoUrls:\s*aggregatedVideoUrls/, "VideoNode should persist aggregated videos");

console.log("PASS video node multi-task contract present");
