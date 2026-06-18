import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile(new URL("../apps/web/src/components/nodes/ImageNode.tsx", import.meta.url), "utf8");

assert.match(source, /taskRuns/, "ImageNode should track per-task runtime state");
assert.match(source, /appendImageGenerationResult/, "ImageNode should append generation results incrementally");
assert.match(source, /outputCount/, "ImageNode task run state should record output count");
assert.match(source, /Promise\.allSettled/, "ImageNode should preserve concurrent multi-task execution");
assert.match(source, /imageUrls:\s*\[\.\.\.aggregatedImageUrls\]/, "ImageNode should persist aggregated images");

console.log("PASS image node multi-task contract present");
