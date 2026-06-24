import type { TaskQueueSettings } from "@xinghuan/shared";
import {
  buildAdminSystemStatusPayload as buildLegacyAdminSystemStatusPayload,
  buildAdminSystemTaskQueuePayload,
} from "./admin-system-response-adapter.js";

interface AdminSystemStatusPayloadInput {
  environment: string;
  dataDir: string;
  database: unknown;
  redis: unknown;
  observability: unknown;
  taskQueueSettings: TaskQueueSettings;
  taskQueueSettingsRevision: number;
  taskQueueSettingsUpdatedAt: number;
  storageDriver: string;
  authDbPath: string;
  adminDbPath: string;
  service?: string;
  version: string;
  storage: unknown;
}

interface AdminQueueSettingsPayloadInput {
  taskQueueSettings: TaskQueueSettings;
  revision: number;
  updatedAt: number;
}

export function buildAdminSystemStatusPayload(input: AdminSystemStatusPayloadInput) {
  return buildLegacyAdminSystemStatusPayload(input);
}

export function buildAdminQueueSettingsPayload(input: AdminQueueSettingsPayloadInput) {
  return buildAdminSystemTaskQueuePayload(input);
}
