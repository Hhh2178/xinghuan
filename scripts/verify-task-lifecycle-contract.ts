import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyTaskCancellation,
  createRetriedTask,
  taskCancellationPatch,
} from "../apps/api/src/task-lifecycle.js";

const root = process.cwd();
const modulePath = join(root, "apps", "api", "src", "task-lifecycle.ts");
const serverPath = join(root, "apps", "api", "src", "server.ts");
const serverSource = readFileSync(serverPath, "utf8");

const now = 1_780_000_000_000;
const actorEmail = "admin@example.test";
const originalTask = {
  id: "task-original",
  title: "Generate reference",
  status: "cancelled" as const,
  ownerId: "usr-admin",
  providerId: "provider-a",
  modelId: "model-a",
  payload: { prompt: "keep me", nested: { value: 1 } },
  result: { previous: true },
  logs: ["created"],
  createdAt: now - 10_000,
  updatedAt: now - 5_000,
};

const cancellableTask = { ...originalTask, status: "running" as const };
const cancelPatch = taskCancellationPatch(actorEmail, now);
const cancelled = applyTaskCancellation(cancellableTask, actorEmail, now);
const retried = createRetriedTask(originalTask, {
  id: "task-retry",
  ownerId: "usr-fallback",
  now,
});

const checks = [
  {
    name: "task lifecycle helper module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "server imports task lifecycle helpers",
    pass: serverSource.includes('from "./task-lifecycle.js"'),
  },
  {
    name: "server does not inline retry task construction",
    pass: !serverSource.includes("retryOfTaskId: originalTask.id") && !serverSource.includes("由任务 ${originalTask.id} 重试创建"),
  },
  {
    name: "cancellation patch records actor and timestamp",
    pass: cancelPatch.result.cancelledBy === actorEmail && cancelPatch.result.cancelledAt === new Date(now).toISOString(),
  },
  {
    name: "running task can be cancelled with merged result and log",
    pass:
      cancelled.status === "cancelled" &&
      cancelled.result?.previous === true &&
      cancelled.result?.cancelledBy === actorEmail &&
      cancelled.logs.some((line) => line.includes(actorEmail)) &&
      cancelled.updatedAt === now,
  },
  {
    name: "succeeded task cannot be cancelled",
    pass: (() => {
      try {
        applyTaskCancellation({ ...originalTask, status: "succeeded" }, actorEmail, now);
        return false;
      } catch (error) {
        return String(error instanceof Error ? error.message : error).includes("不可取消");
      }
    })(),
  },
  {
    name: "retry task preserves execution inputs and resets status",
    pass:
      retried.id === "task-retry" &&
      retried.title === originalTask.title &&
      retried.status === "queued" &&
      retried.ownerId === originalTask.ownerId &&
      retried.providerId === originalTask.providerId &&
      retried.modelId === originalTask.modelId &&
      retried.payload?.prompt === "keep me",
  },
  {
    name: "retry task records source metadata and log",
    pass:
      retried.result?.retryOfTaskId === originalTask.id &&
      retried.result?.retryCreatedAt === new Date(now).toISOString() &&
      retried.logs.some((line) => line.includes(originalTask.id)) &&
      retried.createdAt === now &&
      retried.updatedAt === now,
  },
  {
    name: "non retryable task cannot be retried",
    pass: (() => {
      try {
        createRetriedTask({ ...originalTask, status: "running" }, { id: "task-retry", ownerId: "usr-fallback", now });
        return false;
      } catch (error) {
        return String(error instanceof Error ? error.message : error).includes("不可重试");
      }
    })(),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Task lifecycle contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
