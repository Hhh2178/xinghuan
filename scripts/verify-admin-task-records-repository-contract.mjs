import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repository = await readFile(new URL("../apps/api/src/task-repository.ts", import.meta.url), "utf8");

assert.match(repository, /insert into xh_tasks/, "task repository should insert task records");
assert.match(repository, /update xh_tasks/, "task repository should update task records and append logs");
assert.match(repository, /where id = \$1/, "task writes should target one task id");
assert.doesNotMatch(repository, /delete from xh_tasks/i, "task repository must not full-replace task table for point writes");
assert.doesNotMatch(repository, /delete from xh_providers|delete from xh_models|delete from xh_audit_logs/i, "task repository must not replace unrelated admin tables");

console.log("PASS admin task records repository contract");
