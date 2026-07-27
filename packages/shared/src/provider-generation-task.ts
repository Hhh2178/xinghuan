export const PROVIDER_GENERATION_EXECUTION_MODES = [
  "sync_inline",
  "async_poll",
  "async_poll_then_final_lookup",
  "worker_queue",
] as const;

export type ProviderGenerationExecutionMode =
  (typeof PROVIDER_GENERATION_EXECUTION_MODES)[number];

export const PROVIDER_GENERATION_TASK_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type ProviderGenerationTaskStatus =
  (typeof PROVIDER_GENERATION_TASK_STATUSES)[number];

export const TASK_DISPLAY_TONES = [
  "muted",
  "warning",
  "success",
  "danger",
] as const;

export type TaskDisplayTone =
  (typeof TASK_DISPLAY_TONES)[number];

export const TASK_RUNTIME_STAGES = [
  "queued",
  "submitted",
  "running",
  "polling",
  "materializing",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type TaskRuntimeStage =
  (typeof TASK_RUNTIME_STAGES)[number];

export const PROVIDER_GENERATION_CAPABILITIES = [
  "image",
  "video",
  "audio",
  "chat",
] as const;

export type ProviderGenerationCapability =
  (typeof PROVIDER_GENERATION_CAPABILITIES)[number];

export type GenerationBatchChildStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface GenerationBatchChildSnapshot {
  batchIndex: number;
  status: GenerationBatchChildStatus;
  taskId?: string;
  error?: string;
  generationArtifactIds?: string[];
  outputUrls?: string[];
  remoteOutputUrls?: string[];
  startedAt?: number;
  finishedAt?: number;
}

export interface GenerationBatchSnapshot {
  total: number;
  completed: number;
  providerRequestCount: number;
  children: GenerationBatchChildSnapshot[];
}

export type UnifiedFailureCategory =
  | "auth"
  | "quota_or_credits"
  | "model_config"
  | "upstream_business_failed"
  | "upstream_poll_gateway_failed"
  | "upstream_poll_timeout"
  | "provider_content_forbidden"
  | "provider_content_unavailable"
  | "provider_content_stream_terminated"
  | "local_cancelled"
  | "remote_cancel_failed"
  | "unknown";

export type UnifiedCancelState =
  | "cancelled"
  | "cancelled_local_only"
  | "cancel_failed_remote_but_closed_local";

export interface UnifiedRuntimeDiagnostic {
  failureCategory?: UnifiedFailureCategory;
  providerDiagnostic?: string;
  upstreamHttpStatus?: number;
  upstreamResponseSnippet?: string;
  submitDiagnostic?: string;
  pollDiagnostic?: string;
  cancelState?: UnifiedCancelState;
}

export interface ProviderGenerationTaskPayloadSummary {
  prompt?: string;
  negativePrompt?: string;
  modelId?: string;
  providerId?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  imageCount?: number;
  videoCount?: number;
  audioCount?: number;
  referenceAssetCount?: number;
}

export interface ProviderGenerationTaskResult extends UnifiedRuntimeDiagnostic {
  generationArtifactIds: string[];
  resourceItemIds: string[];
  resourceCount: number;
  materializedImageUrls: string[];
  materializedVideoUrls: string[];
  materializedAudioUrls: string[];
  remoteImageUrls: string[];
  remoteVideoUrls: string[];
  remoteAudioUrls: string[];
  failureReason: string;
  workerId: string;
  adapter: string;
  waitReason?: string;
  waitDetail?: string;
  queueHint?: string;
  runtimeStage?: TaskRuntimeStage;
  providerState?: string;
  displayStatus?: string;
  displayMessage?: string;
  displayTone?: TaskDisplayTone;
  generationBatch?: GenerationBatchSnapshot;
}

export interface ProviderGenerationTaskRecord {
  id: string;
  capability: ProviderGenerationCapability;
  executionMode: ProviderGenerationExecutionMode;
  status: ProviderGenerationTaskStatus;
  payloadSummary: ProviderGenerationTaskPayloadSummary;
  result: ProviderGenerationTaskResult;
}
