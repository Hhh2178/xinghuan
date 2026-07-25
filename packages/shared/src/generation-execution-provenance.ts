export const GENERATION_EXECUTION_PROVENANCE_SCHEMA_VERSION = 1 as const;

export interface GenerationExecutionProvenanceV1 {
  schemaVersion: typeof GENERATION_EXECUTION_PROVENANCE_SCHEMA_VERSION;
  sourceTaskId: string;
  sourceNodeId: string;
  canvasRunId?: string;
  canvasRunStepId?: string;
  providerId: string;
  modelRecordId: string;
  resolvedPrompt: string;
}

export function buildGenerationExecutionProvenance(
  input: Omit<GenerationExecutionProvenanceV1, "schemaVersion">,
): GenerationExecutionProvenanceV1 {
  const optional = {
    ...(boundedText(input.canvasRunId, 200) ? { canvasRunId: boundedText(input.canvasRunId, 200) } : {}),
    ...(boundedText(input.canvasRunStepId, 200) ? { canvasRunStepId: boundedText(input.canvasRunStepId, 200) } : {}),
  };
  return {
    schemaVersion: GENERATION_EXECUTION_PROVENANCE_SCHEMA_VERSION,
    sourceTaskId: boundedText(input.sourceTaskId, 200),
    sourceNodeId: boundedText(input.sourceNodeId, 200),
    ...optional,
    providerId: boundedText(input.providerId, 200),
    modelRecordId: boundedText(input.modelRecordId, 200),
    resolvedPrompt: safePrompt(input.resolvedPrompt),
  };
}

export function readGenerationExecutionProvenance(value: unknown): GenerationExecutionProvenanceV1 | null {
  const row = record(value);
  if (row.schemaVersion !== GENERATION_EXECUTION_PROVENANCE_SCHEMA_VERSION) return null;
  const provenance = buildGenerationExecutionProvenance({
    sourceTaskId: text(row.sourceTaskId),
    sourceNodeId: text(row.sourceNodeId),
    canvasRunId: text(row.canvasRunId),
    canvasRunStepId: text(row.canvasRunStepId),
    providerId: text(row.providerId),
    modelRecordId: text(row.modelRecordId),
    resolvedPrompt: text(row.resolvedPrompt),
  });
  return provenance.sourceTaskId
    && provenance.sourceNodeId
    && provenance.providerId
    && provenance.modelRecordId
    && provenance.resolvedPrompt
    ? provenance
    : null;
}

function safePrompt(value: unknown) {
  return boundedText(value, 20_000)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]")
    .replace(/(?:api[_-]?key|token|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, "[redacted credential]");
}

function boundedText(value: unknown, maximum: number) {
  return text(value).slice(0, maximum);
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
