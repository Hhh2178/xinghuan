import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile(new URL("../apps/web/src/components/nodes/NodeRuntimeCard.tsx", import.meta.url), "utf8");

assert.match(source, /taskRuns/, "NodeRuntimeCard should read child task runs");
assert.match(source, /outputCount/, "NodeRuntimeCard should render output count");
assert.match(source, /batchIndex/, "NodeRuntimeCard should identify each child task");

console.log("PASS runtime card child-task contract present");
