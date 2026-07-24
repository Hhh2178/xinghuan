import type { TaskQueueSettings } from "@xinghuan/shared";
import type { RedisClientType } from "redis";

export interface RunningHubKeyPoolItem {
  id: string;
  note: string;
  apiKey?: string;
  apiKeyPreview?: string;
  maxConcurrency: number;
  enabled: boolean;
  isDefault: boolean;
  standardModelApi?: boolean;
  currentInFlight?: number;
}

export interface RunningHubDispatchTaskShape {
  id: string;
  providerId: string;
  providerProtocol: string;
  apiKeyCipher: string;
  rhKeyPool: RunningHubKeyPoolItem[];
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
}

interface RunningHubDispatchDeps {
  redis: RedisClientType;
  settings: TaskQueueSettings;
  task: RunningHubDispatchTaskShape;
  touchTaskRuntime: (taskId: string, resultPatch: Record<string, unknown>) => Promise<void>;
  normalizeProtocol: (value: unknown) => string;
  safeText: (value: unknown, fallback?: string) => string;
  decryptSecret: (value: string) => string;
  runningHubRedisWindowKey: (providerId: string, keyId: string) => string;
}

interface RunningHubSelectionItem extends RunningHubKeyPoolItem {
  note: string;
}

function buildNoAvailableKeyError() {
  const error = new Error("RunningHub 未配置可用 Key") as Error & { resultPatch?: Record<string, unknown> };
  error.name = "WorkerTaskError";
  error.resultPatch = {
    failureCategory: "model_config",
    providerDiagnostic: "RunningHub 未配置可用 Key",
  };
  return error;
}

function buildNoStandardModelKeyError() {
  const message = "RunningHub 标准模型需要企业级-共享 API Key";
  const error = new Error(message) as Error & { resultPatch?: Record<string, unknown> };
  error.name = "WorkerTaskError";
  error.resultPatch = {
    failureCategory: "model_config",
    providerDiagnostic: message,
  };
  return error;
}

export async function acquireRunningHubExecutionWindow(
  deps: RunningHubDispatchDeps,
): Promise<{ acquired: true } | { acquired: false; reason: string }> {
  const { task, settings, touchTaskRuntime } = deps;
  if (deps.normalizeProtocol(task.providerProtocol) !== "runninghub") return { acquired: true };
  if (!settings.runninghub.enabled) return { acquired: true };
  const selectedRhKey = await acquireExecutableRunningHubKey(deps);
  if (!selectedRhKey) {
    return { acquired: false, reason: "RunningHub 所有 Key 并发已满 (all_keys_busy)" };
  }
  try {
    await touchTaskRuntime(task.id, {
      assignedRhKeyId: selectedRhKey.id,
      assignedRhKeyNoteSnapshot: selectedRhKey.note,
      assignedRhKeyMaxConcurrency: selectedRhKey.maxConcurrency,
      rhQueueReason: "",
    });
    task.result = {
      ...task.result,
      assignedRhKeyId: selectedRhKey.id,
      assignedRhKeyNoteSnapshot: selectedRhKey.note,
      assignedRhKeyMaxConcurrency: selectedRhKey.maxConcurrency,
      rhQueueReason: "",
    };
    task.payload = {
      ...task.payload,
      assignedRhKeyId: selectedRhKey.id,
      assignedRhKeyNoteSnapshot: selectedRhKey.note,
      assignedRhKeyMaxConcurrency: selectedRhKey.maxConcurrency,
      rhQueueReason: "",
    };
  } catch (error) {
    await releaseRunningHubExecutionWindow(deps, selectedRhKey.id);
    throw error;
  }
  return { acquired: true };
}

export async function releaseRunningHubExecutionWindow(deps: RunningHubDispatchDeps, explicitKeyId?: string) {
  const { task, redis } = deps;
  if (deps.normalizeProtocol(task.providerProtocol) !== "runninghub") return;
  const assignedRhKeyId = deps.safeText(explicitKeyId || task.payload.assignedRhKeyId || task.result.assignedRhKeyId) || "legacy-default";
  const key = deps.runningHubRedisWindowKey(task.providerId, assignedRhKeyId);
  const current = Number(await redis.get(key).catch(() => "0")) || 0;
  if (current <= 0) return;
  const next = await redis.decr(key).catch(() => current - 1);
  if (Number(next) <= 0) await redis.del(key).catch(() => undefined);
}

export async function selectExecutableRunningHubKey(deps: RunningHubDispatchDeps) {
  const ordered = resolveOrderedRunningHubKeys(deps);
  for (const item of ordered) {
    const limit = Math.max(1, Number(item.maxConcurrency || deps.settings.runninghub.concurrency) || 1);
    const key = deps.runningHubRedisWindowKey(deps.task.providerId, item.id);
    const current = Number(await deps.redis.get(key).catch(() => "0")) || 0;
    if (current < limit) {
      return item;
    }
  }
  return null;
}

async function acquireExecutableRunningHubKey(deps: RunningHubDispatchDeps) {
  const ordered = resolveOrderedRunningHubKeys(deps);
  for (const item of ordered) {
    const assignedRhKeyId = item.id;
    const assignedRhKeyNote = deps.safeText(item.note);
    const limit = Math.max(1, Number(item.maxConcurrency || deps.settings.runninghub.concurrency) || 1);
    const key = deps.runningHubRedisWindowKey(deps.task.providerId, assignedRhKeyId);
    const current = Number(await deps.redis.get(key).catch(() => "0")) || 0;
    if (current >= limit) {
      continue;
    }
    const next = await deps.redis.incr(key);
    if (next === 1) await deps.redis.expire(key, 60 * 60);
    if (next > limit) {
      await deps.redis.decr(key).catch(() => undefined);
      continue;
    }
    return {
      ...item,
      note: assignedRhKeyNote,
    };
  }
  return null;
}

function resolveOrderedRunningHubKeys(deps: RunningHubDispatchDeps): RunningHubSelectionItem[] {
  const { task, settings } = deps;
  const preferredRhKeyId = deps.safeText(task.payload.preferredRhKeyId || task.result.preferredRhKeyId);
  const availablePool = task.rhKeyPool.length > 0
    ? task.rhKeyPool.filter((item) => item.enabled && deps.safeText(item.apiKey))
    : [{
        id: "legacy-default",
        note: "兼容单 Key",
        apiKey: deps.decryptSecret(task.apiKeyCipher) || task.apiKeyCipher,
        apiKeyPreview: "",
        maxConcurrency: Math.max(1, Number(settings.runninghub.concurrency) || 1),
        enabled: true,
        isDefault: true,
        currentInFlight: 0,
      } satisfies RunningHubKeyPoolItem];
  if (availablePool.length === 0) throw buildNoAvailableKeyError();
  const standardModelTask = deps.safeText(task.payload.runningHubExecutionMode) === "standard_model";
  const pool = standardModelTask
    ? availablePool.filter(isRunningHubStandardModelKey)
    : availablePool;
  if (standardModelTask && pool.length === 0) throw buildNoStandardModelKeyError();
  return [
    ...pool.filter((item) => item.id === preferredRhKeyId),
    ...pool.filter((item) => item.id !== preferredRhKeyId && item.isDefault),
    ...pool.filter((item) => item.id !== preferredRhKeyId && !item.isDefault),
  ];
}

function isRunningHubStandardModelKey(item: RunningHubKeyPoolItem) {
  if (typeof item.standardModelApi === "boolean") return item.standardModelApi;
  return /企业级|enterprise/i.test(item.note);
}
