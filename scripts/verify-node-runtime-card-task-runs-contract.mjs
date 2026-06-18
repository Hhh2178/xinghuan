import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile(new URL("../apps/web/src/components/nodes/NodeRuntimeCard.tsx", import.meta.url), "utf8");

assert.match(source, /taskRuns/, "NodeRuntimeCard should read child task runs");
assert.match(source, /summarizeTaskRuns/, "NodeRuntimeCard should summarize child task runs");
assert.match(source, /成功 .*失败/, "NodeRuntimeCard should render compact success\/failure summary");

console.log("PASS runtime card child-task contract present");
