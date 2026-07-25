import type {
  GenerationBatchChildSnapshot,
  GenerationBatchSnapshot,
} from "@xinghuan/shared";
import { inheritOutputFetchContext } from "./output-materials.js";

interface GenerationResult extends Record<string, unknown> {
  taskId?: unknown;
}

export interface GenerationBatchProgress extends GenerationBatchSnapshot {
  outputUrls: string[];
  remoteOutputUrls: string[];
  taskIds: string[];
}

export async function executeGenerationBatch(options: {
  generationCount: number;
  maximumConcurrency?: unknown;
  outputKey: string;
  remoteOutputKey: string;
  execute: (batchIndex: number, remaining: number) => Promise<GenerationResult>;
  isCancelled?: () => Promise<boolean>;
  onProgress?: (progress: GenerationBatchProgress) => Promise<void>;
}) {
  const total = options.generationCount;
  const maximumConcurrency = boundedConcurrency(options.maximumConcurrency, total);
  const children: GenerationBatchChildSnapshot[] = Array.from({ length: total }, (_, batchIndex) => ({
    batchIndex,
    status: "queued",
    generationArtifactIds: [],
    outputUrls: [],
    remoteOutputUrls: [],
  }));
  const resultByIndex = new Map<number, GenerationResult>();
  let cursor = 0;
  let providerRequestCount = 0;
  let cancelled = false;
  let firstError: unknown;

  const emit = async () => {
    await options.onProgress?.(inheritOutputFetchContext(
      snapshot(children, total, providerRequestCount),
      [...resultByIndex.values()],
    ));
  };
  const cancelUnstarted = () => {
    for (const child of children) {
      if (child.status === "queued") child.status = "cancelled";
    }
  };

  const runWorker = async () => {
    while (true) {
      if (cancelled || await options.isCancelled?.()) {
        cancelled = true;
        cancelUnstarted();
        return;
      }
      const batchIndex = cursor;
      cursor += 1;
      if (batchIndex >= total) return;
      const child = children[batchIndex];
      child.status = "running";
      child.startedAt = Date.now();
      providerRequestCount += 1;
      await emit();
      try {
        const result = await options.execute(batchIndex, 1);
        if (cancelled || await options.isCancelled?.()) {
          cancelled = true;
          child.status = "cancelled";
          child.finishedAt = Date.now();
          cancelUnstarted();
          await emit();
          continue;
        }
        resultByIndex.set(batchIndex, result);
        child.status = "succeeded";
        child.taskId = text(result.taskId) || undefined;
        child.outputUrls = strings(result[options.outputKey]);
        child.remoteOutputUrls = strings(result[options.remoteOutputKey]);
        child.finishedAt = Date.now();
        await emit();
      } catch (error) {
        firstError ||= error;
        child.status = "failed";
        child.error = safeError(error);
        child.finishedAt = Date.now();
        await emit();
      }
    }
  };

  await Promise.all(Array.from({ length: maximumConcurrency }, () => runWorker()));
  const finalSnapshot = snapshot(children, total, providerRequestCount);
  const successfulResults = [...resultByIndex.entries()].sort(([left], [right]) => left - right);
  const outputUrls = successfulResults.flatMap(([, result]) => strings(result[options.outputKey])).slice(0, total);
  const remoteOutputUrls = successfulResults
    .flatMap(([, result]) => strings(result[options.remoteOutputKey]))
    .filter((url) => outputUrls.includes(url));
  const taskIds = successfulResults.map(([, result]) => text(result.taskId)).filter(Boolean);
  const resultPatch = inheritOutputFetchContext({
    ...(successfulResults.at(-1)?.[1] || {}),
    outputUrls,
    remoteOutputUrls,
    taskIds,
    providerRequestCount,
    generationBatch: finalSnapshot,
  }, successfulResults.map(([, result]) => result));
  if (cancelled) throw batchError("TASK_CANCELLED", resultPatch);
  if (firstError) throw batchError(firstError instanceof Error ? firstError.message : "GENERATION_BATCH_FAILED", resultPatch);
  return resultPatch;
}

function snapshot(children: GenerationBatchChildSnapshot[], total: number, providerRequestCount: number): GenerationBatchProgress {
  const ordered = children.map((child) => ({
    ...child,
    generationArtifactIds: [...(child.generationArtifactIds || [])],
    outputUrls: [...(child.outputUrls || [])],
    remoteOutputUrls: [...(child.remoteOutputUrls || [])],
  }));
  const succeeded = ordered.filter((child) => child.status === "succeeded");
  return {
    total,
    completed: succeeded.length,
    providerRequestCount,
    children: ordered,
    outputUrls: succeeded.flatMap((child) => child.outputUrls || []).slice(0, total),
    remoteOutputUrls: succeeded.flatMap((child) => child.remoteOutputUrls || []),
    taskIds: succeeded.map((child) => child.taskId || "").filter(Boolean),
  };
}

function batchError(message: string, resultPatch: Record<string, unknown>) {
  const error = new Error(message) as Error & { resultPatch: Record<string, unknown> };
  error.resultPatch = resultPatch;
  return error;
}

function boundedConcurrency(value: unknown, total: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(total, 4, Math.floor(parsed))) : Math.min(total, 4);
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error || "GENERATION_CHILD_FAILED"))
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted url]")
    .slice(0, 500);
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
