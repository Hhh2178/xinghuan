import { materializeTaskOutputs } from "./output-materials.js";
import { runWithOperationHeartbeat } from "./worker-operation-heartbeat.js";

interface ProgressMaterializerTask {
  id: string;
  ownerId: string;
  title: string;
  providerId: string;
  providerName: string;
  modelRecordId: string;
  providerModelId: string;
  modelDisplayName: string;
  payload: Record<string, unknown>;
}

interface MaterializedProgressResult {
  artifacts: unknown[];
  resourceItems: unknown[];
  resultPatch: Record<string, unknown>;
}

type ProgressMaterializer = (input: {
  dataDir: string;
  task: ProgressMaterializerTask;
  result: Record<string, unknown>;
}) => Promise<MaterializedProgressResult>;

const retainedMaterialKeys = [
  "generationArtifactIds",
  "resourceItemIds",
  "resourceCount",
  "materializedImageUrls",
  "materializedVideoUrls",
  "materializedAudioUrls",
] as const;

export function createGenerationProgressMaterializer(options: {
  dataDir: string;
  task: ProgressMaterializerTask;
  persist: (resultPatch: Record<string, unknown>) => Promise<void>;
  heartbeat?: () => Promise<unknown>;
  materialize?: ProgressMaterializer;
}) {
  const materialize = options.materialize || materializeTaskOutputs;
  let queue = Promise.resolve();
  let materializedCompleted = 0;
  let materializedPatch: Record<string, unknown> = {};

  const record = (input: {
    result: Record<string, unknown>;
    runtimePatch: Record<string, unknown>;
  }) => {
    const work = async () => {
      const completed = count(input.result.completed);
      const total = count(input.result.total);
      if (completed > materializedCompleted && completed < total) {
        const materializeProgress = () => materialize({
            dataDir: options.dataDir,
            task: options.task,
            result: input.result,
          });
        const output = options.heartbeat
          ? await runWithOperationHeartbeat({ intervalMs: 15_000, heartbeat: options.heartbeat, execute: materializeProgress })
          : await materializeProgress();
        materializedPatch = output.resultPatch;
        materializedCompleted = completed;
      }
      await options.persist(mergeMaterializedProjection(input.runtimePatch, input.result, materializedPatch));
    };
    queue = queue.then(work, work);
    return queue;
  };

  const mergeIntoError = (error: unknown) => {
    if (!isRecord(error) || Object.keys(materializedPatch).length === 0) return;
    const current = isRecord(error.resultPatch) ? error.resultPatch : {};
    error.resultPatch = mergeMaterializedProjection(current, current, materializedPatch);
  };

  return { record, mergeIntoError };
}

export async function executeGenerationBatchWithMaterializedProgress<
  TProgress extends { completed: number; total: number; generationBatch: unknown },
  TResult,
>(options: {
  dataDir: string;
  task: ProgressMaterializerTask;
  persist: (resultPatch: Record<string, unknown>) => Promise<void>;
  heartbeat?: () => Promise<unknown>;
  materialize?: ProgressMaterializer;
  execute: (onProgress: (progress: TProgress) => Promise<void>) => Promise<TResult>;
  runtimePatch: (progress: TProgress) => Record<string, unknown>;
}) {
  const progressMaterializer = createGenerationProgressMaterializer(options);
  try {
    return await options.execute((progress) => progressMaterializer.record({
      result: progress as Record<string, unknown>,
      runtimePatch: options.runtimePatch(progress),
    }));
  } catch (error) {
    progressMaterializer.mergeIntoError(error);
    throw error;
  }
}

function mergeMaterializedProjection(
  runtimePatch: Record<string, unknown>,
  currentResult: Record<string, unknown>,
  materializedPatch: Record<string, unknown>,
) {
  if (Object.keys(materializedPatch).length === 0) return runtimePatch;
  const retained = Object.fromEntries(
    retainedMaterialKeys
      .filter((key) => materializedPatch[key] !== undefined)
      .map((key) => [key, materializedPatch[key]]),
  );
  return {
    ...runtimePatch,
    ...retained,
    generationBatch: mergeGenerationBatch(
      currentResult.generationBatch || runtimePatch.generationBatch,
      materializedPatch.generationBatch,
    ),
  };
}

function mergeGenerationBatch(currentValue: unknown, materializedValue: unknown) {
  const current = isRecord(currentValue) ? currentValue : {};
  const materialized = isRecord(materializedValue) ? materializedValue : {};
  if (!Array.isArray(current.children)) return materializedValue;
  const artifactIdsByIndex = new Map(
    (Array.isArray(materialized.children) ? materialized.children : [])
      .filter(isRecord)
      .map((child) => [count(child.batchIndex), stringList(child.generationArtifactIds)]),
  );
  return {
    ...current,
    children: current.children.filter(isRecord).map((child) => {
      const artifactIds = artifactIdsByIndex.get(count(child.batchIndex));
      return artifactIds?.length ? { ...child, generationArtifactIds: artifactIds } : child;
    }),
  };
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean)
    : [];
}

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
