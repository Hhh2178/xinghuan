export const PRODUCT_NAME = "星幻";

export const appVersion = "0.4.10";

export type AppEnvironment = "local" | "gray" | "production";
export * from "./provider-generation-task.js";
export * from "./task-queue-settings.js";
export * from "./assistant-message-blocks.js";
export * from "./assistant-chat.js";
export * from "./environment-sync.js";
export * from "./runninghub.js";

import type { ProviderGenerationTaskStatus } from "./provider-generation-task.js";

export type TaskStatus = ProviderGenerationTaskStatus;

export type UnifiedFailureCategory =
  | "auth"
  | "quota_or_credits"
  | "model_config"
  | "upstream_business_failed"
  | "upstream_poll_gateway_failed"
  | "upstream_poll_timeout"
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

export interface HealthPayload {
  ok: true;
  service: string;
  version: string;
  environment: AppEnvironment;
  timestamp: string;
}

export const createHealthPayload = (
  service: string,
  environment: AppEnvironment = "local",
): HealthPayload => ({
  ok: true,
  service,
  version: appVersion,
  environment,
  timestamp: new Date().toISOString(),
});

const cancellableTaskStatuses = new Set<TaskStatus>(["queued", "running"]);
const retryableTaskStatuses = new Set<TaskStatus>(["failed", "cancelled"]);

export function canCancelTask(status: TaskStatus) {
  return cancellableTaskStatuses.has(status);
}

export function canRetryTask(status: TaskStatus) {
  return retryableTaskStatuses.has(status);
}
