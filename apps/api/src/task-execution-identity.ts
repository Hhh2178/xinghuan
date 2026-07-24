export interface TaskExecutionIdentitySnapshot {
  providerId: string;
  providerName: string;
  modelRecordId: string;
  providerModelId: string;
  modelName: string;
}

export interface TaskExecutionIdentityCatalog {
  providers: Array<{ id: string; name: string }>;
  models: Array<{ id: string; providerId: string; modelId: string; displayName?: string }>;
}

interface TaskExecutionIdentityProjectionInput {
  providerId?: unknown;
  modelRecordId?: unknown;
  snapshot?: unknown;
  live?: {
    providerName?: unknown;
    providerModelId?: unknown;
    modelName?: unknown;
  };
}

export function normalizeTaskExecutionIdentitySnapshot(value: unknown): TaskExecutionIdentitySnapshot {
  const source = record(value);
  return {
    providerId: text(source.providerId),
    providerName: text(source.providerName),
    modelRecordId: text(source.modelRecordId),
    providerModelId: text(source.providerModelId),
    modelName: text(source.modelName),
  };
}

export function projectTaskExecutionIdentity(input: TaskExecutionIdentityProjectionInput): TaskExecutionIdentitySnapshot {
  const snapshot = normalizeTaskExecutionIdentitySnapshot(input.snapshot);
  const providerId = snapshot.providerId || text(input.providerId);
  const modelRecordId = snapshot.modelRecordId || text(input.modelRecordId);
  const providerName = snapshot.providerName || text(input.live?.providerName) || providerId;
  const providerModelId = snapshot.providerModelId || text(input.live?.providerModelId) || modelRecordId;
  const modelName = snapshot.modelName || text(input.live?.modelName) || providerModelId || modelRecordId;
  return { providerId, providerName, modelRecordId, providerModelId, modelName };
}

export function projectTaskExecutionIdentityFromCatalog(
  input: Omit<TaskExecutionIdentityProjectionInput, "live">,
  catalog: TaskExecutionIdentityCatalog,
): TaskExecutionIdentitySnapshot {
  const providerId = text(input.providerId);
  const modelRecordId = text(input.modelRecordId);
  const provider = catalog.providers.find((item) => text(item.id) === providerId);
  const model = catalog.models.find((item) =>
    text(item.id) === modelRecordId
    || (text(item.providerId) === providerId && text(item.modelId) === modelRecordId),
  );
  return projectTaskExecutionIdentity({
    ...input,
    providerId,
    modelRecordId,
    live: {
      providerName: provider?.name,
      providerModelId: model?.modelId,
      modelName: model?.displayName || model?.modelId,
    },
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return (typeof value === "string" || typeof value === "number" ? String(value) : "").trim().slice(0, 500);
}
