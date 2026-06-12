import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROVIDER_GENERATION_EXECUTION_MODES,
  PROVIDER_GENERATION_TASK_STATUSES,
  canCancelTask,
  canRetryTask,
} from "../packages/shared/src/index.ts";

const root = process.cwd();
const contractPath = join(root, "packages", "shared", "src", "provider-generation-task.ts");

assert.equal(existsSync(contractPath), true, "provider-generation-task.ts should exist");

assert.deepEqual(PROVIDER_GENERATION_EXECUTION_MODES, [
  "sync_inline",
  "async_poll",
  "async_poll_then_final_lookup",
  "worker_queue",
]);

assert.deepEqual(PROVIDER_GENERATION_TASK_STATUSES, [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

assert.equal(canCancelTask("queued"), true);
assert.equal(canCancelTask("running"), true);
assert.equal(canCancelTask("succeeded"), false);
assert.equal(canRetryTask("failed"), true);
assert.equal(canRetryTask("cancelled"), true);
assert.equal(canRetryTask("running"), false);

const contractSource = readFileSync(contractPath, "utf8");
assert.match(contractSource, /export interface ProviderGenerationTaskResult/);
assert.match(contractSource, /resourceItemIds/);
assert.match(contractSource, /materializedImageUrls/);
assert.match(contractSource, /materializedVideoUrls/);
assert.match(contractSource, /materializedAudioUrls/);
assert.match(contractSource, /failureReason/);

console.log(JSON.stringify({ ok: true }, null, 2));
