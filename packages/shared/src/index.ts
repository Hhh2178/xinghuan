export const PRODUCT_NAME = "星幻";

export const appVersion = "0.5.16";

export type AppEnvironment = "local" | "gray" | "production";
export * from "./provider-generation-task.js";
export type {
  TaskDisplayTone,
  TaskRuntimeStage,
  UnifiedCancelState,
  UnifiedFailureCategory,
  UnifiedRuntimeDiagnostic,
} from "./provider-generation-task.js";
import type { UnifiedRuntimeDiagnostic as SharedUnifiedRuntimeDiagnostic } from "./provider-generation-task.js";
export * from "./task-queue-settings.js";
export * from "./assistant-message-blocks.js";
export * from "./assistant-chat.js";
export * from "./announcements.js";
export * from "./environment-sync.js";
export * from "./runninghub.js";

import type { ProviderGenerationTaskStatus } from "./provider-generation-task.js";

export type TaskStatus = ProviderGenerationTaskStatus;

export type UnifiedRuntimeDiagnosticField =
  keyof Pick<SharedUnifiedRuntimeDiagnostic, "failureCategory" | "cancelState">;

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
