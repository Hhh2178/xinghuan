import {
  TASK_QUEUE_CAPABILITIES,
  buildTaskQueueRuntimeDescriptors,
  createHealthPayload,
  defaultTaskQueueSettings,
  normalizeTaskQueueSettings,
  resolvePostgresPoolConfig,
  taskQueueNameForCapability,
  taskQueueWorkerRuntimeKey,
  type AppEnvironment,
  type TaskQueueRuntimeDescriptor,
  type TaskQueueCapability,
  type TaskQueueWorkerRuntimeSlot,
  type TaskQueueSettings,
} from "@xinghuan/shared";
import { createDecipheriv, createHash } from "node:crypto";
import { join } from "node:path";
import { Pool } from "pg";
import { createClient, type RedisClientType } from "redis";
import { prepareGrsaiReferenceImages, prepareInlineImageReferences } from "./grsai-reference-images.js";
import { attachOutputFetchContext, materializeTaskOutputs } from "./output-materials.js";
import { executeAudioGenerationBatch, type AudioGenerationBatchProgress } from "./worker-audio-generation-batch.js";
import { createGrsaiImageClient } from "./worker-grsai-image-client.js";
import { executeVideoGenerationBatch, type VideoGenerationBatchProgress } from "./worker-video-generation-batch.js";
import {
  createOpenAiAudioChatPayload,
  extractAudioProviderResult,
} from "./worker-audio-provider-adapter.js";
import {
  createApimartVideoAdapterPayload,
  extractApimartTask,
  resolveApimartVideoMultipartFieldNames,
  shouldUseApimartVideoAdapter,
} from "./worker-apimart-video-adapter.js";
import {
  createAicopyVideoAdapterPayload,
  extractAicopyFailureReason,
  extractAicopyTask,
  resolveAicopyRequestContractEnabled,
  shouldUseAicopyVideoAdapter,
} from "@xinghuan/model-core";
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
import { materializeRunningHubNodeInfo } from "./worker-runninghub-media-adapter.js";
import { executeRunningHubStandardModel } from "./worker-runninghub-standard-adapter.js";
import { prepareRunningHubStandardMediaValues } from "./worker-runninghub-standard-media.js";
import { createWorkerCancelSync } from "./worker-cancel-sync.js";
import {
  createWorkerDeferredRequeue,
  shouldRequeueAfterRelease,
} from "./worker-deferred-requeue.js";
import {
  extractModelScopeImageTask,
  modelScopeHeaders,
  pollAicopyVideoTask,
  pollApimartImageTask,
  pollApimartVideoTask,
  pollModelScopeImageTask,
} from "./worker-media-polling.js";
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
import { createWorkerRuntimeEventWriter } from "./worker-runtime-events.js";
import { createWorkerTaskStore, type TaskRow } from "./worker-task-store.js";
import { createWorkerTaskCancellationMonitor } from "./worker-task-cancellation-monitor.js";
import { reapStaleRunningTasks as reapStaleRunningTasksWithRecovery } from "./worker-stale-task-reaper.js";
import {
  buildOutputRecoveryFailurePatch,
  executeOutputRecoveryTask,
} from "./worker-output-recovery.js";
import { resumeProviderVideoOutput } from "./worker-provider-output-resume.js";
import { executeWorkerTaskOperation } from "./worker-task-operation.js";
import { executeImageGenerationBatch, type ImageGenerationBatchProgress } from "./worker-image-generation-batch.js";
import { executeGenerationBatchWithMaterializedProgress } from "./worker-generation-progress-materializer.js";
import { executeGeminiChatTask } from "./worker-gemini-chat-adapter.js";
import { markTaskArtifactsReady, markTaskMaterializing } from "./worker-materialization-stages.js";
import { runWithOperationHeartbeat } from "./worker-operation-heartbeat.js";
import { createCanvasRunCoordinator } from "./canvas-run-coordinator.js";
import { createCanvasRunQualityCoordinator } from "./canvas-run-quality-coordinator.js";

const environment = (process.env.XINGHUAN_APP_ENV ?? "local") as AppEnvironment;
const dataDir = process.env.XINGHUAN_DATA_DIR ?? join(process.cwd(), "data");
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
const expectedDatabaseName = (process.env.XINGHUAN_EXPECTED_DATABASE_NAME || "").trim();
const redisUrl = process.env.XINGHUAN_REDIS_URL || process.env.REDIS_URL || "";
const queueName = process.env.XINGHUAN_TASK_QUEUE || "xinghuan:tasks";
const pollTimeoutSeconds = Number.parseInt(process.env.XINGHUAN_WORKER_POLL_TIMEOUT_SECONDS || "5", 10);
const workerId = process.env.XINGHUAN_WORKER_ID || `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const workerRuntimeKey = taskQueueWorkerRuntimeKey(environment, workerId);
const staleRunningTaskMs = Number.parseInt(process.env.XINGHUAN_WORKER_STALE_RUNNING_MS || `${30 * 60 * 1000}`, 10);
const staleTaskReaperIntervalMs = Number.parseInt(process.env.XINGHUAN_WORKER_REAPER_INTERVAL_MS || "60000", 10);
const taskDeferredRetryMs = Number.parseInt(process.env.XINGHUAN_WORKER_DEFERRED_RETRY_MS || "1500", 10);
const taskQueueRefreshIntervalMs = Number.parseInt(process.env.XINGHUAN_WORKER_QUEUE_REFRESH_INTERVAL_MS || "5000", 10);
const canvasRunWorkerEnabled = process.env.XINGHUAN_CANVAS_RUN_WORKER_ENABLED === "true";

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
  ...resolvePostgresPoolConfig(process.env, {
    serviceEnvPrefix: "XINGHUAN_WORKER",
    defaultMax: 3,
    defaultConnectionTimeoutMillis: 3000,
  }),
});
const redisControl = createClient({ url: redisUrl });
const canvasRunCoordinator = createCanvasRunCoordinator({
  pool,
  redis: redisControl,
  workerId,
  environment,
  queueName,
  dataDir,
  enabled: canvasRunWorkerEnabled,
  pollIntervalMs: Number.parseInt(process.env.XINGHUAN_CANVAS_RUN_POLL_INTERVAL_MS || "1000", 10),
  leaseMs: Number.parseInt(process.env.XINGHUAN_CANVAS_RUN_STEP_LEASE_MS || "30000", 10),
});
const canvasRunQualityCoordinator = createCanvasRunQualityCoordinator({
  pool,
  redis: redisControl,
  workerId,
  environment,
  queueName,
  dataDir,
  enabled: canvasRunWorkerEnabled,
  pollIntervalMs: Number.parseInt(process.env.XINGHUAN_CANVAS_RUN_POLL_INTERVAL_MS || "1000", 10),
});
const {
  claimQueuedTask,
  readTask,
  updateTask,
  appendTaskLog,
  transitionStaleRunningTask,
  touchTaskRuntime,
  touchQueuedTaskRuntime,
  isTaskCancelled,
} = createWorkerTaskStore(pool);
const {
  appendTaskRuntimeEventBestEffort,
} = createWorkerRuntimeEventWriter({ pool });
const workerTaskLifecycle = createWorkerTaskLifecycle({
  workerId,
  appendTaskLog,
  updateTask,
  logWorkerEvent,
  appendTaskRuntimeEventBestEffort,
});
const workerCancelSync = createWorkerCancelSync({
  isTaskCancelled,
  logWorkerEvent,
  dropCancelledAttempt: workerTaskLifecycle.dropCancelledAttempt,
  keepCancelledState: workerTaskLifecycle.keepCancelledState,
});
const workerDeferredRequeue = createWorkerDeferredRequeue({
  workerId,
  queueName,
  redis: redisControl,
  taskDeferredRetryMs,
  wait,
  appendTaskLog,
  touchQueuedTaskRuntime,
  updateTask,
  appendTaskRuntimeEventBestEffort,
});

let currentDatabaseNamePromise: Promise<string> | null = null;

redisControl.on("error", (error) => {
  console.error("xinghuan-worker redis error", error instanceof Error ? error.message : String(error));
});

let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
  canvasRunCoordinator.stop();
  canvasRunQualityCoordinator.stop();
});
process.on("SIGINT", () => {
  stopping = true;
  canvasRunCoordinator.stop();
  canvasRunQualityCoordinator.stop();
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

const transientRuntimeFields = [
  "waitReason",
  "waitDetail",
  "waitUpdatedAt",
  "queueHint",
  "rhQueueReason",
  "upstreamMessage",
];

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
    await redisControl.del(workerRuntimeKey).catch(() => undefined);
    return;
  }
  await redisControl
    .set(workerRuntimeKey, JSON.stringify(runtimeSlots), {
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
  const backgroundLoops = [
    ...(staleRunningTaskMs > 0 && staleTaskReaperIntervalMs > 0 ? [runStaleTaskReaperLoop()] : []),
    ...(canvasRunWorkerEnabled ? [canvasRunCoordinator.run(), canvasRunQualityCoordinator.run()] : []),
  ];
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
  await appendTaskRuntimeEventBestEffort({
    taskId,
    eventType: "task_claim_attempted",
    payload: { workerId },
  });
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
  const queueCapability = TASK_QUEUE_CAPABILITIES.includes(task.capability as TaskQueueCapability)
    ? task.capability as TaskQueueCapability
    : null;
  const capabilitySettings = queueCapability
    ? taskQueueSettings[queueCapability]
    : null;
  const runningHubDispatchDeps = buildRunningHubDispatchDeps(task, taskQueueSettings);
  const userWindow = capabilitySettings ? await acquireUserExecutionWindow(task, capabilitySettings.userConcurrency) : { acquired: true as const };
  if (!userWindow.acquired) {
    await appendTaskRuntimeEventBestEffort({
      taskId,
      eventType: "local_user_window_blocked",
      payload: { reason: userWindow.reason, capability: task.capability },
    });
    await workerDeferredRequeue.deferTaskExecution(task, "waiting_user_window", userWindow.reason);
    return;
  }
  let runningHubWindow: Awaited<ReturnType<typeof acquireRunningHubExecutionWindow>>;
  try {
    runningHubWindow = await acquireRunningHubExecutionWindow(runningHubDispatchDeps);
  } catch (error) {
    await releaseUserExecutionWindow(task);
    await workerTaskLifecycle.failTask({
      task,
      trace,
      error,
      baseResultPatch: buildWorkerFailureWritebackPatch({
        workerId,
        error,
      }),
      replaceResult: normalizeProtocol(task.providerProtocol) === "runninghub",
    });
    return;
  }
  if (!runningHubWindow.acquired) {
    await appendTaskRuntimeEventBestEffort({
      taskId,
      eventType: "provider_window_blocked",
      payload: { reason: runningHubWindow.reason, capability: task.capability },
    });
    await releaseUserExecutionWindow(task);
    await workerDeferredRequeue.deferTaskExecution(task, "waiting_runninghub_window", runningHubWindow.reason);
    return;
  }

  const claimResult = await claimQueuedTask(taskId, `${workerId} 已领取任务`);
  if (claimResult === "cancelled" && await workerCancelSync.handleCancelledClaim({
    taskId,
    capability: task.capability,
    trace,
    claimResult,
    onCancelled: async () => {
      await releaseRunningHubExecutionWindow(runningHubDispatchDeps);
      await releaseUserExecutionWindow(task);
    },
  })) return;
  if (claimResult !== "claimed") {
    await releaseRunningHubExecutionWindow(runningHubDispatchDeps);
    await releaseUserExecutionWindow(task);
    logWorkerEvent("task.skipped", { ...trace, taskId, status: claimResult, message: "claim did not acquire queued task" });
    return;
  }
  logWorkerEvent("task.claimed", { ...trace, taskId, capability: task.capability });
  await appendTaskRuntimeEventBestEffort({
    taskId,
    eventType: "task_claimed",
    payload: { workerId, capability: task.capability },
  });
  await touchTaskRuntime(taskId, {
    workerId,
    startedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
    runtimeStage: "running",
    progress: "45%",
    queueHint: "任务已提交，正在生成",
  });
  const cancellationMonitor = task.capability === "chat" && normalizeProtocol(task.providerProtocol) === "gemini"
    ? createWorkerTaskCancellationMonitor({ taskId, intervalMs: 1_000, isTaskCancelled })
    : null; let requeueAfterRelease = false;
  let executionResult: Record<string, unknown> = {};
  try {
    const result = await executeWorkerTaskOperation({
      task,
      executeProvider: () => executeTask(task, cancellationMonitor?.signal),
      executeOutputRecovery: () => executeOutputRecoveryTask(task, decryptSecret, {
        resumeProviderOutput: (input) => resumeProviderVideoOutput(input, { touchTaskRuntime }),
      }),
    });
    executionResult = result;
    if (await workerCancelSync.dropResultIfCancelled({
      taskId,
      capability: task.capability,
      trace,
    })) {
      return;
    }
    await markTaskMaterializing({ taskId, workerId, capability: task.capability, result, touchTaskRuntime, appendTaskRuntimeEventBestEffort });
    const materialized = await runWithOperationHeartbeat({
      intervalMs: 15_000,
      heartbeat: () => touchTaskRuntime(taskId, {
        heartbeatAt: new Date().toISOString(),
        runtimeStage: "materializing",
        materializationStatus: "downloading",
        queueHint: "服务商已返回，正在稳定拉取并保存生成产物",
      }),
      execute: () => materializeTaskOutputs({ dataDir, task, result }),
    });
    await markTaskArtifactsReady({ taskId, workerId, capability: task.capability, artifactCount: materialized.artifacts.length, appendTaskRuntimeEventBestEffort });
    const completionLogs = materialized.artifacts.length > 0
      ? [`${workerId} 执行完成`, `${workerId} 已登记 ${materialized.artifacts.length} 条生成产物`]
      : [`${workerId} 执行完成`];
    const completionResult = await updateTask(taskId, "succeeded", completionLogs, {
      ...clearTransientRuntimeFields(task.result),
      ...result,
      ...materialized.resultPatch,
      workerId,
      completedAt: new Date().toISOString(),
      runtimeStage: "succeeded",
      providerState: normalizeProtocol(task.providerProtocol) === "runninghub" ? "SUCCESS" : safeText(result.providerState || result.upstreamStatus || "SUCCESS"),
      progress: "100%",
    }, {
      replaceResult: normalizeProtocol(task.providerProtocol) === "runninghub",
    });
    if (await workerCancelSync.keepCompletionCancelledState({
      taskId,
      capability: task.capability,
      trace,
      outcome: completionResult,
    })) {
      return;
    }
    await appendTaskRuntimeEventBestEffort({
      taskId,
      eventType: "task_succeeded",
      payload: { workerId, capability: task.capability },
    });
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
      const queuedResult = await workerDeferredRequeue.requeueRunningTask(task, retryDetail, readWorkerTaskResultPatch(error));
      if (await workerCancelSync.keepRetryCancelledState({
        taskId,
        capability: task.capability,
        trace,
        outcome: queuedResult,
      })) {
        return;
      }
      requeueAfterRelease = shouldRequeueAfterRelease(queuedResult);
      if (requeueAfterRelease) {
        await appendTaskRuntimeEventBestEffort({
          taskId,
          eventType: "provider_queue_limited",
          payload: { detail: retryDetail, capability: task.capability },
        });
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
        baseResultPatch: buildOutputRecoveryFailurePatch(task, executionResult, error),
        ...(normalizeProtocol(task.providerProtocol) === "runninghub" ? clearTransientRuntimeFields(task.result) : {}),
      }),
      replaceResult: normalizeProtocol(task.providerProtocol) === "runninghub",
    });
    return;
  } finally {
    cancellationMonitor?.stop();
    await releaseRunningHubExecutionWindow(runningHubDispatchDeps);
    await releaseUserExecutionWindow(task);
    if (requeueAfterRelease) {
      await workerDeferredRequeue.requeueDeferredTaskAfterRelease(task.id, task.capability);
    }
  }
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
  if (!task.ownerId || !TASK_QUEUE_CAPABILITIES.includes(task.capability as TaskQueueCapability)) return;
  const key = `xinghuan:user-window:${task.capability}:${task.ownerId}`;
  const current = Number(await redisControl.get(key).catch(() => "0")) || 0;
  if (current <= 0) return;
  const next = await redisControl.decr(key).catch(() => current - 1);
  if (Number(next) <= 0) await redisControl.del(key).catch(() => undefined);
}

async function executeTask(task: TaskRow, signal?: AbortSignal): Promise<Record<string, unknown>> {
  if (!task.providerId && !task.modelRecordId) {
    return { adapter: "noop", note: "未绑定 Provider/Model，按后台队列健康检查任务完成" };
  }
  const protocol = normalizeProtocol(task.providerProtocol);
  if (protocol === "runninghub" && runningHubExecutionMode(task) !== "standard_model") return executeRunningHubTask(task);
  if (task.capability === "image") return executeImageTask(task);
  if (task.capability === "video") return executeVideoTask(task);
  if (task.capability === "audio") return executeAudioTask(task);
  if (task.capability === "chat") return executeChatTask(task, signal);
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
  return reapStaleRunningTasksWithRecovery({
    pool,
    workerId,
    staleRunningTaskMs,
    readTask,
    transitionStaleRunningTask,
    requeueTask: workerDeferredRequeue.requeueDeferredTaskAfterRelease,
    logWorkerEvent,
    taskTraceContext,
  });
}
async function executeImageTask(task: TaskRow): Promise<Record<string, unknown>> {
  return executeGenerationBatchWithMaterializedProgress<ImageGenerationBatchProgress, Record<string, unknown>>({
    dataDir, task,
    persist: (patch) => touchTaskRuntime(task.id, patch),
    heartbeat: () => touchTaskRuntime(task.id, {
      heartbeatAt: new Date().toISOString(),
      runtimeStage: "materializing_partial",
      materializationStatus: "downloading",
    }),
    execute: (onProgress) => executeImageGenerationBatch({
      generationCount: task.payload.generationCount ?? task.payload.n,
      maximumConcurrency: task.payload.generationConcurrency,
      execute: (_batchIndex, remaining) => executeSingleImageTask(task, remaining),
      isCancelled: () => isTaskCancelled(task.id),
      onProgress,
    }),
    runtimePatch: (batch) => ({
      heartbeatAt: new Date().toISOString(),
      runtimeStage: "generating_batch",
      progress: `${batch.completed}/${batch.total}`,
      generationCount: batch.total,
      completedGenerationCount: batch.completed,
      providerRequestCount: batch.providerRequestCount,
      upstreamTaskIds: batch.taskIds,
      imageUrls: batch.imageUrls,
      remoteImageUrls: batch.remoteImageUrls,
      generationBatch: batch.generationBatch,
    }),
  });
}
async function executeSingleImageTask(task: TaskRow, requestedImageCount: number): Promise<Record<string, unknown>> {
  const protocol = normalizeProtocol(task.providerProtocol);
  if (protocol === "runninghub") {
    return runningHubExecutionMode(task) === "standard_model"
      ? executeRunningHubStandardTask(task, "image")
      : executeRunningHubTask(task);
  }
  if (!task.providerEnabled) throw new Error("Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("Provider 缺少 Base URL");
  if (!task.providerModelId) throw new Error("任务缺少 Provider 模型 ID");
  if (protocol === "grsai_draw") {
    return executeGrsaiImageTask(task);
  }
  if (!["openai", "apimart", "aicopy", "modelscope", "custom"].includes(protocol)) {
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
    n: clampNumber(requestedImageCount, 1, 1, 4),
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
          timeoutMs: clampOptionalNumber(task.payload.timeoutMs || task.payload.maxPollMs || task.payload.pollTimeoutMs, 5000, 1800000),
          onHeartbeat: (patch) => touchTaskRuntime(task.id, patch),
        })
      : await pollApimartImageTask({
          baseUrl: task.providerBaseUrl,
          apiKey,
          taskId: taskMeta.taskId,
          statusPath: safeText(task.payload.pollStatusPath, "data.status"),
          pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 2500, 500, 30000),
          timeoutMs: clampOptionalNumber(task.payload.timeoutMs || task.payload.maxPollMs, 5000, 1800000),
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
  return executeGenerationBatchWithMaterializedProgress<VideoGenerationBatchProgress, Record<string, unknown>>({
    dataDir, task,
    persist: (patch) => touchTaskRuntime(task.id, patch),
    heartbeat: () => touchTaskRuntime(task.id, {
      heartbeatAt: new Date().toISOString(),
      runtimeStage: "materializing_partial",
      materializationStatus: "downloading",
    }),
    execute: (onProgress) => executeVideoGenerationBatch({
      generationCount: task.payload.generationCount ?? task.payload.n,
      maximumConcurrency: task.payload.generationConcurrency,
      execute: () => executeSingleVideoTask(task),
      isCancelled: () => isTaskCancelled(task.id),
      onProgress,
    }),
    runtimePatch: (batch) => ({
      heartbeatAt: new Date().toISOString(),
      runtimeStage: "batch_generating",
      progress: `${Math.round((batch.completed / batch.total) * 100)}%`,
      generationCount: batch.total,
      completedGenerationCount: batch.completed,
      providerRequestCount: batch.providerRequestCount,
      upstreamTaskIds: batch.taskIds,
      videoUrls: batch.videoUrls,
      remoteVideoUrls: batch.remoteVideoUrls,
      generationBatch: batch.generationBatch,
    }),
  });
}

async function executeSingleVideoTask(task: TaskRow): Promise<Record<string, unknown>> {
  const protocol = normalizeProtocol(task.providerProtocol);
  if (protocol === "runninghub") {
    return runningHubExecutionMode(task) === "standard_model"
      ? executeRunningHubStandardTask(task, "video")
      : executeRunningHubTask(task);
  }
  if (!task.providerEnabled) throw new Error("Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("Provider 缺少 Base URL");
  if (!task.providerModelId) throw new Error("任务缺少 Provider 模型 ID");
  if (!["openai", "apimart", "aicopy", "modelscope", "custom"].includes(protocol)) {
    throw new Error(`当前 Worker 视频 Adapter 暂不支持协议: ${protocol}`);
  }
  const apiKey = decryptSecret(task.apiKeyCipher);
  if (!apiKey) throw new Error("Provider 未配置 API Key 或无法解密");

  const prompt = safeText(task.payload.prompt);
  if (!prompt) throw new Error("视频任务缺少 prompt");
  const images = Array.isArray(task.payload.images) ? task.payload.images.map((item) => safeText(item)).filter(Boolean).slice(0, 16) : [];
  const videos = Array.isArray(task.payload.videos) ? task.payload.videos.map((item) => safeText(item)).filter(Boolean).slice(0, 8) : [];
  const audioPayload = Array.isArray(task.payload.audios) ? task.payload.audios : task.payload.audioUrls;
  const audios = Array.isArray(audioPayload) ? audioPayload.map((item) => safeText(item)).filter(Boolean).slice(0, 3) : [];
  const ratio = safeText(task.payload.aspectRatio || task.payload.aspect_ratio || task.payload.ratio);
  const duration = task.payload.duration;
  const resolution = safeText(task.payload.resolution);
  const firstFrame = safeText(task.payload.first_frame || task.payload.firstFrame);
  const lastFrame = safeText(task.payload.last_frame || task.payload.lastFrame);
  const queuedModeType = safeText(task.payload.modeType);
  const modeType = ["text2video", "image2video", "frames2video"].includes(queuedModeType)
    ? queuedModeType
    : images.length === 0
      ? "text2video"
      : firstFrame && lastFrame
        ? "frames2video"
        : "image2video";
  const advancedMode = safeText(task.payload.advancedMode || task.payload.mode);
  const submitPath = safeText(task.payload.submitPath, "videos/generations");
  const requestContractEnabled = resolveAicopyRequestContractEnabled(task.payload);
  const requestContract = plainObject(task.payload.requestContract);
  const inlineReferenceImages = safeText(task.payload.referenceImageTransport).toLowerCase() === "data_url";
  const requestImages = inlineReferenceImages
    ? await prepareInlineImageReferences({
        dataDir,
        ownerId: task.ownerId,
      values: images,
      limit: images.length,
      processing: task.payload.referenceImageProcessing,
    })
    : images;
  const firstFrameIndex = firstFrame ? images.indexOf(firstFrame) : -1;
  const lastFrameIndex = lastFrame ? images.indexOf(lastFrame) : -1;
  if (inlineReferenceImages && firstFrame && firstFrameIndex < 0) throw new Error("首帧不在已验证的参考图序列中");
  if (inlineReferenceImages && lastFrame && lastFrameIndex < 0) throw new Error("尾帧不在已验证的参考图序列中");
  const requestFirstFrame = firstFrame ? requestImages[firstFrameIndex] || firstFrame : "";
  const requestLastFrame = lastFrame ? requestImages[lastFrameIndex] || lastFrame : "";

  if (shouldUseAicopyVideoAdapter({
    protocol,
    advancedMode,
    modelId: task.providerModelId,
    providerBaseUrl: task.providerBaseUrl,
  })) {
    const submitPayload = createAicopyVideoAdapterPayload({
      modelId: task.providerModelId,
      prompt,
      ratio,
      duration: typeof duration === "string" || typeof duration === "number" ? duration : undefined,
      resolution,
      modeType,
      videoInputMode: safeText(task.payload.videoInputMode),
      images: requestImages,
      videos,
      audios,
      requestMapping: plainObject(task.payload.requestMapping) as Record<string, string>,
      requestValueTypes: plainObject(task.payload.requestValueTypes) as Record<string, string>,
      requestValueTemplates: plainObject(task.payload.requestValueTemplates) as Record<string, string>,
      requestContractEnabled,
      requestContract,
      fixedBody: plainObject(task.payload.fixedBody),
    });
    const requestMetadata = plainObject(submitPayload.metadata);
    const requestVideoConfig = plainObject(submitPayload.video_config);
    const submittedImages = Array.isArray(submitPayload.reference_images)
      ? submitPayload.reference_images
      : Array.isArray(submitPayload.images)
        ? submitPayload.images
        : [];
    const submittedMedia = plainObject(submitPayload.input).media;
    const providerRequestSummary = {
      adapter: "aicopy-video",
      modelId: task.providerModelId,
      duration: submitPayload.duration ?? submitPayload.video_length,
      ratio: safeText(requestMetadata.ratio || submitPayload.aspect_ratio || requestVideoConfig.aspect_ratio),
      modeType: safeText(requestMetadata.modeType),
      soundEnabled: safeText(requestMetadata.enableSound).toLowerCase() === "on",
      imageCount: submittedImages.length,
      referenceImagePayloadChars: submittedImages.reduce((total, image) => total + safeText(image).length, 0),
      referenceImageTransport: inlineReferenceImages ? "data_url" : "url",
      referenceImageProcessing: inlineReferenceImages ? plainObject(task.payload.referenceImageProcessing) : {},
      audioCount: Array.isArray(submitPayload.audios) ? submitPayload.audios.length : 0,
      videoCount: Array.isArray(submitPayload.videos) ? submitPayload.videos.length : videos.length,
      mediaCount: Array.isArray(submittedMedia) ? submittedMedia.length : 0,
      requestContractEnabled,
    };
    await touchTaskRuntime(task.id, {
      providerRequestSummary,
      submitDiagnostic: `AICopy request mode=${providerRequestSummary.modeType || "unknown"} ratio=${providerRequestSummary.ratio || "unknown"} duration=${String(providerRequestSummary.duration ?? "unknown")} images=${providerRequestSummary.imageCount} videos=${providerRequestSummary.videoCount} audios=${providerRequestSummary.audioCount} media=${providerRequestSummary.mediaCount} sound=${providerRequestSummary.soundEnabled ? "on" : "off"}`,
    });
    const upstream = await fetch(openAiEndpoint(task.providerBaseUrl, safeText(task.payload.submitPath, "videos")), {
      method: "POST",
      headers: buildProviderJsonHeaders(apiKey),
      body: JSON.stringify(submitPayload),
      signal: AbortSignal.timeout(180000),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      let reason = text.slice(0, 500);
      try { reason = extractAicopyFailureReason(JSON.parse(text)) || reason; } catch { /* preserve raw response */ }
      throw new Error(`上游视频生成失败 ${upstream.status}: ${reason.slice(0, 500)}`);
    }
    const raw = text ? JSON.parse(text) : {};
    const taskMeta = extractAicopyTask(raw, {
      taskIdPath: safeText(task.payload.taskIdPath, "task_id"),
      statusPath: safeText(task.payload.taskStatusPath, "status"),
    });
    if (!taskMeta.taskId) throw new Error("异步视频任务未返回 task_id/id");
    await touchTaskRuntime(task.id, {
      heartbeatAt: new Date().toISOString(),
      upstreamTaskId: taskMeta.taskId,
      taskId: taskMeta.taskId,
      upstreamStatus: safeText(taskMeta.status || "submitted"),
      runtimeStage: "polling",
    });
    const polled = await pollAicopyVideoTask({
      baseUrl: task.providerBaseUrl,
      apiKey,
      taskId: taskMeta.taskId,
      statusPath: safeText(task.payload.taskStatusPath, "status"),
      resultVideoPath: safeText(task.payload.resultVideoPath, "data.output"),
      resultPaths: requestContractEnabled
        ? Array.isArray(requestContract.resultPaths)
          ? requestContract.resultPaths as string[]
          : undefined
        : undefined,
      pollPathTemplate: safeText(task.payload.pollPathTemplate, "videos/{task_id}"),
      contentPathTemplate: safeText(task.payload.contentPathTemplate, "videos/{task_id}/content"),
      pollIntervalMs: clampNumber(task.payload.pollIntervalMs, 2000, 500, 10000),
      timeoutMs: clampOptionalNumber(task.payload.timeoutMs || task.payload.maxPollMs, 5000, 1800000),
      onHeartbeat: (patch) => touchTaskRuntime(task.id, patch),
    });
    if (polled.videoUrls.length === 0) throw new Error("异步视频任务未返回可用视频 URL");
    return attachOutputFetchContext({
      adapter: "aicopy-video",
      providerId: task.providerId,
      modelId: task.providerModelId,
      taskId: taskMeta.taskId,
      videoUrls: polled.videoUrls,
      remoteVideoUrls: polled.videoUrls,
      videoCount: polled.videoUrls.length,
      providerRequestSummary,
      providerState: safeText(polled.status || "completed"),
    }, {
      origin: task.providerBaseUrl,
      headers: providerHeaders(apiKey),
    });
  }

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
      images: requestImages,
      firstFrame: requestFirstFrame || undefined,
      lastFrame: requestLastFrame || undefined,
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
      timeoutMs: clampOptionalNumber(task.payload.timeoutMs || task.payload.maxPollMs, 5000, 1800000),
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
  if (requestImages.length > 0) payload.image = requestImages;
  if (requestFirstFrame) payload.first_frame = requestFirstFrame;
  if (requestLastFrame) payload.last_frame = requestLastFrame;

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
  const rawNodeInfoList = Array.isArray(task.payload.nodeInfoList)
    ? task.payload.nodeInfoList
        .map((item) => (item && typeof item === "object" ? plainObject(item) : {}))
        .filter((item) => safeText(item.nodeId) && safeText(item.fieldName))
        .map((item) => ({
          nodeId: safeText(item.nodeId),
          fieldName: safeText(item.fieldName),
          fieldValue: item.fieldValue,
        }))
    : [];
  const nodeInfoList = await materializeRunningHubNodeInfo({
    dataDir,
    ownerId: task.ownerId,
    baseUrl: task.providerBaseUrl,
    apiKey,
    nodeInfoList: rawNodeInfoList,
  });
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
    pollIntervalMs: resolveRunningHubPollIntervalMs(task),
    timeoutMs: resolveRunningHubPollTimeoutMs(task),
    onHeartbeat: async (patch) => {
      await touchTaskRuntime(task.id, {
        heartbeatAt: new Date().toISOString(),
        ...patch,
        ...(assignedRhKey ? {
          assignedRhKeyId: assignedRhKey.id,
          assignedRhKeyNoteSnapshot: assignedRhKey.note,
          assignedRhKeyMaxConcurrency: assignedRhKey.maxConcurrency,
        } : {}),
      });
    },
  });
  return {
    ...result,
    providerId: task.providerId,
  };
}

async function executeRunningHubStandardTask(task: TaskRow, capability: "image" | "video"): Promise<Record<string, unknown>> {
  if (!task.providerEnabled) throw new Error("RunningHub Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("RunningHub 模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("RunningHub Provider 缺少 Base URL");
  const modelPath = safeText(task.payload.runningHubModelPath || task.providerModelId);
  if (!modelPath) throw new Error("RunningHub 标准模型缺少模型路径");
  const assignedRhKeyId = safeText(
    task.payload.assignedRhKeyId
      || task.result.assignedRhKeyId
      || task.payload.preferredRhKeyId
      || task.result.preferredRhKeyId,
  );
  const assignedRhKey = findAssignedRunningHubKey(task.rhKeyPool, assignedRhKeyId);
  const apiKey = decryptSecret(assignedRhKey?.apiKey || task.apiKeyCipher);
  if (!apiKey) throw new Error("RunningHub Provider 未配置 API Key 或无法解密");

  const body = await buildRunningHubStandardRequestBody(task, apiKey);
  const result = await executeRunningHubStandardModel({
    capability,
    baseUrl: task.providerBaseUrl,
    apiKey,
    modelPath,
    body,
    onHeartbeat: async (patch) => {
      await touchTaskRuntime(task.id, {
        heartbeatAt: new Date().toISOString(),
        ...patch,
        ...(assignedRhKey ? {
          assignedRhKeyId: assignedRhKey.id,
          assignedRhKeyNoteSnapshot: assignedRhKey.note,
          assignedRhKeyMaxConcurrency: assignedRhKey.maxConcurrency,
        } : {}),
      });
    },
  });
  return { ...result, providerId: task.providerId, modelId: task.providerModelId };
}

async function buildRunningHubStandardRequestBody(task: TaskRow, apiKey: string) {
  const body: Record<string, unknown> = { ...plainObject(task.payload.fixedBody) };
  const excluded = new Set([
    "assignedRhKeyId", "preferredRhKeyId", "runningHubExecutionMode", "runningHubModelPath",
    "taskCapability", "executionMode", "sourceNodeId", "sourceCanvasId", "requestId", "userId",
    "generationCount", "n", "images", "imageUrls", "videos", "videoUrls", "audios", "audioUrls",
    "first_frame", "last_frame", "firstFrame", "lastFrame", "fixedBody", "requestMapping",
    "requestContract", "requestContractEnabled", "aicopyRequestContractEnabled", "referenceImageTransport",
    "videoInputMode", "modeType", "advancedMode", "webappId", "workflowId", "runTargetId", "targetType",
    "nodeInfoList", "rhCatalogId", "pollIntervalMs", "pollTimeoutMs", "timeoutMs", "maxPollMs",
  ]);
  for (const [key, value] of Object.entries(task.payload)) {
    if (!excluded.has(key) && value !== undefined && value !== null && value !== "") body[key] = value;
  }

  const imageValues = stringList(task.payload.imageUrls).length
    ? stringList(task.payload.imageUrls)
    : stringList(task.payload.images);
  const preparedImages = await prepareRunningHubStandardMediaValues({
    dataDir,
    ownerId: task.ownerId,
    baseUrl: task.providerBaseUrl,
    apiKey,
    values: imageValues,
  });
  if (preparedImages.length) body.imageUrls = preparedImages;

  const firstFrame = safeText(task.payload.firstFrame || task.payload.first_frame);
  const lastFrame = safeText(task.payload.lastFrame || task.payload.last_frame);
  if (firstFrame) body.firstFrame = preparedImages[imageValues.indexOf(firstFrame)] || (await prepareRunningHubStandardMediaValues({
    dataDir, ownerId: task.ownerId, baseUrl: task.providerBaseUrl, apiKey, values: [firstFrame],
  }))[0];
  if (lastFrame) body.lastFrame = preparedImages[imageValues.indexOf(lastFrame)] || (await prepareRunningHubStandardMediaValues({
    dataDir, ownerId: task.ownerId, baseUrl: task.providerBaseUrl, apiKey, values: [lastFrame],
  }))[0];

  const videoValues = stringList(task.payload.videoUrls).length
    ? stringList(task.payload.videoUrls)
    : stringList(task.payload.videos);
  if (videoValues.length) body.videoUrls = await prepareRunningHubStandardMediaValues({
    dataDir, ownerId: task.ownerId, baseUrl: task.providerBaseUrl, apiKey, values: videoValues,
  });
  const audioValues = stringList(task.payload.audioUrls).length
    ? stringList(task.payload.audioUrls)
    : stringList(task.payload.audios);
  if (audioValues.length) body.audioUrls = await prepareRunningHubStandardMediaValues({
    dataDir, ownerId: task.ownerId, baseUrl: task.providerBaseUrl, apiKey, values: audioValues,
  });

  const aspectRatio = safeText(task.payload.aspectRatio || task.payload.aspect_ratio || task.payload.ratio);
  if (aspectRatio && body.aspectRatio === undefined) body.aspectRatio = aspectRatio;
  return body;
}

function runningHubExecutionMode(task: TaskRow) {
  return safeText(task.payload.runningHubExecutionMode) === "standard_model" ? "standard_model" : "catalog_target";
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => safeText(item)).filter(Boolean) : [];
}

function resolveRunningHubPollIntervalMs(task: TaskRow) {
  const executionRules = plainObject(task.payload.executionRules);
  return clampNumber(
    task.payload.pollIntervalMs
      || executionRules.pollingIntervalMs,
    5000,
    500,
    30000,
  );
}

function resolveRunningHubPollTimeoutMs(task: TaskRow) {
  const executionRules = plainObject(task.payload.executionRules);
  const explicitTimeoutMs = task.payload.timeoutMs
    || task.payload.maxPollMs
    || task.payload.pollTimeoutMs
    || executionRules.pollingTimeoutMs;
  return clampOptionalNumber(explicitTimeoutMs, 5000, 24 * 60 * 60 * 1000);
}

function clearTransientRuntimeFields(result: Record<string, unknown>) {
  const next = { ...plainObject(result) };
  for (const field of transientRuntimeFields) {
    delete next[field];
  }
  return next;
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

async function executeChatTask(task: TaskRow, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const protocol = normalizeProtocol(task.providerProtocol);
  if (protocol === "runninghub") {
    return executeRunningHubTask(task);
  }
  if (!task.providerEnabled) throw new Error("Provider 不存在或未启用");
  if (!task.modelEnabled) throw new Error("模型不存在或未启用");
  if (!task.providerBaseUrl) throw new Error("Provider 缺少 Base URL");
  if (!task.providerModelId) throw new Error("任务缺少 Provider 模型 ID");
  if (!["openai", "gemini", "apimart", "modelscope", "custom", "aicopy"].includes(protocol)) {
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

  if (protocol === "gemini") {
    const nativeVideo = plainObject(task.payload.nativeVideo);
    const result = await executeGeminiChatTask({
      dataDir,
      ownerId: task.ownerId,
      baseUrl: task.providerBaseUrl,
      apiKey,
      modelId: task.providerModelId,
      messages,
      nativeVideo: safeText(nativeVideo.fileUrl) ? {
        fileUrl: safeText(nativeVideo.fileUrl),
        mimeType: safeText(nativeVideo.mimeType),
      } : undefined,
      temperature: Number(task.payload.temperature),
      maxTokens: Number(task.payload.max_tokens || task.payload.maxTokens),
      signal,
    });
    return { ...result, providerId: task.providerId, modelId: task.providerModelId };
  }

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
  return executeGenerationBatchWithMaterializedProgress<AudioGenerationBatchProgress, Record<string, unknown>>({
    dataDir, task,
    persist: (patch) => touchTaskRuntime(task.id, patch),
    execute: (onProgress) => executeAudioGenerationBatch({
      generationCount: task.payload.generationCount ?? task.payload.n,
      maximumConcurrency: task.payload.generationConcurrency,
      execute: () => executeSingleAudioTask(task),
      isCancelled: () => isTaskCancelled(task.id),
      onProgress,
    }),
    runtimePatch: (batch) => ({
      heartbeatAt: new Date().toISOString(),
      runtimeStage: "batch_generating",
      progress: `${Math.round((batch.completed / batch.total) * 100)}%`,
      generationCount: batch.total,
      completedGenerationCount: batch.completed,
      providerRequestCount: batch.providerRequestCount,
      upstreamTaskIds: batch.taskIds,
      audioUrls: batch.audioUrls,
      remoteAudioUrls: batch.remoteAudioUrls,
      generationBatch: batch.generationBatch,
    }),
  });
}

async function executeSingleAudioTask(task: TaskRow): Promise<Record<string, unknown>> {
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
    timeoutMs: clampOptionalNumber(task.payload.timeoutMs || task.payload.maxPollMs || task.payload.pollTimeoutMs, 5000, 1800000),
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
  return ["openai", "gemini", "runninghub", "volcengine", "apimart", "aicopy", "modelscope", "custom", "grsai_draw"].includes(protocol) ? protocol : "openai";
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

function clampOptionalNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : undefined;
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

function isModelScopeImageProvider(protocol: string, baseUrl: string) {
  return protocol === "modelscope" || safeText(baseUrl).toLowerCase().includes("api-inference.modelscope.cn");
}

function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
