import type { TaskQueueSettings } from "@xinghuan/shared";

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

interface AdminSystemTaskQueuePayloadInput {
  taskQueueSettings: TaskQueueSettings;
  revision: number;
  updatedAt: number;
}

export function buildAdminSystemStatusPayload(input: AdminSystemStatusPayloadInput) {
  return {
    environment: input.environment,
    dataDir: input.dataDir,
    database: input.database,
    redis: input.redis,
    observability: input.observability,
    taskQueueSettings: input.taskQueueSettings,
    taskQueueSettingsRevision: input.taskQueueSettingsRevision,
    taskQueueSettingsUpdatedAt: input.taskQueueSettingsUpdatedAt,
    storageDriver: input.storageDriver,
    authDbPath: input.authDbPath,
    adminDbPath: input.adminDbPath,
    service: input.service || "xinghuan-api",
    version: input.version,
    storage: input.storage,
  };
}

export function buildAdminSystemTaskQueuePayload(input: AdminSystemTaskQueuePayloadInput) {
  return {
    ok: true,
    taskQueueSettings: input.taskQueueSettings,
    revision: input.revision,
    updatedAt: input.updatedAt,
  };
}
