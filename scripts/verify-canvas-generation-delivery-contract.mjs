import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [webGeneration, service, taskRepository, worker, operation, recovery, lifecycle, outputFixture, runtimeProjection, idempotencyMigration] = await Promise.all([
  read("apps/web/src/services/generation.ts"),
  read("apps/api/src/provider-generation-task-service.ts"),
  read("apps/api/src/task-repository.ts"),
  read("apps/worker/src/worker.ts"),
  read("apps/worker/src/worker-task-operation.ts"),
  read("apps/worker/src/worker-output-recovery.ts"),
  read("apps/worker/src/worker-task-lifecycle.ts"),
  read("scripts/verify-worker-output-materials.mjs"),
  read("apps/api/src/task-runtime-projection.ts"),
  read("apps/api/db/046_provider_generation_task_idempotency.sql"),
]);

assert.match(webGeneration, /submitExternal(?:Image|Video|Audio)Task/, "Canvas client must submit generation tasks through a typed boundary");
assert.match(service, /createQueuedTask\(/, "API must persist a queued task before worker execution");
assert.match(service, /idempotencyKey/, "API task creation must preserve idempotency identity");
assert.match(taskRepository, /readTaskByOwnerIdempotencyKey/, "task repository must recover an existing owner-scoped request");
assert.match(idempotencyMigration, /unique index.*idx_xh_tasks_owner_generation_idempotency/is, "database must reject concurrent duplicate generation requests");
assert.match(worker, /createWorkerTaskCancellationMonitor/, "worker must propagate cancellation into execution");
assert.match(worker, /executeWorkerTaskOperation\(/, "worker must dispatch recovery separately from Provider execution");
assert.match(operation, /outputRecoveryMode === "output_only"/, "output-only tasks must bypass Provider execution");
assert.match(recovery, /materializationStatus: "retrying"/, "recovery must identify materialization-only work");
assert.match(lifecycle, /updateTask\(/, "worker lifecycle must own terminal persistence");
assert.match(runtimeProjection, /projectTaskRuntimeDisplayState/, "runtime projection must translate task state for clients");
assert.match(outputFixture, /startMockOpenAiServer\(/, "delivery fixture must use a local mock Provider");
assert.match(outputFixture, /task\?\.status === "succeeded"/, "delivery fixture must await terminal success");
assert.match(outputFixture, /artifact\.fileUrl\?\.startsWith\("\/files\/output\/"\)/, "delivery fixture must require materialized output");
assert.match(outputFixture, /savedFile\.status === 200/, "delivery fixture must require readable output");

console.log(JSON.stringify({ ok: true, contract: "canvas-generation-delivery" }, null, 2));
