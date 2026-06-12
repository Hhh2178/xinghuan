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

export const PROVIDER_GENERATION_CAPABILITIES = [
  "image",
  "video",
  "audio",
  "chat",
] as const;

export type ProviderGenerationCapability =
  (typeof PROVIDER_GENERATION_CAPABILITIES)[number];

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

export interface ProviderGenerationTaskResult {
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
}

export interface ProviderGenerationTaskRecord {
  id: string;
  capability: ProviderGenerationCapability;
  executionMode: ProviderGenerationExecutionMode;
  status: ProviderGenerationTaskStatus;
  payloadSummary: ProviderGenerationTaskPayloadSummary;
  result: ProviderGenerationTaskResult;
}
