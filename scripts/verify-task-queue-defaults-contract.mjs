import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const shared = await readFile(new URL("../packages/shared/src/task-queue-settings.ts", import.meta.url), "utf8");
const panel = await readFile(new URL("../apps/admin/src/admin-readonly-panels.tsx", import.meta.url), "utf8");

assert.match(shared, /TASK_QUEUE_DEFAULT_CONCURRENCY = 100;/, "task queue default concurrency should be 100");
assert.match(shared, /TASK_QUEUE_MAX_CONCURRENCY = 999;/, "task queue max concurrency should be 999");
assert.match(shared, /TASK_QUEUE_DEFAULT_USER_CONCURRENCY = 8;/, "task queue default user concurrency should be 8");
assert.match(shared, /TASK_QUEUE_MAX_USER_CONCURRENCY = 999;/, "task queue max user concurrency should be 999");
assert.match(
  shared,
  /image: \{ concurrency: TASK_QUEUE_DEFAULT_CONCURRENCY, userConcurrency: TASK_QUEUE_DEFAULT_USER_CONCURRENCY \}/,
  "image defaults should use 100 total and 8 user concurrency",
);
assert.match(
  shared,
  /audio: \{ concurrency: TASK_QUEUE_DEFAULT_CONCURRENCY, userConcurrency: TASK_QUEUE_DEFAULT_USER_CONCURRENCY \}/,
  "audio defaults should use 100 total and 8 user concurrency",
);
assert.match(
  shared,
  /video: \{ concurrency: TASK_QUEUE_DEFAULT_CONCURRENCY, userConcurrency: TASK_QUEUE_DEFAULT_USER_CONCURRENCY \}/,
  "video defaults should use 100 total and 8 user concurrency",
);
assert.match(panel, /max=\{999\}/, "system panel concurrency inputs should allow up to 999");
assert.match(panel, /TASK_QUEUE_DEFAULTS = \{\s*image: \{ concurrency: 100, userConcurrency: 8 \}/s, "system panel draft defaults should match 100/8");

console.log("PASS task queue defaults contract");
