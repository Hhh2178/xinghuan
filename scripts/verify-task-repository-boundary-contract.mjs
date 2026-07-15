import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/admin-task-list-routes.ts", import.meta.url), "utf8");
const repository = await readFile(new URL("../apps/api/src/task-repository.ts", import.meta.url), "utf8");

const listPage = repository.match(/async function readTaskListPage\([\s\S]*?\n {2}async function readTaskRecord/)?.[0] || "";
const readTaskRecord = repository.match(/async function readTaskRecord\([\s\S]*?\n {2}async function writeTaskRecord/)?.[0] || "";

assert.match(server, /createTaskRepository\(/, "server.ts should instantiate task repository");
assert.match(server, /readTaskListPage:\s*taskRepository\.readTaskListPage/, "admin task routes should receive repository task list reader");
assert.match(server, /async function appendTaskLog\([\s\S]*?taskRepository\.appendTaskLog/, "appendTaskLog should delegate to task repository");
assert.match(server, /async function readTaskRecord\([\s\S]*?taskRepository\.readTaskRecord/, "readTaskRecord should delegate to task repository");
assert.match(server, /async function insertTaskRecord\([\s\S]*?taskRepository\.insertTaskRecord/, "insertTaskRecord should delegate to task repository");
assert.match(server, /async function writeTaskRecord\([\s\S]*?taskRepository\.writeTaskRecord/, "writeTaskRecord should delegate to task repository");

assert.match(routes, /readTaskListPage\?:/, "admin task list route should accept focused task list reader");
assert.match(routes, /readTaskListPage\s*\?\s*await readTaskListPage\(query\)/, "admin task list GET should prefer repository reader");

assert.doesNotMatch(listPage, /t\.payload\s*,|t\.result\s*,|t\.logs\s*,/, "task list page must not select heavy task fields");
assert.match(listPage, /payload->>'taskCapability'/, "task list count/filter may inspect payload capability without returning payload");
assert.match(readTaskRecord, /t\.payload/, "task detail may select payload");
assert.match(readTaskRecord, /t\.result/, "task detail may select result");
assert.match(readTaskRecord, /t\.logs/, "task detail may select logs");

console.log("PASS task repository boundary contract");
