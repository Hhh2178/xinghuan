import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const workerPath = join(root, "apps", "worker", "src", "worker.ts");
const source = readFileSync(workerPath, "utf8");

assert.match(source, /function logWorkerEvent\(event: string, payload: Record<string, unknown>\)/);
assert.match(source, /service:\s*"xinghuan-worker"/);
assert.match(source, /event,/);
assert.match(source, /requestId:/);
assert.match(source, /userId:/);
assert.match(source, /workerId,/);
assert.match(source, /logWorkerEvent\("task\.received"/);
assert.match(source, /logWorkerEvent\("task\.claimed"/);
assert.match(source, /logWorkerEvent\("task\.succeeded"/);
assert.match(source, /logWorkerEvent\("task\.failed"/);
assert.match(source, /logWorkerEvent\("task\.reaped"/);

console.log(JSON.stringify({ ok: true }, null, 2));
