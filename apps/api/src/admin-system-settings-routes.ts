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

interface AdminDbShape {
  providers: any[];
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
  readAdminDb: () => Promise<AdminDbShape>;
  withEffectiveRunningHubConcurrency: (taskQueueSettings: TaskQueueSettings, providers: any[]) => TaskQueueSettings;
  readDatabaseStatus: () => Promise<DatabaseStatusShape>;
  readRedisStatus: (taskQueueSettings: TaskQueueSettings) => Promise<RedisStatusShape>;
  readSystemObservability: (database: DatabaseStatusShape, redis: RedisStatusShape) => Promise<unknown>;
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
  if (url.pathname !== "/api/admin/system" || request.method !== "GET") return false;

  const taskQueueSettingsRecord = await deps.readTaskQueueSettingsRecord();
  const adminDb = await deps.readAdminDb();
  const effectiveTaskQueueSettings = deps.withEffectiveRunningHubConcurrency(taskQueueSettingsRecord.taskQueueSettings, adminDb.providers);
  await deps.appendAudit(adminUser, "system.read", "system", "system-status", "查看系统状态", requestContext);
  const database = await deps.readDatabaseStatus();
  const redis = await deps.readRedisStatus(effectiveTaskQueueSettings);
  deps.sendT8(response, buildAdminSystemStatusPayload({
    environment: deps.environment,
    dataDir: deps.dataDir,
    database,
    redis,
    observability: await deps.readSystemObservability(database, redis),
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
