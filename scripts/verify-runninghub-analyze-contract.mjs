import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const workspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");

assert.match(workspace, /const \[analyzeRequestExample, setAnalyzeRequestExample\] = useState\(""\);/);
assert.match(workspace, /const \[analyzeResponseExample, setAnalyzeResponseExample\] = useState\(""\);/);
assert.match(workspace, /requestExample: analyzeRequestExample,/);
assert.match(workspace, /responseExample: analyzeResponseExample,/);
assert.match(workspace, /请求示例/);
assert.match(workspace, /响应示例/);

assert.match(server, /function parseRunningHubExampleObject\(/);
assert.match(server, /function parseRunningHubExampleObject[\s\S]*safeLongText\(value,\s*""\s*,\s*16000\)/);
assert.match(server, /function buildRunningHubFieldsFromRequestExample\(/);
assert.match(server, /const requestExampleObject = parseRunningHubExampleObject\(input\.requestExample\);/);
assert.match(server, /const requestExampleFields = buildRunningHubFieldsFromRequestExample\(requestExampleObject\);/);
assert.match(server, /requestExample .*runTargetId .*不一致/);
assert.match(server, /fields: requestExampleFields,/);

assert.doesNotMatch(server, /instanceType:\s*input\.instanceType \|\| "plus"/);
assert.doesNotMatch(worker, /safeText\(task\.payload\.instanceType, "plus"\)/);

console.log("PASS runninghub analyze contract");
