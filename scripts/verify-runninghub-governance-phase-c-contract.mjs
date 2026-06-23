import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const shared = await readFile(new URL("../packages/shared/src/provider-generation-task.ts", import.meta.url), "utf8");

assert.match(server, /failureCategory/);
assert.match(server, /cancelState/);
assert.match(shared, /UnifiedFailureCategory/);
assert.match(shared, /UnifiedCancelState/);

console.log("PASS runninghub governance phase-c contract");
