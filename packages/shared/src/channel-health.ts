export type ChannelHealthCapability = "image" | "video" | "audio" | "chat";

export type ChannelHealthState =
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "insufficient_sample"
  | "no_recent_requests";

export type ChannelFeedbackVote = "up" | "down";
export type ChannelFeedbackWindow = "24h" | "72h_fallback";

export interface ChannelHealthBucketWindow {
  startAt: number;
  endAt: number;
}

export interface ChannelHealthBucketRange {
  windowStartAt: number;
  windowEndAt: number;
  buckets: ChannelHealthBucketWindow[];
}

export interface ChannelHealthBucket extends ChannelHealthBucketWindow {
  succeeded: number;
  failed: number;
  settled: number;
  successRate: number;
  sufficientSample: boolean;
}

export interface ChannelFeedbackSummary {
  window: ChannelFeedbackWindow;
  up: number;
  down: number;
  total: number;
  upRate: number | null;
  viewerVote: ChannelFeedbackVote | null;
}

export interface ChannelHealthModel {
  providerId: string;
  modelRecordId: string;
  nativeModelId: string;
  displayName: string;
  capability: ChannelHealthCapability;
  enabled: boolean;
  state: ChannelHealthState;
  succeeded: number;
  failed: number;
  settled: number;
  successRate: number | null;
  buckets: ChannelHealthBucket[];
  feedback: ChannelFeedbackSummary;
}

export interface ChannelHealthProvider {
  id: string;
  name: string;
  enabled: boolean;
  state: ChannelHealthState;
  models: ChannelHealthModel[];
}

export interface ChannelHealthReport {
  generatedAt: number;
  windowStartAt: number;
  windowEndAt: number;
  bucketHours: 2;
  bucketCount: 36;
  providers: ChannelHealthProvider[];
}

export interface ChannelHealthFilters {
  capability?: ChannelHealthCapability;
  providerId?: string;
  modelRecordId?: string;
}

const HOUR_MS = 60 * 60 * 1000;
const BUCKET_MS = 2 * HOUR_MS;
const BEIJING_OFFSET_MS = 8 * HOUR_MS;
const BUCKET_COUNT = 36;

export function buildChannelHealthBucketRange(nowMs: number): ChannelHealthBucketRange {
  const shiftedNow = nowMs + BEIJING_OFFSET_MS;
  const shiftedCurrentStart = Math.floor(shiftedNow / BUCKET_MS) * BUCKET_MS;
  const currentStart = shiftedCurrentStart - BEIJING_OFFSET_MS;
  const windowStartAt = currentStart - (BUCKET_COUNT - 1) * BUCKET_MS;
  const buckets = Array.from({ length: BUCKET_COUNT }, (_, index) => {
    const startAt = windowStartAt + index * BUCKET_MS;
    return { startAt, endAt: startAt + BUCKET_MS };
  });

  return {
    windowStartAt,
    windowEndAt: currentStart + BUCKET_MS,
    buckets,
  };
}

export function successRate(succeeded: number, failed: number): number | null {
  const settled = Math.max(0, succeeded) + Math.max(0, failed);
  return settled > 0 ? Math.max(0, succeeded) / settled : null;
}

export function classifyChannelHealth(succeeded: number, failed: number): ChannelHealthState {
  const settled = Math.max(0, succeeded) + Math.max(0, failed);
  if (settled === 0) return "no_recent_requests";
  if (settled < 3) return "insufficient_sample";
  const rate = successRate(succeeded, failed) || 0;
  if (rate >= 0.95) return "healthy";
  if (rate >= 0.8) return "degraded";
  return "unhealthy";
}

export function classifyProviderHealth(states: ChannelHealthState[]): ChannelHealthState {
  if (states.includes("unhealthy")) return "unhealthy";
  if (states.includes("degraded")) return "degraded";
  if (states.includes("healthy")) return "healthy";
  if (states.includes("insufficient_sample")) return "insufficient_sample";
  return "no_recent_requests";
}
