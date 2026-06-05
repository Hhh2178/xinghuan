import { createHealthPayload, type AppEnvironment } from "@xinghuan/shared";
import { Pool } from "pg";
import { createClient } from "redis";

const environment = (process.env.XINGHUAN_APP_ENV ?? "local") as AppEnvironment;
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
const redisUrl = process.env.XINGHUAN_REDIS_URL || process.env.REDIS_URL || "";
const queueName = process.env.XINGHUAN_TASK_QUEUE || "xinghuan:tasks";
const pollTimeoutSeconds = Number.parseInt(process.env.XINGHUAN_WORKER_POLL_TIMEOUT_SECONDS || "5", 10);
const workerId = process.env.XINGHUAN_WORKER_ID || `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

if (!databaseUrl) {
  console.error("DATABASE_NOT_CONFIGURED");
  process.exit(2);
}

if (!redisUrl) {
  console.error("REDIS_NOT_CONFIGURED");
  process.exit(3);
}

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 3000,
  max: 3,
});

const redis = createClient({ url: redisUrl });
redis.on("error", (error) => {
  console.error("xinghuan-worker redis error", error instanceof Error ? error.message : String(error));
});

let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

await redis.connect();
console.log(JSON.stringify({ ...createHealthPayload("xinghuan-worker", environment), workerId, queueName }));

while (!stopping) {
  const item = await redis.brPop(queueName, pollTimeoutSeconds).catch((error) => {
    console.error("xinghuan-worker queue read failed", error instanceof Error ? error.message : String(error));
    return null;
  });
  if (!item) continue;
  await processTask(item.element);
}

await redis.quit().catch(() => undefined);
await pool.end().catch(() => undefined);
console.log("xinghuan-worker stopped");

async function processTask(taskId: string) {
  const task = await readTask(taskId);
  if (!task) {
    console.warn(`xinghuan-worker skipped missing task ${taskId}`);
    return;
  }
  if (task.status !== "queued") {
    console.log(`xinghuan-worker skipped ${taskId}: status=${task.status}`);
    return;
  }

  await updateTask(taskId, "running", [`${workerId} 已领取任务`]);
  try {
    await executeMockTask(task);
    await updateTask(taskId, "succeeded", [`${workerId} 执行完成`], { workerId, completedAt: new Date().toISOString() });
  } catch (error) {
    await updateTask(taskId, "failed", [`${workerId} 执行失败: ${error instanceof Error ? error.message : String(error)}`], {
      workerId,
      failedAt: new Date().toISOString(),
    });
  }
}

async function executeMockTask(task: TaskRow) {
  await sleep(300);
  if (task.title.includes("失败") || task.title.toLowerCase().includes("fail")) {
    throw new Error("mock task requested failure");
  }
}

async function readTask(taskId: string): Promise<TaskRow | null> {
  const result = await pool.query("select id, title, status, logs from xh_tasks where id = $1", [taskId]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    status: normalizeStatus(row.status),
    logs: Array.isArray(row.logs) ? row.logs.map((line: unknown) => String(line)).filter(Boolean) : [],
  };
}

async function updateTask(taskId: string, status: TaskStatus, newLogs: string[], resultPatch?: Record<string, unknown>) {
  const task = await readTask(taskId);
  const logs = [...(task?.logs || []), ...newLogs];
  await pool.query(
    `update xh_tasks
     set status = $2,
         logs = $3::jsonb,
         result = coalesce(result, '{}'::jsonb) || $4::jsonb,
         updated_at = now()
     where id = $1`,
    [taskId, status, JSON.stringify(logs), JSON.stringify(resultPatch || {})],
  );
}

function normalizeStatus(value: unknown): TaskStatus {
  const status = String(value || "");
  return ["queued", "running", "succeeded", "failed", "cancelled"].includes(status) ? (status as TaskStatus) : "queued";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  logs: string[];
}
