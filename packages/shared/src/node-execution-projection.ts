import type { GenerationBatchChildSnapshot } from "./provider-generation-task.js";

export type NodeExecutionStatus = "idle" | "queued" | "running" | "success" | "error" | "cancelled";

export interface TaskRunState {
  batchIndex: number;
  status: NodeExecutionStatus;
  taskId?: string;
  error?: string;
  generationArtifactIds: string[];
}

export interface NodeExecutionProjection {
  authority: "manual" | "workflow_run";
  runId?: string;
  runStepId?: string;
  nodeId: string;
  nodeType: string;
  status: NodeExecutionStatus;
  progress: string;
  taskId?: string;
  taskRuns: TaskRunState[];
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  outputs: {
    generationArtifactIds: string[];
    imageUrls: string[];
    videoUrls: string[];
    audioUrls: string[];
    text?: string;
  };
}

export function buildNodeExecutionProjection(input: {
  authority: NodeExecutionProjection["authority"];
  runId?: unknown;
  runStepId?: unknown;
  nodeId: unknown;
  nodeType: unknown;
  stepStatus?: unknown;
  taskId?: unknown;
  taskStatus?: unknown;
  taskResult?: unknown;
  stepError?: unknown;
  startedAt?: unknown;
  finishedAt?: unknown;
}): NodeExecutionProjection {
  const result = record(input.taskResult);
  const batch = record(result.generationBatch);
  const children = Array.isArray(batch.children) ? batch.children.map(record) : [];
  const total = positiveInteger(batch.total) || (children.length > 0 ? children.length : positiveInteger(result.generationCount));
  const completed = Math.min(total, positiveInteger(batch.completed) || children.filter((child) => child.status === "succeeded").length);
  const taskId = text(input.taskId);
  const taskRuns = children.length > 0
    ? children.map(toTaskRunState).sort((left, right) => left.batchIndex - right.batchIndex)
    : taskId ? [{ batchIndex: 0, status: mapStatus(input.taskStatus || input.stepStatus), taskId, generationArtifactIds: strings(result.generationArtifactIds) }] : [];
  const status = resolveProjectionStatus(input.stepStatus, input.taskStatus);
  const error = safeError(record(input.stepError).message || record(input.stepError).code || result.failureReason);
  const outputText = text(result.content || result.reply || result.text || result.outputText);

  return compact({
    authority: input.authority,
    runId: text(input.runId) || undefined,
    runStepId: text(input.runStepId) || undefined,
    nodeId: text(input.nodeId),
    nodeType: text(input.nodeType),
    status,
    progress: total > 0 ? `${completed}/${total}` : status === "success" ? "1/1" : "",
    taskId: taskId || undefined,
    taskRuns,
    startedAt: millis(input.startedAt),
    finishedAt: millis(input.finishedAt),
    error: error || undefined,
    outputs: compact({
      generationArtifactIds: strings(result.generationArtifactIds),
      imageUrls: platformUrls(result.materializedImageUrls),
      videoUrls: platformUrls(result.materializedVideoUrls),
      audioUrls: platformUrls(result.materializedAudioUrls),
      text: outputText || undefined,
    }),
  }) as NodeExecutionProjection;
}

function toTaskRunState(child: Record<string, unknown>): TaskRunState {
  return compact({
    batchIndex: Math.max(0, Math.floor(Number(child.batchIndex) || 0)),
    status: mapStatus(child.status),
    taskId: text(child.taskId) || undefined,
    error: safeError(child.error) || undefined,
    generationArtifactIds: strings(child.generationArtifactIds),
  }) as TaskRunState;
}

function mapStatus(value: unknown): NodeExecutionStatus {
  const status = text(value).toLowerCase();
  if (status === "succeeded" || status === "success") return "success";
  if (status === "failed" || status === "error") return "error";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (["running", "evaluating", "selecting"].includes(status)) return "running";
  if (["queued", "ready", "blocked", "retry_wait", "awaiting_approval"].includes(status)) return "queued";
  return "idle";
}

function resolveProjectionStatus(stepStatus: unknown, taskStatus: unknown): NodeExecutionStatus {
  const step = mapStatus(stepStatus);
  const task = mapStatus(taskStatus);
  const rawStep = text(stepStatus).toLowerCase();
  if (["running", "evaluating", "selecting"].includes(rawStep)) return "running";
  if (step === "queued" && task === "running") return "running";
  if (["success", "error", "cancelled"].includes(step)) return step;
  return task !== "idle" ? task : step;
}

function safeError(value: unknown) {
  return text(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted url]")
    .replace(/(?:api[_-]?key|token|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, "[redacted credential]")
    .slice(0, 500);
}

function platformUrls(value: unknown) {
  return strings(value).filter((url) => url.startsWith("/files/") || url.startsWith("/api/files/"));
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function millis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  const parsed = typeof value === "number" ? value : new Date(String(value || "")).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
