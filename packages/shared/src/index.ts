export const PRODUCT_NAME = "星幻";

export const appVersion = "0.1.0";

export type AppEnvironment = "local" | "gray" | "production";

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
