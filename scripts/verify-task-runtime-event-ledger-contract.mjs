import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const migration = read("apps/api/db/018_task_runtime_events.sql");
const apiEvents = read("apps/api/src/task-runtime-events.ts");
const workerEvents = read("apps/worker/src/worker-runtime-events.ts");
const apiServer = read("apps/api/src/server.ts");
const worker = read("apps/worker/src/worker.ts");
const localAcceptance = read("scripts/verify-local-acceptance-chain.mjs");

assert.match(migration, /create table if not exists xh_task_runtime_events/i);
assert.match(migration, /task_id text not null references xh_tasks\(id\) on delete cascade/i);
assert.match(migration, /event_type text not null/i);
assert.match(migration, /payload jsonb not null default '\{\}'::jsonb/i);

assert.match(apiEvents, /export function createTaskRuntimeEventStore\(/);
assert.match(apiEvents, /appendTaskRuntimeEventBestEffort/);
assert.match(apiEvents, /console\.warn\("task-runtime-event-write-failed"/);

assert.match(workerEvents, /export function createWorkerRuntimeEventWriter\(/);
assert.match(workerEvents, /appendTaskRuntimeEventBestEffort/);
assert.match(workerEvents, /console\.warn\("worker-runtime-event-write-failed"/);

assert.match(apiServer, /task-runtime-events\.js/);
assert.match(apiServer, /appendTaskRuntimeEventBestEffort/);

assert.match(worker, /worker-runtime-events\.js/);
assert.match(worker, /appendTaskRuntimeEventBestEffort/);

assert.match(localAcceptance, /verify:task-runtime-state-contract/);
assert.match(localAcceptance, /verify:task-runtime-event-ledger-contract/);

console.log(JSON.stringify({ ok: true }, null, 2));
