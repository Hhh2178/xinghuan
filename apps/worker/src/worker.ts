import {
  TASK_QUEUE_CAPABILITIES,
  buildTaskQueueRuntimeDescriptors,
  createHealthPayload,
  defaultTaskQueueSettings,
  normalizeTaskQueueSettings,
  taskQueueNameForCapability,
  type AppEnvironment,
  type TaskQueueCapability,
  type TaskQueueRuntimeDescriptor,
  type TaskQueueWorkerRuntimeSlot,
  type TaskQueueSettings,
} from "@xinghuan/shared";
import { createDecipheriv, createHash } from "node:crypto";
import { join } from "node:path";
import { Pool } from "pg";
import { createClient, type RedisClientType } from "redis";
import { prepareGrsaiReferenceImages } from "./grsai-reference-images.js";
import { materializeTaskOutputs } from "./output-materials.js";
import { createGrsaiImageClient } from "./worker-grsai-image-client.js";
import {
  createOpenAiAudioChatPayload,
  extractAudioProviderResult,
} from "./worker-audio-provider-adapter.js";
import {
  createApimartVideoAdapterPayload,
  extractApimartFinalTaskId,
  extractApimartTask,
  extractApimartVideoResult,
  resolveApimartVideoMultipartFieldNames,
  shouldUseApimartVideoAdapter,
} from "./worker-apimart-video-adapter.js";
import {
  buildProviderMultipartRequestBody,
  isMultipartRequestBodyMode,
} from "./worker-provider-request-body.js";
import {
  extractChatContent,
  extractImageOutputs,
  extractVideoUrls,
  openAiEndpoint,
  openAiImageGenerationUrl,
  providerHeaders,
  providerJsonHeaders as buildProviderJsonHeaders,
} from "./worker-provider-utils.js";
import { createRunningHubClient } from "./worker-runninghub-client.js";
import { createWorkerCancelSync } from "./worker-cancel-sync.js";
import { buildWorkerFailureWritebackPatch } from "./worker-failure-glue.js";
import {
  readWorkerTaskResultPatch,
  toOptionalHttpStatus,
} from "./worker-runtime-diagnostics.js";
import {
  buildUpstreamBusinessFailurePatch,
  createWorkerTaskError,
  createWorkerTaskLifecycle,
} from "./worker-task-lifecycle.js";
import {
  acquireRunningHubExecutionWindow,
  releaseRunningHubExecutionWindow,
  selectExecutableRunningHubKey,
  type RunningHubKeyPoolItem,
} from "./worker-runninghub-dispatch.js";
import { createWorkerTaskStore, type TaskRow } from "./worker-task-store.js";

const environment = (process.env.XINGHUAN_APP_ENV ?? "local") as AppEnvironment;
const dataDir = process.env.XINGHUAN_DATA_DIR ?? join(process.cwd(), "data");
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
const expectedDatabaseName = (process.env.XINGHUAN_EXPECTED_DATABASE_NAME || "").trim();
const redisUrl = process.env.XINGHUAN_REDIS_URL || process.env.REDIS_URL || "";
const queueName = process.env.XINGHUAN_TASK_QUEUE || "xinghuan:tasks";
const pollTimeoutSeconds = Number.parseInt(process.env.XINGHUAN_WORKER_POLL_TIMEOUT_SECONDS || "5", 10);
const workerId = process.env.XINGHUAN_WORKER_ID || `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const staleRunningTaskMs = Number.parseInt(process.env.XINGHUAN_WORKER_STALE_RUNNING_MS || `${30 * 60 * 1000}`, 10);
const staleTaskReaperIntervalMs = Number.parseInt(process.env.XINGHUAN_WORKER_REAPER_INTERVAL_MS || "60000", 10);
const taskDeferredRetryMs = Number.parseInt(process.env.XINGHUAN_WORKER_DEFERRED_RETRY_MS || "1500", 10);
const taskQueueRefreshIntervalMs = Number.parseInt(process.env.XINGHUAN_WORKER_QUEUE_REFRESH_INTERVAL_MS || "5000", 10);

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
const {
  readTask,
  updateTask,
  appendTaskLog,
  touchTaskRuntime,
  touchQueuedTaskRuntime,
  isTaskCancelled,
} = createWorkerTaskStore(pool);
const workerTaskLifecycle = createWorkerTaskLifecycle({
  workerId,
  appendTaskLog,
  updateTask,
  logWorkerEvent,
});
const workerCancelSync = createWorkerCancelSync({
  isTaskCancelled,
  logWorkerEvent,
  dropCancelledAttempt: workerTaskLifecycle.dropCancelledAttempt,
  keepCancelledState: workerTaskLifecycle.keepCancelledState,
});

let currentDatabaseNamePromise: Promise<string> | null = null;

const redisControl = createClient({ url: redisUrl });
redisControl.on("error", (error) => {
  console.error("xinghuan-worker redis error", error instanceof Error ? error.message : String(error));
});

let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

interface QueueLoopController {
  capability: TaskQueueCapability;
  queue: string;
  slotIndex: number;
  shouldStop: boolean;
  connected: boolean;
  redis: RedisClientType;
  finished: Promise<void> | null;
}

const queueLoopControllers = new Map<TaskQueueCapability, QueueLoopController[]>();
const queueRuntimeDescriptorState = new Map<TaskQueueCapability, TaskQueueRuntimeDescriptor>();
let queueControllerRefreshTimer: NodeJS.Timeout | null = null;
let queueControllerRefreshInFlight: Promise<TaskQueueRuntimeDescriptor[]> | null = null;

await ensureRuntimeDatabaseTarget("xinghuan-worker");
await redisControl.connect();
const queueNames = TASK_QUEUE_CAPABILITIES.map((capability) => taskQueueNameForCapability(queueName, capability));
const initialQueueDescriptors = await refreshQueueControllers();
console.log(JSON.stringify({ ...createHealthPayload("xinghuan-worker", environment), workerId, queueName, queueNames, queues: initialQueueDescriptors }));
await runWorkerRuntime();
await redisControl.quit().catch(() => undefined);
await pool.end().catch(() => undefined);
console.log("xinghuan-worker stopped");

async function readCurrentDatabaseName() {
  currentDatabaseNamePromise ??= (async () => {
    const result = await pool.query("select current_database() as name");
    return String(result.rows?.[0]?.name || "").trim();
  })();
  return currentDatabaseNamePromise;
}

async function ensureRuntimeDatabaseTarget(serviceName: string) {
  if (!expectedDatabaseName) return;
  const currentDatabaseName = await readCurrentDatabaseName();
  if (!currentDatabaseName) throw new Error("DATABASE_TARGET_UNAVAILABLE");
  if (currentDatabaseName !== expectedDatabaseName) {
    throw new Error(
      `DATABASE_TARGET_MISMATCH service=${serviceName} env=${environment} expected=${expectedDatabaseName} actual=${currentDatabaseName}`,
    );
  }
  console.log(
    JSON.stringify({
      ok: true,
      service: serviceName,
      environment,
      databaseTargetCheck: "passed",
      currentDatabase: currentDatabaseName,
    }),
  );
}

async function runQueueLoop(controller: QueueLoopController) {
  while (!stopping && !controller.shouldStop) {
    const item = await controller.redis.brPop(controller.queue, pollTimeoutSeconds).catch((error) => {
      console.error(
        "xinghuan-worker queue read failed",
        JSON.stringify({
          capability: controller.capability,
          queue: controller.queue,
          slotIndex: controller.slotIndex,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return null;
    });
    if (!item) continue;
    await persistRuntimeQueueSlots();
    await processTask(item.element).catch((error) => {
      console.error(
        "xinghuan-worker task processing crashed",
        JSON.stringify({
          capability: controller.capability,
          queue: controller.queue,
          slotIndex: controller.slotIndex,
          taskId: item.element,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }
  await persistRuntimeQueueSlots();
}

async function startQueueLoop(controller: QueueLoopController) {
  try {
    await controller.redis.connect();
    controller.connected = true;
    await persistRuntimeQueueSlots();
    await runQueueLoop(controller);
  } catch (error) {
    console.error(
      "xinghuan-worker queue loop init failed",
      JSON.stringify({
        capability: controller.capability,
        queue: controller.queue,
        slotIndex: controller.slotIndex,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  } finally {
    controller.connected = false;
    await controller.redis.quit().catch(() => undefined);
  }
}

async function refreshQueueControllers() {
  if (queueControllerRefreshInFlight) return queueControllerRefreshInFlight;
  queueControllerRefreshInFlight = (async () => {
  const taskQueueSettings = await readTaskQueueSettings();
  const descriptors = buildTaskQueueRuntimeDescriptors(queueName, taskQueueSettings);
  for (const descriptor of descriptors) {
    queueRuntimeDescriptorState.set(descriptor.capability, descriptor);
    reconcileQueueControllers(descriptor);
  }
  await persistRuntimeQueueSlots();
  return descriptors;
  })();
  try {
    return await queueControllerRefreshInFlight;
  } finally {
    queueControllerRefreshInFlight = null;
  }
}

function reconcileQueueControllers(descriptor: TaskQueueRuntimeDescriptor) {
  const controllers = queueLoopControllers.get(descriptor.capability) ?? [];
  queueLoopControllers.set(descriptor.capability, controllers);
  while (controllers.filter((controller) => !controller.shouldStop).length < descriptor.concurrency) {
    const slotIndex = controllers.length;
    const controller: QueueLoopController = {
      capability: descriptor.capability,
      queue: descriptor.queue,
      slotIndex,
      shouldStop: false,
      connected: false,
      redis: redisControl.duplicate(),
      finished: null,
    };
    controller.finished = startQueueLoop(controller).finally(() => {
      const current = queueLoopControllers.get(descriptor.capability);
      if (!current) return;
      const index = current.indexOf(controller);
      if (index >= 0) current.splice(index, 1);
      for (let nextIndex = 0; nextIndex < current.length; nextIndex += 1) {
        current[nextIndex].slotIndex = nextIndex;
      }
      void persistRuntimeQueueSlots();
    });
    controllers.push(controller);
  }
  while (controllers.filter((controller) => !controller.shouldStop).length > descriptor.concurrency) {
    const controller = [...controllers].reverse().find((item) => !item.shouldStop);
    if (!controller) break;
    controller.shouldStop = true;
  }
}

async function persistRuntimeQueueSlots() {
  const runtimeSlots: TaskQueueWorkerRuntimeSlot[] = [];
  for (const capability of TASK_QUEUE_CAPABILITIES) {
    const controllers = queueLoopControllers.get(capability) ?? [];
    const descriptor = queueRuntimeDescriptorState.get(capability);
    for (const controller of controllers) {
      if (!controller.connected) continue;
      runtimeSlots.push({
        workerId,
        capability,
        queue: descriptor?.queue || controller.queue,
        slotIndex: controller.slotIndex,
        state: controller.shouldStop ? "stopping" : "active",
        updatedAt: Date.now(),
      });
    }
  }
  if (runtimeSlots.length === 0) {
    await redisControl.del(`xinghuan:worker-runtime:${workerId}`).catch(() => undefined);
    return;
  }
  await redisControl
    .set(`xinghuan:worker-runtime:${workerId}`, JSON.stringify(runtimeSlots), {
      expiration: {
        type: "EX",
        value: Math.max(10, Math.ceil(Math.max(1000, taskQueueRefreshIntervalMs) / 1000) * 3),
      },
    })
    .catch(() => undefined);
}

async function runWorkerRuntime() {
  queueControllerRefreshTimer = setInterval(() => {
    void refreshQueueControllers().catch((error) => {
      console.error(
        "xinghuan-worker queue controller refresh failed",
        JSON.stringify({ workerId, error: error instanceof Error ? error.message : String(error) }),
      );
    });
  }, Math.max(1000, taskQueueRefreshIntervalMs));
  const backgroundLoops = staleRunningTaskMs > 0 && staleTaskReaperIntervalMs > 0 ? [runStaleTaskReaperLoop()] : [];
  while (!stopping) {
    await wait(1000);
  }
  if (queueControllerRefreshTimer) {
    clearInterval(queueControllerRefreshTimer);
    queueControllerRefreshTimer = null;
  }
  for (const controllers of queueLoopControllers.values()) {
    for (const controller of controllers) {
      controller.shouldStop = true;
    }
  }
  await persistRuntimeQueueSlots();
  const workerLoops = Array.from(queueLoopControllers.values()).flatMap((controllers) =>
    controllers.map((controller) => controller.finished).filter(Boolean) as Promise<void>[],
  );
  await Promise.allSettled([...workerLoops, ...backgroundLoops]);
}

async function readTaskQueueSettings(): Promise<TaskQueueSettings> {
  const fallback = defaultTaskQueueSettings();
  const result = await pool
    .query("select task_queue_settings from xh_system_settings where id = 'default' limit 1")
    .catch(() => null);
  if (!result?.rows?.[0]) return fallback;
  return normalizeTaskQueueSettings(result.rows[0].task_queue_settings, fallback);
}

async function processTask(taskId: string) {
  logWorkerEvent("task.received", { taskId });
  const task = await readTask(taskId);
  if (!task) {
    console.warn(`xinghuan-worker skipped missing task ${taskId}`);
    return;
  }
  const trace = taskTraceContext(task);
  if (task.status !== "queued") {
    logWorkerEvent("task.skipped", { ...trace, taskId, status: task.status, message: `status=${task.status}` });
    return;
  }

  const taskQueueSettings = await readTaskQueueSettings();
  const capabilitySettings = task.capability === "image" || task.capability === "audio" || task.capability === "video"
    ? taskQueueSettings[task.capability]
    : null;
  const runningHubDispatchDeps = buildRunningHubDispatchDeps(task, taskQueueSettings);
  const userWindow = capabilitySettings ? await acquireUserExecutionWindow(task, capabilitySettings.userConcurrency) : { acquired: true as const };
  if (!userWindow.acquired) {
    await deferTaskExecution(task, "waiting_user_window", userWindow.reason);
    return;
  }
  const runningHubWindow = await acquireRunningHubExecutionWindow(runningHubDispatchDeps);
  if (!runningHubWindow.acquired) {
    await releaseUserExecutionWindow(task);
    await deferTaskExecution(task, "waiting_runninghub_window", runningHubWindow.reason);
    return;
  }

  const claimResult = await updateTask(taskId, "running", [`${workerId} 已领取任务`]);
  if (await workerCancelSync.handleCancelledClaim({
    taskId,
    capability: task.capability,
    trace,
    claimResult,
    onCancelled: async () => {
      await releaseRunningHubExecutionWindow(runningHubDispatchDeps);
      await releaseUserExecutionWindow(task);
    },
  })) {
    return;
  }
  if (claimResult === "missing") {
    await releaseRunningHubExecutionWindow(runningHubDispatchDeps);
    await releaseUserExecutionWindow(task);
    console.warn(`xinghuan-worker skipped missing task during claim ${taskId}`);
    return;
  }
  logWorkerEvent("task.claimed", { ...trace, taskId, capability: task.capability });
  await touchTaskRuntime(taskId, {
    workerId,
    startedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
    runtimeStage: "running",
  });
  let shouldRequeueAfterRelease = false;
  try {
    const result = await executeTask(task);
    if (await workerCancelSync.dropResultIfCancelled({
      taskId,
      capability: task.capability,
      trace,
    })) {
      return;
    }
    const materialized = await materializeTaskOutputs({ dataDir, task, result });
    const completionLogs =
      materialized.resourceItems.length > 0
        ? [`${workerId} 执行完成`, `${workerId} 已写入 ${materialized.resourceItems.length} 条输出素材`]
        : [`${workerId} 执行完成`];
    const completionResult = await updateTask(taskId, "succeeded", completionLogs, {
      ...result,
      ...materialized.resultPatch,
      workerId,
      completedAt: new Date().toISOString(),
    });
    if (await workerCancelSync.keepCompletionCancelledState({
      taskId,
      capability: task.capability,
      trace,
      outcome: completionResult,
    })) {
      return;
    }
    logWorkerEvent("task.succeeded", { ...trace, taskId, capability: task.capability, status: "succeeded" });
  } catch (error) {
    if (await workerCancelSync.dropErrorIfCancelled({
      taskId,
      capability: task.capability,
      trace,
    })) {
      return;
    }
    if (isRetryableRunningHubQueueLimitError(error)) {
      const retryDetail = buildRunningHubQueueLimitRetryDetail(error);
      const queuedResult = await requeueRunningTask(task, retryDetail, readWorkerTaskResultPatch(error));
      if (await workerCancelSync.keepRetryCancelledState({
        taskId,
        capability: task.capability,
        trace,
        outcome: queuedResult,
      })) {
        return;
      }
      shouldRequeueAfterRelease = queuedResult === "updated";
      if (shouldRequeueAfterRelease) {
        logWorkerEvent("task.requeued", {
          ...trace,
          taskId,
          capability: task.capability,
          status: "queued",
          reason: retryDetail,
        });
      }
      return;
    }
    await workerTaskLifecycle.failTask({
      task,
      trace,
      error,
      baseResultPatch: buildWorkerFailureWritebackPatch({
        workerId,
        error,
      }),
    });
    return;
  } finally {
    await releaseRunningHubExecutionWindow(runningHubDispatchDeps);
    await releaseUserExecutionWindow(task);
    if (shouldRequeueAfterRelease) {
      await wait(Math.max(500, taskDeferredRetryMs));
      await requeueDeferredTask(task.id, task.capability);
    }
  }
}

async function deferTaskExecution(
  task: TaskRow,
  waitReason: "waiting_user_window" | "waiting_runninghub_window",
  detail: string,
) {
  await touchQueuedTaskRuntime(task.id, {
    waitReason,
    waitDetail: detail,
    waitUpdatedAt: new Date().toISOString(),
    runtimeStage: "queued",
  });
  await appendTaskLog(task.id, `${workerId} 等待执行窗口: ${detail}`);
  await wait(Math.max(200, taskDeferredRetryMs));
  await requeueDeferredTask(task.id, task.capability);
}

async function requeueDeferredTask(taskId: string, capability: string) {
  const queueCapability = capabilityToQueueCapability(capability);
  if (!queueCapability) return;
  const queue = taskQueueNameForCapability(queueName, queueCapability);
  await redisControl.lPush(queue, taskId);
}

async function requeueRunningTask(task: TaskRow, detail: string, resultPatch: Record<string, unknown> = {}) {
  return updateTask(task.id, "queued", [`${workerId} RunningHub 上游并发已满，任务回退到队列等待重试: ${detail}`], {
    ...resultPatch,
    workerId,
    status: "queued",
    runtimeStage: "queued",
    waitReason: "waiting_runninghub_window",
    waitDetail: detail,
    waitUpdatedAt: new Date().toISOString(),
    requeuedAt: new Date().toISOString(),
  });
}

function capabilityToQueueCapability(capability: string): TaskQueueCapability | null {
  if (capability === "image" || capability === "audio" || capability === "video") return capability;
  if (capability === "chat") return "video";
  return null;
}

async function acquireUserExecutionWindow(task: TaskRow, limit: number): Promise<{ acquired: true } | { acquired: false; reason: string }> {
  if (!task.ownerId || limit <= 0) return { acquired: true };
  const key = `xinghuan:user-window:${task.capability}:${task.ownerId}`;
  const current = Number(await redisControl.get(key).catch(() => "0")) || 0;
  if (current >= limit) {
    return { acquired: false, reason: `用户 ${task.ownerId} 的 ${task.capability} 并发已满 (${current}/${limit})` };
  }
  const next = await redisControl.incr(key);
  if (next === 1) await redisControl.expire(key, 60 * 60);
  if (next > limit) {
    await redisControl.decr(key).catch(() => undefined);
    return { acquired: false, reason: `用户 ${task.ownerId} 的 ${task.capability} 并发已满 (${next - 1}/${limit})` };
  }
  return { acquired: true };
}

async function releaseUserExecutionWindow(task: TaskRow) {
  if (!task.ownerId || !["image", "audio", "video"].includes(task.capability)) return;
  const key = `xinghuan:user-window:${task.capability}:${task.ownerId}`;
  const current = Number(await redisControl.get(key).catch(() => "0")) || 0;
  if (current <= 0) return;
  const next = await redisControl.decr(key).catch(() => current - 1);
  if (Number(next) <= 0) await redisControl.del(key).catch(() => undefined);
}

async function executeTask(task: TaskRow): Promise<Record<string, unknown>> {
  if (!task.providerId && !task.modelRecordId) {
    return { adapter: "noop", note: "未绑定 Provider/Model，按后台队列健康检查任务完成" };
  }
  const protocol = normalizeProtocol(task.providerProtocol);
  if (protocol === "runninghub") return executeRunningHubTask(task);
  if (task.capability === "image") return executeImageTask(task);
  if (task.capability === "video") return executeVideoTask(task);
  if (task.capability === "audio") return executeAudioTask(task);
  if (task.capability === "chat") return executeChatTask(task);
  throw new Error(`当前 Worker Adapter 暂不支持能力: ${task.capability || "unknown"}`);
}

async function runStaleTaskReaperLoop() {
  while (!stopping) {
    if (staleTaskReaperIntervalMs > 0) await wait(staleTaskReaperIntervalMs);
    if (stopping) break;
    await reapStaleRunningTasks().catch((error) => {
      console.error(
        "xinghuan-worker stale task reaper failed",
        JSON.stringify({ workerId, error: error instanceof Error ? error.message : String(error) }),
      );
    });
  }
}

async function reapStaleRunningTasks() {
  if (staleRunningTaskMs <= 0) return;
  const result = await pool.query(
    `select id, updated_at
     from xh_tasks
     where status = 'running'
       and updated_at < now() - ($1::bigint * interval '1 millisecond')
     order by updated_at asc
     limit 50`,
    [staleRunningTaskMs],
  );
  for (const row of result.rows) {
    const taskId = String(row.id || "").trim();
    if (!taskId) continue;
    const staleSince = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || "");
    const task = await readTask(taskId);
    const reaped = await updateTask(
      taskId,
      "failed",
      [`${workerId} reaper 检测到运行任务长时间无 heartbeat，按悬挂任务回收`],
      {
        workerId,
        failedAt: new Date().toISOString(),
        failureReason: "worker_stalled_or_upstream_timeout",
        reaperReason: "worker_stalled_or_upstream_timeout",
        reapedAt: new Date().toISOString(),
        staleSince,
      },
    );
    if (reaped === "updated") {
      logWorkerEvent("task.reaped", {
        ...(task ? taskTraceContext(task) : {}),
        taskId,
        staleSince,
        staleRunningTaskMs,
      });
      console.warn(
        "xinghuan-worker reaped stale task",
        JSON.stringify({ workerId, taskId, staleSince, staleRunningTaskMs }),
      );
    }
  }
}

async function executeImageTask(task: TaskRow): Promise<Record<string, unknown>> {
  const protocol = normalizeProtocol(task.providerProtocol);
  if (protocol === "runninghub") {
    return executeRunningHubTask(task);
  }
  if (!task.providerEnabled) throw new Error("Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("Provider 缺少 Base URL");
  if (!task.providerModelId) throw new Error("任务缺少 Provider 模型 ID");
  if (protocol === "grsai_draw") {
    return executeGrsaiImageTask(task);
  }
  if (!["openai", "apimart", "modelscope", "custom"].includes(protocol)) {
    throw new Error(`当前 Worker 图像 Adapter 暂不支持协议: ${protocol}`);
  }
  const apiKey = decryptSecret(task.apiKeyCipher);
  if (!apiKey) throw new Error("Provider 未配置 API Key 或无法解密");

  const prompt = safeText(task.payload.prompt);
  if (!prompt) throw new Error("图像任务缺少 prompt");
  const imageUrls = Array.isArray(task.payload.images) ? task.payload.images.map((item) => safeText(item)).filter(Boolean).slice(0, 16) : [];
  const requestBody: Record<string, unknown> = {
    model: task.providerModelId,
    prompt,
    n: clampNumber(task.payload.n, 1, 1, 4),
    size: safeText(task.payload.size || task.payload.image_size, "1024x1024"),
  };
  const aspectRatio = safeText(task.payload.aspectRatio || task.payload.aspect_ratio);
  if (aspectRatio) requestBody.aspect_ratio = aspectRatio;
  const isModelScope = isModelScopeImageProvider(protocol, task.providerBaseUrl);
  applyImageReferencePayload(requestBody, imageUrls, isModelScope);

  const upstream = await fetch(openAiImageGenerationUrl(task.providerBaseUrl), {
    method: "POST",
    headers: {
      ...(isModelScope ? modelScopeHeaders(apiKey, "submit") : providerHeaders(apiKey)),
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(120000),
  });
  const text = await upstream.text();
  if (!upstream.ok) throw new Error(`上游图像生成失败 ${upstream.status}: ${text.slice(0, 500)}`);
  const raw = text ? JSON.parse(text) : {};
  const extracted = extractImageOutputs(raw);
  if (extracted.imageUrls.length === 0) {
    const taskMeta = isModelScope
      ? extractModelScopeImageTask(raw, plainObject(task.payload))
      : extractApimartTask(raw, {
          taskIdPath: safeText(task.payload.taskIdPath, "data.0.task_id"),
          statusPath: safeText(task.payload.taskStatusPath, "data.0.status"),
        });
    if (!taskMeta.taskId) throw new Error("上游未返回可用图像");
    await touchTaskRuntime(task.id, {
      heartbeatAt: new Date().toISOString(),
      upstreamTaskId: taskMeta.taskId,
      taskId: taskMeta.taskId,
      upstreamStatus: safeText(taskMeta.status || "submitted"),
      runtimeStage: "polling",
    });
    const polled = isModelScope
      ? await pollModelScopeImageTask({
          baseUrl: task.providerBaseUrl,
          apiKey,
          taskId: taskMeta.taskId,
          statusPath: safeText(task.payload.taskStatusPath, "task_status"),
          pollPathTemplate: safeText(task.payload.pollPathTemplate, "tasks/{task_id}"),
          pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 2500, 500, 30000),
          timeoutMs: clampNumber(task.payload.timeoutMs || task.payload.maxPollMs || task.payload.pollTimeoutMs, 360000, 5000, 1800000),
          onHeartbeat: (patch) => touchTaskRuntime(task.id, patch),
        })
      : await pollApimartImageTask({
          baseUrl: task.providerBaseUrl,
          apiKey,
          taskId: taskMeta.taskId,
          statusPath: safeText(task.payload.pollStatusPath, "data.status"),
          pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 2500, 500, 30000),
          timeoutMs: clampNumber(task.payload.timeoutMs || task.payload.maxPollMs, 360000, 5000, 1800000),
          onHeartbeat: (patch) => touchTaskRuntime(task.id, patch),
        });
    if (polled.imageUrls.length === 0) throw new Error(isModelScope ? "ModelScope 未返回可用图像" : "APIMart 未返回可用图像");
    return {
      adapter: isModelScope ? "modelscope-image" : "apimart-image",
      providerId: task.providerId,
      modelId: task.providerModelId,
      taskId: taskMeta.taskId,
      imageUrls: polled.imageUrls,
      remoteImageUrls: polled.remoteImageUrls,
      imageCount: polled.imageUrls.length,
    };
  }
  return {
    adapter: "openai-image",
    providerId: task.providerId,
    modelId: task.providerModelId,
    imageUrls: extracted.imageUrls,
    remoteImageUrls: extracted.remoteImageUrls,
    imageCount: extracted.imageUrls.length,
  };
}

async function executeVideoTask(task: TaskRow): Promise<Record<string, unknown>> {
  const protocol = normalizeProtocol(task.providerProtocol);
  if (protocol === "runninghub") {
    return executeRunningHubTask(task);
  }
  if (!task.providerEnabled) throw new Error("Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("Provider 缺少 Base URL");
  if (!task.providerModelId) throw new Error("任务缺少 Provider 模型 ID");
  if (!["openai", "apimart", "modelscope", "custom"].includes(protocol)) {
    throw new Error(`当前 Worker 视频 Adapter 暂不支持协议: ${protocol}`);
  }
  const apiKey = decryptSecret(task.apiKeyCipher);
  if (!apiKey) throw new Error("Provider 未配置 API Key 或无法解密");

  const prompt = safeText(task.payload.prompt);
  if (!prompt) throw new Error("视频任务缺少 prompt");
  const images = Array.isArray(task.payload.images) ? task.payload.images.map((item) => safeText(item)).filter(Boolean).slice(0, 16) : [];
  const ratio = safeText(task.payload.aspectRatio || task.payload.aspect_ratio || task.payload.ratio);
  const duration = task.payload.duration;
  const resolution = safeText(task.payload.resolution);
  const firstFrame = safeText(task.payload.first_frame || task.payload.firstFrame);
  const lastFrame = safeText(task.payload.last_frame || task.payload.lastFrame);
  const advancedMode = safeText(task.payload.advancedMode || task.payload.mode);
  const submitPath = safeText(task.payload.submitPath, "videos/generations");

  if (shouldUseApimartVideoAdapter({
    protocol,
    advancedMode,
    modelId: task.providerModelId,
    providerBaseUrl: task.providerBaseUrl,
  })) {
    const requestMapping = plainObject(task.payload.requestMapping) as Record<string, string>;
    const submitPayload = createApimartVideoAdapterPayload({
      modelId: task.providerModelId,
      prompt,
      ratio,
      duration: typeof duration === "string" || typeof duration === "number" ? duration : undefined,
      resolution,
      images,
      firstFrame: firstFrame || undefined,
      lastFrame: lastFrame || undefined,
      requestMapping,
      requestValueTypes: plainObject(task.payload.requestValueTypes) as Record<string, string>,
      requestValueTemplates: plainObject(task.payload.requestValueTemplates) as Record<string, string>,
      fixedBody: plainObject(task.payload.fixedBody),
    });
    const requestBodyMode = safeText(task.payload.requestBodyMode || task.payload.requestContentType);
    const submitBody = isMultipartRequestBodyMode(requestBodyMode)
      ? await buildProviderMultipartRequestBody(
          submitPayload,
          resolveApimartVideoMultipartFieldNames({
            requestMapping,
            requestFileFields: Array.isArray(task.payload.requestFileFields)
              ? task.payload.requestFileFields.map((item) => safeText(item)).filter(Boolean)
              : [],
          }),
        )
      : JSON.stringify(submitPayload);
    const submitResponse = await fetch(openAiEndpoint(task.providerBaseUrl, submitPath), {
      method: "POST",
      headers: isMultipartRequestBodyMode(requestBodyMode) ? providerHeaders(apiKey) : buildProviderJsonHeaders(apiKey),
      body: submitBody,
      signal: AbortSignal.timeout(180000),
    });
    const submitText = await submitResponse.text();
    if (!submitResponse.ok) throw new Error(`上游视频生成失败 ${submitResponse.status}: ${submitText.slice(0, 500)}`);
    const submitRaw = submitText ? JSON.parse(submitText) : {};
    const taskMeta = extractApimartTask(submitRaw, {
      taskIdPath: safeText(task.payload.taskIdPath, "data.0.task_id"),
      statusPath: safeText(task.payload.taskStatusPath, "data.0.status"),
    });
    if (!taskMeta.taskId) throw new Error("异步视频任务未返回 task_id/id");
    await touchTaskRuntime(task.id, {
      heartbeatAt: new Date().toISOString(),
      upstreamTaskId: taskMeta.taskId,
      taskId: taskMeta.taskId,
      upstreamStatus: safeText(taskMeta.status || "submitted"),
      runtimeStage: "polling",
    });
    const polled = await pollApimartVideoTask({
      baseUrl: task.providerBaseUrl,
      apiKey,
      taskId: taskMeta.taskId,
      statusPath: safeText(task.payload.taskStatusPath || task.payload.pollStatusPath, "data.status"),
      resultVideoPath: safeText(task.payload.resultVideoPath, "data.result.videos"),
      pollPathTemplate: safeText(task.payload.pollPathTemplate, "tasks/{task_id}"),
      finalResultTaskIdPath: safeText(task.payload.finalResultTaskIdPath),
      finalResultPathTemplate: safeText(task.payload.finalResultPathTemplate),
      finalResultVideoPath: safeText(task.payload.finalResultVideoPath),
      pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 2000, 500, 10000),
      timeoutMs: clampNumber(task.payload.timeoutMs || task.payload.maxPollMs, 360000, 5000, 1800000),
      onHeartbeat: (patch) => touchTaskRuntime(task.id, patch),
    });
    if (polled.videoUrls.length === 0) throw new Error("异步视频任务未返回可用视频 URL");
    return {
      adapter: "apimart-video",
      providerId: task.providerId,
      modelId: task.providerModelId,
      taskId: taskMeta.taskId,
      videoUrls: polled.videoUrls,
      remoteVideoUrls: polled.videoUrls,
      videoCount: polled.videoUrls.length,
    };
  }

  const payload: Record<string, unknown> = { model: task.providerModelId, prompt };
  if (ratio) payload.aspect_ratio = ratio;
  if (typeof duration === "string" || typeof duration === "number") payload.duration = duration;
  if (resolution) payload.resolution = resolution;
  if (images.length > 0) payload.image = images;
  if (firstFrame) payload.first_frame = firstFrame;
  if (lastFrame) payload.last_frame = lastFrame;

  const upstream = await fetch(openAiEndpoint(task.providerBaseUrl, submitPath), {
    method: "POST",
    headers: buildProviderJsonHeaders(apiKey),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180000),
  });
  const text = await upstream.text();
  if (!upstream.ok) throw new Error(`上游视频生成失败 ${upstream.status}: ${text.slice(0, 500)}`);
  const raw = text ? JSON.parse(text) : {};
  const videoUrls = extractVideoUrls(raw);
  if (videoUrls.length === 0) throw new Error("上游未返回可用视频 URL");
  return {
    adapter: "openai-video",
    providerId: task.providerId,
    modelId: task.providerModelId,
    videoUrls,
    remoteVideoUrls: videoUrls,
    videoCount: videoUrls.length,
  };
}

async function executeRunningHubTask(task: TaskRow): Promise<Record<string, unknown>> {
  if (!task.providerEnabled) throw new Error("RunningHub Provider 不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("RunningHub Provider 缺少 Base URL");
  const assignedRhKeyId = safeText(
    task.payload.assignedRhKeyId
      || task.result.assignedRhKeyId
      || task.payload.preferredRhKeyId
      || task.result.preferredRhKeyId,
  );
  const assignedRhKey = findAssignedRunningHubKey(task.rhKeyPool, assignedRhKeyId);
  const apiKey = decryptSecret(assignedRhKey?.apiKey || task.apiKeyCipher);
  if (!apiKey) throw new Error("RunningHub Provider 未配置 API Key 或无法解密");

  const targetType = safeText(task.payload.targetType).toLowerCase() === "app" ? "app" : "workflow";
  const runTargetId = safeText(task.payload.runTargetId || (targetType === "app" ? task.payload.webappId : task.payload.workflowId));
  const webappId = safeText(task.payload.webappId || (targetType === "app" ? runTargetId : ""));
  const workflowId = safeText(task.payload.workflowId || (targetType === "workflow" ? runTargetId : ""));
  if (!runTargetId) {
    throw new Error(targetType === "app" ? "RunningHub 任务缺少 webappId/runTargetId" : "RunningHub 任务缺少 workflowId/runTargetId");
  }
  const nodeInfoList = Array.isArray(task.payload.nodeInfoList)
    ? task.payload.nodeInfoList
        .map((item) => (item && typeof item === "object" ? plainObject(item) : {}))
        .filter((item) => safeText(item.nodeId) && safeText(item.fieldName))
        .map((item) => ({
          nodeId: safeText(item.nodeId),
          fieldName: safeText(item.fieldName),
          fieldValue: item.fieldValue,
        }))
    : [];
  const runningHubClient = createRunningHubClient({
    apiKey,
    baseUrl: task.providerBaseUrl,
    wait,
  });
  const result = await runningHubClient.runTask({
    targetType,
    runTargetId,
    webappId,
    workflowId,
    nodeInfoList,
    instanceType: safeText(task.payload.instanceType),
    pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 5000, 500, 30000),
    timeoutMs: clampNumber(task.payload.timeoutMs || task.payload.maxPollMs || task.payload.pollTimeoutMs, 20 * 60 * 1000, 5000, 60 * 60 * 1000),
    onHeartbeat: async (patch) => {
      await touchTaskRuntime(task.id, {
        heartbeatAt: new Date().toISOString(),
        ...patch,
        ...(assignedRhKey ? {
          assignedRhKeyId: assignedRhKey.id,
          assignedRhKeyNoteSnapshot: assignedRhKey.note,
        } : {}),
      });
    },
  });
  return {
    ...result,
    providerId: task.providerId,
  };
}

function isRetryableRunningHubQueueLimitError(error: unknown) {
  const patch = readWorkerTaskResultPatch(error);
  const rawSubmitText = safeText(patch.rhSubmitResponseText);
  const rawFailureReason = safeText(patch.failureReason);
  const message = error instanceof Error ? safeText(error.message) : safeText(error);
  const haystack = `${message}\n${rawFailureReason}\n${rawSubmitText}`.toLowerCase();
  return /(?:^|[^0-9])421(?:[^0-9]|$)/.test(haystack)
    && (
      haystack.includes("api queue limit reached")
      || haystack.includes("api 并发数已达上线")
    );
}

function isRetryablePollGatewayFailure(error: unknown) {
  const status = toOptionalHttpStatus(error);
  if (status === 502 || status === 503 || status === 504) return true;
  const message = error instanceof Error ? error.message : String(error || "");
  return /502|503|504|bad gateway|fetch failed/i.test(message);
}

function buildRunningHubQueueLimitRetryDetail(error: unknown) {
  const patch = readWorkerTaskResultPatch(error);
  const patchFailureReason = safeText(patch.failureReason);
  if (patchFailureReason) return patchFailureReason;
  if (error instanceof Error) {
    const message = safeText(error.message);
    if (message) return message;
  }
  return "RunningHub 上游返回 421，当前平台并发已满，稍后自动重试";
}

function buildRunningHubSubmitFailurePatch(input: {
  submitUrl: string;
  targetType: "app" | "workflow";
  runTargetId: string;
  workflowId: string;
  submitRequestBody: Record<string, unknown>;
  submitResponseStatus: number;
  submitResponseText: string;
}) {
  return {
    rhFailureStage: "submit",
    rhSubmitUrl: input.submitUrl,
    rhSubmitTargetType: input.targetType,
    rhRunTargetId: input.runTargetId,
    rhWorkflowId: input.workflowId,
    rhSubmitRequest: input.submitRequestBody,
    rhSubmitResponseStatus: input.submitResponseStatus,
    rhSubmitResponseText: input.submitResponseText.slice(0, 2000),
  };
}

function extractRunningHubOutputUrls(value: unknown) {
  const urls = collectRunningHubUrls(value);
  const imageUrls = urls.filter((url) => /\.(png|jpe?g|webp|gif|bmp|avif)(\?|$)/i.test(url));
  const videoUrls = urls.filter((url) => /\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(url));
  const audioUrls = urls.filter((url) => /\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(url));
  const uncategorized = urls.filter((url) => !imageUrls.includes(url) && !videoUrls.includes(url) && !audioUrls.includes(url));
  if (videoUrls.length === 0 && imageUrls.length === 0 && audioUrls.length === 0 && uncategorized.length > 0) {
    videoUrls.push(...uncategorized);
  }
  return { imageUrls, videoUrls, audioUrls };
}

function collectRunningHubUrls(value: unknown, seen = new Set<string>()): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    const text = value.trim();
    if (/^https?:\/\//i.test(text)) {
      if (seen.has(text)) return [];
      seen.add(text);
      return [text];
    }
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRunningHubUrls(item, seen));
  }
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    const direct = [row.fileUrl, row.url, row.downloadUrl, row.previewUrl, row.src];
    const directUrls = direct.flatMap((item) => collectRunningHubUrls(item, seen));
    return [
      ...directUrls,
      ...collectRunningHubUrls(row.outputs, seen),
      ...collectRunningHubUrls(row.results, seen),
      ...collectRunningHubUrls(row.files, seen),
      ...collectRunningHubUrls(row.data, seen),
      ...collectRunningHubUrls(row.result, seen),
    ];
  }
  return [];
}

async function executeChatTask(task: TaskRow): Promise<Record<string, unknown>> {
  const protocol = normalizeProtocol(task.providerProtocol);
  if (protocol === "runninghub") {
    return executeRunningHubTask(task);
  }
  if (!task.providerEnabled) throw new Error("Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("Provider 缺少 Base URL");
  if (!task.providerModelId) throw new Error("任务缺少 Provider 模型 ID");
  if (!["openai", "apimart", "modelscope", "custom"].includes(protocol)) {
    throw new Error(`当前 Worker 语言模型 Adapter 暂不支持协议: ${protocol}`);
  }
  const apiKey = decryptSecret(task.apiKeyCipher);
  if (!apiKey) throw new Error("Provider 未配置 API Key 或无法解密");

  const messages = Array.isArray(task.payload.messages)
    ? task.payload.messages
    : safeText(task.payload.prompt)
      ? [{ role: "user", content: safeText(task.payload.prompt) }]
      : [];
  if (messages.length === 0) throw new Error("语言模型任务缺少 messages");

  const payload: Record<string, unknown> = {
    model: task.providerModelId,
    messages,
    stream: false,
  };
  const temperature = Number(task.payload.temperature);
  if (Number.isFinite(temperature)) payload.temperature = Math.max(0, Math.min(2, temperature));
  const maxTokens = Number(task.payload.max_tokens || task.payload.maxTokens);
  if (Number.isFinite(maxTokens) && maxTokens > 0) payload.max_tokens = Math.min(200000, Math.floor(maxTokens));

  const upstream = await fetch(openAiEndpoint(task.providerBaseUrl, "chat/completions"), {
    method: "POST",
    headers: buildProviderJsonHeaders(apiKey),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });
  const text = await upstream.text();
  if (!upstream.ok) throw new Error(`上游语言模型请求失败 ${upstream.status}: ${text.slice(0, 500)}`);
  const raw = text ? JSON.parse(text) : {};
  const content = extractChatContent(raw);
  return {
    adapter: "openai-chat",
    providerId: task.providerId,
    modelId: task.providerModelId,
    content,
    text: content,
    finishReason: plainObject(raw.choices?.[0]).finish_reason || "",
  };
}

async function executeAudioTask(task: TaskRow): Promise<Record<string, unknown>> {
  const protocol = normalizeProtocol(task.providerProtocol);
  if (protocol === "runninghub") {
    return executeRunningHubTask(task);
  }
  if (!task.providerEnabled) throw new Error("Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("Provider 缺少 Base URL");
  if (!task.providerModelId) throw new Error("任务缺少 Provider 模型 ID");
  if (!["openai", "apimart", "modelscope", "custom"].includes(protocol)) {
    throw new Error(`当前 Worker 音频 Adapter 暂不支持协议: ${protocol}`);
  }
  const apiKey = decryptSecret(task.apiKeyCipher);
  if (!apiKey) throw new Error("Provider 未配置 API Key 或无法解密");

  const text = safeText(task.payload.text || task.payload.prompt);
  if (!text) throw new Error("音频任务缺少 text/prompt");
  const payload = createOpenAiAudioChatPayload({
    modelId: task.providerModelId,
    text,
    stylePrompt: safeText(task.payload.stylePrompt),
    voice: safeText(task.payload.voice || "mimo_default"),
    audioFormat: safeText(task.payload.audioFormat || "wav"),
    mode: safeText(task.payload.mode || "tts"),
    sampleDataUrl: safeText(task.payload.sampleDataUrl),
  });
  const submitPath = safeText(task.payload.submitPath, "chat/completions");

  const upstream = await fetch(openAiEndpoint(task.providerBaseUrl, submitPath), {
    method: "POST",
    headers: buildProviderJsonHeaders(apiKey),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });
  const responseText = await upstream.text();
  if (!upstream.ok) throw new Error(`上游音频模型请求失败 ${upstream.status}: ${responseText.slice(0, 500)}`);
  const raw = responseText ? JSON.parse(responseText) : {};
  const result = extractAudioProviderResult(raw);
  const audioUrls = [...result.audioDataUrls, ...result.audioUrls];
  if (audioUrls.length === 0) throw new Error("音频模型未返回可用音频");
  return {
    adapter: "openai-audio",
    providerId: task.providerId,
    modelId: task.providerModelId,
    text: result.text,
    audioUrls,
    remoteAudioUrls: result.audioUrls,
    audioCount: audioUrls.length,
  };
}

async function executeGrsaiImageTask(task: TaskRow): Promise<Record<string, unknown>> {
  const apiKey = decryptSecret(task.apiKeyCipher);
  if (!apiKey) throw new Error("Provider 未配置 API Key 或无法解密");

  const prompt = safeText(task.payload.prompt);
  if (!prompt) throw new Error("图像任务缺少 prompt");

  const client = createGrsaiImageClient({
    apiKey,
    baseUrl: task.providerBaseUrl,
    pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 1500, 500, 30000),
    timeoutMs: clampNumber(task.payload.timeoutMs || task.payload.maxPollMs || task.payload.pollTimeoutMs, 360000, 5000, 1800000),
  });
  const imageUrls = await prepareGrsaiReferenceImages({
    dataDir,
    ownerId: task.ownerId,
    values: Array.isArray(task.payload.images) ? task.payload.images.map((item) => safeText(item)).filter(Boolean) : [],
    limit: 16,
  });
  const result = await client.generate({
    modelId: task.providerModelId,
    prompt,
    aspectRatio: safeText(task.payload.aspectRatio || task.payload.aspect_ratio),
    size: safeText(task.payload.size || task.payload.image_size),
    images: imageUrls,
    submitPath: safeText(task.payload.submitPath),
    pollPath: safeText(task.payload.pollPath || task.payload.pollPathTemplate),
    onHeartbeat: (patch) => touchTaskRuntime(task.id, patch),
  });

  if (result.imageUrls.length === 0) {
    const message = `GRSAI 图像任务未返回可用图片${result.taskId ? `: ${result.taskId}` : ""}`;
    throw createWorkerTaskError(message, buildUpstreamBusinessFailurePatch(message));
  }

  return {
    adapter: "grsai-image",
    providerId: task.providerId,
    modelId: task.providerModelId,
    taskId: result.taskId || "",
    imageUrls: result.imageUrls,
    remoteImageUrls: result.imageUrls.filter((url) => /^https?:\/\//i.test(url)),
    imageCount: result.imageUrls.length,
  };
}

function normalizeProtocol(value: unknown) {
  const protocol = String(value || "").toLowerCase();
  return ["openai", "gemini", "runninghub", "volcengine", "apimart", "modelscope", "custom", "grsai_draw"].includes(protocol) ? protocol : "openai";
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function buildRunningHubDispatchDeps(task: TaskRow, settings: TaskQueueSettings) {
  return {
    redis: redisControl,
    settings,
    task,
    touchTaskRuntime,
    normalizeProtocol,
    safeText,
    decryptSecret,
    runningHubRedisWindowKey,
  };
}

function findAssignedRunningHubKey(pool: RunningHubKeyPoolItem[], assignedRhKeyId: string) {
  if (!assignedRhKeyId) return null;
  return pool.find((item) => item.id === assignedRhKeyId && item.enabled && safeText(item.apiKey)) || null;
}

function runningHubRedisWindowKey(providerId: string, keyId: string) {
  return `xinghuan:provider-window:runninghub:${safeText(providerId, "runninghub")}:${safeText(keyId, "default")}`;
}

function applyImageReferencePayload(requestBody: Record<string, unknown>, imageUrls: string[], isModelScope: boolean) {
  if (imageUrls.length === 0) return;
  requestBody.image = isModelScope && imageUrls.length === 1 ? imageUrls[0] : imageUrls;
  if (!isModelScope) return;
  requestBody.images = imageUrls;
  requestBody.image_url = imageUrls[0];
  requestBody.image_urls = imageUrls;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function decryptSecret(value: string) {
  if (!value) return "";
  if (!value.startsWith("enc:v1:")) return value;
  try {
    const [, , ivRaw, tagRaw, encryptedRaw] = value.split(":");
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivRaw, "base64"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf-8");
  } catch {
    return "";
  }
}

function secretKey() {
  const source =
    process.env.XINGHUAN_SECRET_KEY ||
    process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ||
    (environment === "local" ? "xinghuan-local-admin-secret" : "");
  return createHash("sha256").update(source || "xinghuan-fallback-secret").digest();
}

function logWorkerEvent(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({
    service: "xinghuan-worker",
    environment,
    workerId,
    event,
    ...payload,
  }));
}

function taskTraceContext(task: TaskRow) {
  return {
    requestId: readString(task.result.requestId || task.payload.requestId),
    userId: readString(task.result.userId || task.payload.userId || task.ownerId),
    providerId: task.providerId,
    modelId: task.providerModelId || task.modelRecordId,
  };
}

async function pollApimartVideoTask(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  resultVideoPath: string;
  pollPathTemplate: string;
  finalResultTaskIdPath: string;
  finalResultPathTemplate: string;
  finalResultVideoPath: string;
  pollIntervalMs: number;
  timeoutMs: number;
  onHeartbeat?: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const startedAt = Date.now();
  for (;;) {
    if (Date.now() - startedAt > options.timeoutMs) throw new Error("视频生成轮询超时");
    if (options.pollIntervalMs > 0) await wait(options.pollIntervalMs);
    const pollPath = safeText(options.pollPathTemplate, "tasks/{task_id}").replace("{task_id}", encodeURIComponent(options.taskId));
    const response = await fetch(openAiEndpoint(options.baseUrl, pollPath), {
      method: "GET",
      headers: providerHeaders(options.apiKey),
      signal: AbortSignal.timeout(120000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`视频任务轮询失败 ${response.status}: ${text.slice(0, 500)}`);
    const raw = text ? JSON.parse(text) : {};
    const result = extractApimartVideoResult(raw, {
      statusPath: options.statusPath,
      resultVideoPath: options.resultVideoPath,
    });
    const status = safeText(result.status).toLowerCase();
    await options.onHeartbeat?.({
      heartbeatAt: new Date().toISOString(),
      upstreamTaskId: options.taskId,
      taskId: options.taskId,
      upstreamStatus: status || "pending",
      runtimeStage: "polling",
    });
    if (result.videoUrls.length > 0 && (!status || isCompletedAsyncStatus(status))) return result;
    if (options.finalResultPathTemplate) {
      const finalTaskId = extractApimartFinalTaskId(raw, { taskIdPath: options.finalResultTaskIdPath });
      if (finalTaskId) {
        const finalResult = await fetchFinalApimartVideoResult({
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          taskId: finalTaskId,
          statusPath: options.statusPath,
          resultVideoPath: options.finalResultVideoPath || options.resultVideoPath,
          finalResultPathTemplate: options.finalResultPathTemplate,
        });
        const finalStatus = safeText(finalResult.status).toLowerCase();
        if (finalResult.videoUrls.length > 0 && (!finalStatus || isCompletedAsyncStatus(finalStatus))) return finalResult;
        if (isFailedAsyncStatus(finalStatus)) {
          const failureDetail = safeText(finalResult.failureReason, finalStatus || "unknown");
          throw createWorkerTaskError(`视频任务失败: ${failureDetail}`, buildUpstreamBusinessFailurePatch(failureDetail));
        }
      }
    }
    if (isFailedAsyncStatus(status)) {
      const failureDetail = safeText(result.failureReason, status || "unknown");
      throw createWorkerTaskError(`视频任务失败: ${failureDetail}`, buildUpstreamBusinessFailurePatch(failureDetail));
    }
  }
}

async function fetchFinalApimartVideoResult(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  resultVideoPath: string;
  finalResultPathTemplate: string;
}) {
  const finalPath = safeText(options.finalResultPathTemplate).replace("{task_id}", encodeURIComponent(options.taskId));
  const response = await fetch(openAiEndpoint(options.baseUrl, finalPath), {
    method: "GET",
    headers: providerHeaders(options.apiKey),
    signal: AbortSignal.timeout(120000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`最终视频结果查询失败 ${response.status}: ${text.slice(0, 500)}`);
  const raw = text ? JSON.parse(text) : {};
  return extractApimartVideoResult(raw, {
    statusPath: options.statusPath,
    resultVideoPath: options.resultVideoPath,
  });
}

async function pollApimartImageTask(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  pollIntervalMs: number;
  timeoutMs: number;
  onHeartbeat?: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const startedAt = Date.now();
  let deadline = startedAt + options.timeoutMs;
  const pollPathTemplate = "tasks/{task_id}";
  for (;;) {
    if (Date.now() > deadline) throw new Error("APIMart 图像生成轮询超时");
    if (options.pollIntervalMs > 0) await wait(options.pollIntervalMs);
    const statusPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(options.taskId));
    const response = await fetch(openAiEndpoint(options.baseUrl, statusPath), {
      method: "GET",
      headers: providerHeaders(options.apiKey),
      signal: AbortSignal.timeout(120000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`APIMart 图像轮询失败 ${response.status}: ${text.slice(0, 500)}`);
    const raw = text ? JSON.parse(text) : {};
    const data = raw && typeof raw === "object" && !Array.isArray(raw)
      ? plainObject((raw as Record<string, unknown>).data)
      : {};
    const estimatedTimeSec = Number(data.estimated_time);
    if (Number.isFinite(estimatedTimeSec) && estimatedTimeSec > 0) {
      const adaptiveDeadline = startedAt + Math.min((estimatedTimeSec + 90) * 1000, 600000);
      deadline = Math.max(deadline, adaptiveDeadline);
    }
    const extracted = extractImageOutputs(raw);
    const taskState = extractApimartTask(raw, { statusPath: options.statusPath || "data.status" });
    const status = safeText(taskState.status).toLowerCase();
    await options.onHeartbeat?.({
      heartbeatAt: new Date().toISOString(),
      upstreamTaskId: options.taskId,
      taskId: options.taskId,
      upstreamStatus: status || "pending",
      runtimeStage: "polling",
    });
    if (extracted.imageUrls.length > 0) return extracted;
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw createWorkerTaskError(
        `APIMart 图像任务失败: ${status || "unknown"}`,
        buildUpstreamBusinessFailurePatch(status || "unknown", text),
      );
    }
  }
}

async function pollModelScopeImageTask(options: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  statusPath: string;
  pollPathTemplate: string;
  pollIntervalMs: number;
  timeoutMs: number;
  onHeartbeat?: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const startedAt = Date.now();
  const pollPathTemplate = safeText(options.pollPathTemplate, "tasks/{task_id}");
  for (;;) {
    if (Date.now() - startedAt > options.timeoutMs) throw new Error("ModelScope 图像生成轮询超时");
    if (options.pollIntervalMs > 0) await wait(options.pollIntervalMs);
    const statusPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(options.taskId));
    const response = await fetch(openAiEndpoint(options.baseUrl, statusPath), {
      method: "GET",
      headers: modelScopeHeaders(options.apiKey, "poll"),
      signal: AbortSignal.timeout(120000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`ModelScope 图像轮询失败 ${response.status}: ${text.slice(0, 500)}`);
    const raw = text ? JSON.parse(text) : {};
    const extracted = extractImageOutputs(raw);
    const taskState = extractModelScopeImageTask(raw, { taskStatusPath: options.statusPath });
    const status = safeText(taskState.status).toLowerCase();
    await options.onHeartbeat?.({
      heartbeatAt: new Date().toISOString(),
      upstreamTaskId: options.taskId,
      taskId: options.taskId,
      upstreamStatus: status || "pending",
      runtimeStage: "polling",
    });
    if (extracted.imageUrls.length > 0 && (!status || isCompletedAsyncStatus(status))) return extracted;
    if (isFailedAsyncStatus(status)) {
      throw createWorkerTaskError(
        `ModelScope 图像任务失败: ${status || "unknown"}`,
        buildUpstreamBusinessFailurePatch(status || "unknown", text),
      );
    }
  }
}

function extractModelScopeImageTask(raw: unknown, advancedConfig: Record<string, unknown>) {
  const root = plainObject(raw);
  const data = plainObject(root.data);
  const taskIdPath = safeText(advancedConfig.taskIdPath, "task_id");
  const statusPath = safeText(advancedConfig.taskStatusPath, "task_status");
  return {
    taskId:
      readPathText(root, taskIdPath)
      || safeText(root.task_id)
      || safeText(data.task_id)
      || safeText(root.id),
    status:
      readPathText(root, statusPath)
      || safeText(root.task_status)
      || safeText(data.task_status)
      || safeText(root.status),
  };
}

function isModelScopeImageProvider(protocol: string, baseUrl: string) {
  return protocol === "modelscope" || safeText(baseUrl).toLowerCase().includes("api-inference.modelscope.cn");
}

function modelScopeHeaders(apiKey: string, mode: "submit" | "poll") {
  return {
    ...providerHeaders(apiKey),
    ...(mode === "submit" ? { "X-ModelScope-Async-Mode": "true" } : {}),
    ...(mode === "poll" ? { "X-ModelScope-Task-Type": "image_generation" } : {}),
  };
}

function isCompletedAsyncStatus(status: string) {
  return ["completed", "succeeded", "success", "done", "succeed"].includes(status);
}

function isFailedAsyncStatus(status: string) {
  return ["failed", "failure", "error", "cancelled", "canceled", "fail"].includes(status);
}

function readPathText(value: Record<string, unknown>, path: string) {
  if (!path) return "";
  let current: unknown = value;
  for (const segment of path.split(".").filter(Boolean)) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }
    return "";
  }
  return safeText(current);
}

function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
