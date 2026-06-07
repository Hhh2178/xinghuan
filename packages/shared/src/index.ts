export const PRODUCT_NAME = "星幻";

export const appVersion = "0.1.0";

export type AppEnvironment = "local" | "gray" | "production";
export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

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
