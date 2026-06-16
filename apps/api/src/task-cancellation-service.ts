import { canCancelTask } from "@xinghuan/shared";
import { taskCancellationPatch } from "./task-lifecycle.js";

interface CurrentUserLike {
  id: string;
  email: string;
  role: "admin" | "member";
}

interface TaskRecordLike {
  id: string;
  title: string;
  status: string;
  ownerId?: string;
  providerId?: string;
  modelId?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  logs: string[];
  createdAt?: number;
  updatedAt: number;
}

interface ProviderLike {
  id: string;
  name: string;
  baseUrl: string;
  protocol?: unknown;
  apiKey?: string;
  enabled?: boolean;
}

interface ModelLike {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  protocolOverride?: string;
  advancedConfig?: Record<string, unknown>;
}

interface AdminDbLike {
  providers: ProviderLike[];
  models: ModelLike[];
}

type CancelScope = "local_only" | "upstream_confirmed" | "upstream_attempt_failed";

interface CancelOutcome {
  attempted: boolean;
  supported: boolean;
  confirmed: boolean;
  cancelScope: CancelScope;
  message: string;
  statusCode?: number;
  upstreamTaskId: string;
  error?: string;
}

interface TaskCancellationServiceDependencies<TTask extends TaskRecordLike = TaskRecordLike> {
  readTaskRecord: (taskId: string) => Promise<TTask | null>;
  writeTaskRecord: (task: TTask) => Promise<void>;
  readAdminDb: () => Promise<AdminDbLike>;
  providerPlainApiKey: (provider: ProviderLike) => string;
  normalizeProviderProtocol: (value: unknown) => string;
  safeText: (value: unknown, fallback?: string) => string;
  plainObject: (value: unknown) => Record<string, unknown>;
  now?: () => number;
}

export function createTaskCancellationService<TTask extends TaskRecordLike = TaskRecordLike>(
  deps: TaskCancellationServiceDependencies<TTask>,
) {
  async function cancelTaskWithStrategy(taskId: string, actor: CurrentUserLike) {
    const task = await deps.readTaskRecord(taskId);
    if (!task) return null;
    if (task.ownerId && actor.role !== "admin" && task.ownerId !== actor.id) {
      throw new Error("无权取消该任务");
    }
    if (!canCancelTask(normalizeTaskStatus(task.status))) {
      throw new Error(`任务当前状态为 ${task.status}，不可取消`);
    }

    const adminDb = await deps.readAdminDb();
    const provider = adminDb.providers.find((item) => item.id === task.providerId);
    const model = adminDb.models.find((item) => item.id === task.modelId);
    const cancelOutcome = await attemptUpstreamCancellation(task, provider, model);
    const now = deps.now ? deps.now() : Date.now();
    const patch = taskCancellationPatch(actor.email, now);
    const nextTask = {
      ...task,
      status: "cancelled",
      result: {
        ...deps.plainObject(task.result),
        ...patch.result,
        cancelScope: cancelOutcome.cancelScope,
        upstreamSupported: cancelOutcome.supported,
        upstreamAttempted: cancelOutcome.attempted,
        upstreamCancelled: cancelOutcome.confirmed,
        upstreamCancelledAt: cancelOutcome.confirmed ? new Date(now).toISOString() : deps.safeText(task.result?.["upstreamCancelledAt"]),
        upstreamCancelStatusCode: cancelOutcome.statusCode,
        upstreamCancelError: cancelOutcome.error || "",
        upstreamTaskId: cancelOutcome.upstreamTaskId,
        cancellationMessage: cancelOutcome.message,
      },
      logs: [
        ...safeLogLines(task.logs),
        ...patch.logs,
        cancelOutcome.message,
      ],
      updatedAt: now,
    } as TTask;
    await deps.writeTaskRecord(nextTask);
    return {
      cancelled: true,
      upstream: cancelOutcome.confirmed,
      cancelScope: cancelOutcome.cancelScope,
      upstreamSupported: cancelOutcome.supported,
      upstreamAttempted: cancelOutcome.attempted,
      message: cancelOutcome.message,
      task: nextTask,
    };
  }

  async function attemptUpstreamCancellation(
    task: TTask,
    provider: ProviderLike | undefined,
    model: ModelLike | undefined,
  ): Promise<CancelOutcome> {
    const payload = deps.plainObject(task.payload);
    const result = deps.plainObject(task.result);
    const modelAdvancedConfig = deps.plainObject(model?.advancedConfig);
    const mergedConfig = {
      ...modelAdvancedConfig,
      ...payload,
    };
    const upstreamTaskId = deps.safeText(
      result.upstreamTaskId || result.taskId || payload.upstreamTaskId || payload.taskId || payload.requestId,
    );
    const cancelPathTemplate = deps.safeText(
      mergedConfig.cancelPathTemplate || mergedConfig.cancelPath || mergedConfig.cancelUrlTemplate,
    );
    if (!provider?.baseUrl || !provider?.id || !model || !upstreamTaskId || !cancelPathTemplate) {
      return {
        attempted: false,
        supported: false,
        confirmed: false,
        cancelScope: "local_only",
        upstreamTaskId,
        message: upstreamTaskId
          ? "已取消本地任务；当前模型未配置可确认的上游取消接口。"
          : "已取消本地任务；当前任务尚未登记可用的上游任务 ID。",
      };
    }

    const apiKey = deps.providerPlainApiKey(provider);
    if (!apiKey) {
      return {
        attempted: false,
        supported: false,
        confirmed: false,
        cancelScope: "local_only",
        upstreamTaskId,
        message: "已取消本地任务；当前 Provider 未配置可用于上游取消的 API Key。",
      };
    }

    const protocol = deps.normalizeProviderProtocol(model.protocolOverride || provider.protocol);
    const method = deps.safeText(mergedConfig.cancelMethod, "POST").toUpperCase();
    const targetPath = interpolateString(cancelPathTemplate, upstreamTaskId);
    const targetUrl = toAbsoluteUrl(provider.baseUrl, targetPath);
    const extraHeaders = plainStringMap(mergedConfig.cancelHeaders);
    const defaultBody = {
      task_id: upstreamTaskId,
      taskId: upstreamTaskId,
      id: upstreamTaskId,
    };
    const resolvedBody = resolveCancelBody(mergedConfig.cancelBodyTemplate ?? mergedConfig.cancelBody, upstreamTaskId, defaultBody);
    const hasBody = !["GET", "HEAD"].includes(method) && resolvedBody !== undefined;
    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    };
    if (protocol === "modelscope") {
      headers.authorization = `Bearer ${apiKey}`;
    }
    if (hasBody && !headers["content-type"]) {
      headers["content-type"] = typeof resolvedBody === "string" ? "text/plain;charset=UTF-8" : "application/json";
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? (typeof resolvedBody === "string" ? resolvedBody : JSON.stringify(resolvedBody)) : undefined,
      signal: AbortSignal.timeout(120000),
    });
    const responseText = await response.text();
    if (!response.ok) {
      return {
        attempted: true,
        supported: true,
        confirmed: false,
        cancelScope: "upstream_attempt_failed",
        upstreamTaskId,
        statusCode: response.status,
        error: responseText.slice(0, 400) || `HTTP ${response.status}`,
        message: `已取消本地任务；已尝试通知上游取消，但上游返回 ${response.status}。`,
      };
    }
    return {
      attempted: true,
      supported: true,
      confirmed: true,
      cancelScope: "upstream_confirmed",
      upstreamTaskId,
      statusCode: response.status,
      message: "已取消本地任务，并已确认向上游发出取消请求。",
    };
  }

  return {
    cancelTaskWithStrategy,
  };
}

function normalizeTaskStatus(value: unknown): "queued" | "running" | "succeeded" | "failed" | "cancelled" {
  const status = String(value || "");
  return ["queued", "running", "succeeded", "failed", "cancelled"].includes(status)
    ? (status as "queued" | "running" | "succeeded" | "failed" | "cancelled")
    : "queued";
}

function safeLogLines(value: unknown) {
  return Array.isArray(value) ? value.map((line) => String(line ?? "").trim()).filter(Boolean) : [];
}

function plainStringMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const map = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(map)
      .map(([key, item]) => [String(key).trim().toLowerCase(), String(item ?? "").trim()])
      .filter(([key, item]) => key && item),
  );
}

function toAbsoluteUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/, "")}/${String(path || "").replace(/^\/+/, "")}`;
}

function interpolateString(template: string, taskId: string) {
  return String(template || "").replaceAll("{task_id}", encodeURIComponent(taskId)).replaceAll("{taskId}", encodeURIComponent(taskId));
}

function resolveCancelBody(value: unknown, taskId: string, fallback: Record<string, unknown>) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string") {
    const trimmed = interpolateString(value, taskId);
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepReplaceTaskId(item, taskId));
  }
  if (typeof value === "object") {
    return deepReplaceTaskId(value, taskId);
  }
  return fallback;
}

function deepReplaceTaskId(value: unknown, taskId: string): unknown {
  if (typeof value === "string") return interpolateString(value, taskId);
  if (Array.isArray(value)) return value.map((item) => deepReplaceTaskId(item, taskId));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, deepReplaceTaskId(item, taskId)]),
    );
  }
  return value;
}
