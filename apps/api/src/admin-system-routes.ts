import type { TaskQueueSettings } from "@xinghuan/shared";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "./http-session-utils.js";
import {
  buildAdminSystemStatusPayload,
  buildAdminSystemTaskQueuePayload,
} from "./admin-system-response-adapter.js";

interface CurrentUserShape {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
}

interface RequestContextShape {
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

interface AdminSystemMutationBody {
  taskQueueSettings?: Partial<{
    image: { concurrency?: number; userConcurrency?: number };
    audio: { concurrency?: number; userConcurrency?: number };
    video: { concurrency?: number; userConcurrency?: number };
    runninghub: { concurrency?: number; enabled?: boolean };
  }>;
  revision?: number;
}

interface AdminSystemRouteDeps {
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
  writeTaskQueueSettingsRecord: (taskQueueSettings: TaskQueueSettings, expectedRevision?: number) => Promise<SystemSettingsRecordShape>;
  readAdminDb: () => Promise<AdminDbShape>;
  normalizeTaskQueueSettings: (patch?: unknown, current?: TaskQueueSettings) => TaskQueueSettings;
  withEffectiveRunningHubConcurrency: (taskQueueSettings: TaskQueueSettings, providers: any[]) => TaskQueueSettings;
  readDatabaseStatus: () => Promise<unknown>;
  readRedisStatus: (taskQueueSettings: TaskQueueSettings) => Promise<unknown>;
  readSystemObservability: (database: any, redis: any) => Promise<unknown>;
  readStorageStats: () => Promise<unknown>;
  adminSettingsRevisionFromPayload: (value: unknown) => number | undefined;
  environment: string;
  dataDir: string;
  storageDriver: string;
  authDbPath: string;
  adminDbPath: string;
  version: string;
}

export async function handleAdminSystemRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  adminUser: CurrentUserShape;
  requestContext: RequestContextShape;
  deps: AdminSystemRouteDeps;
}) {
  const { request, response, url, adminUser, requestContext, deps } = input;
  if (url.pathname !== "/api/admin/system") return false;

  if (request.method === "GET") {
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

  if (request.method === "PATCH") {
    const body = await readJsonBody<AdminSystemMutationBody>(request);
    const current = await deps.readTaskQueueSettingsRecord();
    const saved = await deps.writeTaskQueueSettingsRecord(
      deps.normalizeTaskQueueSettings(body.taskQueueSettings, current.taskQueueSettings),
      deps.adminSettingsRevisionFromPayload(body),
    );
    const adminDb = await deps.readAdminDb();
    const effectiveTaskQueueSettings = deps.withEffectiveRunningHubConcurrency(saved.taskQueueSettings, adminDb.providers);
    await deps.appendAudit(adminUser, "system.taskQueue.update", "system", "task-queue-settings", "更新任务并发设置", requestContext);
    deps.sendT8(response, buildAdminSystemTaskQueuePayload({
      taskQueueSettings: effectiveTaskQueueSettings,
      revision: saved.revision,
      updatedAt: saved.updatedAt,
    }));
    return true;
  }

  return false;
}
