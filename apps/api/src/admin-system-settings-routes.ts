import type { TaskQueueSettings } from "@xinghuan/shared";
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildAdminSystemStatusPayload } from "./api-response-adapters.js";

export interface CurrentUserShape {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
}

export interface RequestContextShape {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  startedAt: number;
  userId?: string;
  userEmail?: string;
}

interface SystemSettingsRecordShape {
  taskQueueSettings: TaskQueueSettings;
  updatedAt: number;
  revision: number;
}

interface DatabaseStatusShape {
  configured: boolean;
  status: string;
  error: string;
  currentDatabase?: string;
  expectedDatabase?: string;
  targetMatched?: boolean;
}

interface RedisStatusShape {
  configured: boolean;
  status: string;
  queue: string;
  depth: number;
  queues: unknown[];
  error: string;
  runninghub: unknown;
}

export interface AdminSystemSettingsRouteDeps {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number) => void;
  appendAudit: (
    actor: CurrentUserShape,
    action: string,
    targetType: string,
    targetId: string,
    summary: string,
    requestContext: RequestContextShape,
  ) => Promise<void>;
  readTaskQueueSettingsRecord: () => Promise<SystemSettingsRecordShape>;
  readProviderRecords: () => Promise<any[]>;
  withEffectiveRunningHubConcurrency: (taskQueueSettings: TaskQueueSettings, providers: any[]) => TaskQueueSettings;
  readDatabaseStatus: () => Promise<DatabaseStatusShape>;
  readRedisStatus: (taskQueueSettings: TaskQueueSettings) => Promise<RedisStatusShape>;
  readSystemObservability: (database: DatabaseStatusShape, redis: RedisStatusShape, range?: string) => Promise<unknown>;
  readStorageStats: () => Promise<unknown>;
  environment: string;
  dataDir: string;
  storageDriver: string;
  authDbPath: string;
  adminDbPath: string;
  version: string;
}

export async function handleAdminSystemSettingsRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  adminUser: CurrentUserShape;
  requestContext: RequestContextShape;
  deps: AdminSystemSettingsRouteDeps;
}) {
  const { request, response, url, adminUser, requestContext, deps } = input;
  if (!["/api/admin/system", "/api/admin/system/health", "/api/admin/system/runtime-settings"].includes(url.pathname) || request.method !== "GET") return false;

  const taskQueueSettingsRecord = await deps.readTaskQueueSettingsRecord();
  const isRuntimeSettings = url.pathname === "/api/admin/system/runtime-settings";
  const isHealth = url.pathname === "/api/admin/system/health";
  if (isRuntimeSettings) {
    const providers = await deps.readProviderRecords();
    const effectiveTaskQueueSettings = deps.withEffectiveRunningHubConcurrency(taskQueueSettingsRecord.taskQueueSettings, providers);
    await deps.appendAudit(adminUser, "system.runtime-settings.read", "system", "runtime-settings", "查看运行参数", requestContext);
    deps.sendT8(response, {
      taskQueueSettings: effectiveTaskQueueSettings,
      taskQueueSettingsRevision: taskQueueSettingsRecord.revision,
      taskQueueSettingsUpdatedAt: taskQueueSettingsRecord.updatedAt,
    });
    return true;
  }
  const effectiveTaskQueueSettings = isHealth
    ? taskQueueSettingsRecord.taskQueueSettings
    : deps.withEffectiveRunningHubConcurrency(taskQueueSettingsRecord.taskQueueSettings, await deps.readProviderRecords());
  await deps.appendAudit(adminUser, isHealth ? "system.health.read" : "system.read", "system", isHealth ? "system-health" : "system-status", isHealth ? "查看系统健康" : "查看系统状态", requestContext);
  const database = await deps.readDatabaseStatus();
  const redis = await deps.readRedisStatus(effectiveTaskQueueSettings);
  deps.sendT8(response, buildAdminSystemStatusPayload({
    environment: deps.environment,
    dataDir: deps.dataDir,
    database,
    redis,
    observability: await deps.readSystemObservability(database, redis, url.searchParams.get("range") || undefined),
    taskQueueSettings: effectiveTaskQueueSettings,
    taskQueueSettingsRevision: taskQueueSettingsRecord.revision,
    taskQueueSettingsUpdatedAt: taskQueueSettingsRecord.updatedAt,
    storageDriver: deps.storageDriver,
    authDbPath: deps.authDbPath,
    adminDbPath: deps.adminDbPath,
    version: deps.version,
    storage: await deps.readStorageStats(),
  }));
  return true;
}
