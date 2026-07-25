import {
  buildGenerationExecutionProvenance,
  readGenerationExecutionProvenance,
  type GenerationExecutionProvenanceV1,
} from "@xinghuan/shared";

export interface CanvasRunSelectorArtifact {
  id: string;
  ownerId?: string;
  sourceTaskId?: string;
  sourceNodeId: string;
  providerId: string;
  modelId: string;
  metadata: Record<string, unknown>;
}

export interface CanvasRunSourceTask {
  id: string;
  ownerId: string;
  providerId?: string;
  modelRecordId?: string;
  payload: Record<string, unknown>;
}

export function resolveCanvasRunArtifactProvenance(input: {
  artifact: CanvasRunSelectorArtifact;
  sourceTask?: CanvasRunSourceTask;
}): GenerationExecutionProvenanceV1 {
  const embedded = readGenerationExecutionProvenance(input.artifact.metadata.provenance);
  if (embedded) return embedded;

  if (input.sourceTask && input.artifact.ownerId && input.sourceTask.ownerId !== input.artifact.ownerId) {
    throw new Error("SMART_CANDIDATE_PROVENANCE_OWNER_MISMATCH");
  }
  if (input.sourceTask && input.artifact.sourceTaskId && input.sourceTask.id !== input.artifact.sourceTaskId) {
    throw new Error("SMART_CANDIDATE_PROVENANCE_TASK_MISMATCH");
  }

  const partial = record(input.artifact.metadata.provenance);
  const payload = input.sourceTask?.payload || {};
  return buildGenerationExecutionProvenance({
    sourceTaskId: text(input.sourceTask?.id) || text(partial.sourceTaskId) || text(input.artifact.sourceTaskId),
    sourceNodeId: text(payload.sourceNodeId) || text(partial.sourceNodeId) || input.artifact.sourceNodeId,
    canvasRunId: text(payload.canvasRunId) || text(partial.canvasRunId),
    canvasRunStepId: text(payload.canvasRunStepId) || text(partial.canvasRunStepId),
    providerId: text(input.sourceTask?.providerId) || text(partial.providerId) || input.artifact.providerId,
    modelRecordId: text(input.sourceTask?.modelRecordId) || text(partial.modelRecordId) || input.artifact.modelId,
    resolvedPrompt: text(payload.prompt) || text(payload.text) || text(partial.resolvedPrompt) || text(input.artifact.metadata.prompt),
  });
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
