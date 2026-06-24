import type { TaskQueueSettings } from "@xinghuan/shared";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "./http-session-utils.js";
import { buildAdminQueueSettingsPayload } from "./api-response-adapters.js";

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

interface AdminQueueSettingsMutationBody {
  taskQueueSettings?: Partial<{
    image: { concurrency?: number; userConcurrency?: number };
    audio: { concurrency?: number; userConcurrency?: number };
    video: { concurrency?: number; userConcurrency?: number };
    runninghub: { concurrency?: number; enabled?: boolean };
  }>;
  revision?: number;
}

export interface AdminQueueSettingsRouteDeps {
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
  adminSettingsRevisionFromPayload: (value: unknown) => number | undefined;
}

function isQueueSettingsPath(pathname: string) {
  return pathname === "/api/admin/system" || pathname === "/api/admin/queue-settings";
}

export async function handleAdminQueueSettingsRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  adminUser: CurrentUserShape;
  requestContext: RequestContextShape;
  deps: AdminQueueSettingsRouteDeps;
}) {
  const { request, response, url, adminUser, requestContext, deps } = input;
  if (!isQueueSettingsPath(url.pathname)) return false;

  if (request.method === "GET" && url.pathname === "/api/admin/queue-settings") {
    const current = await deps.readTaskQueueSettingsRecord();
    const adminDb = await deps.readAdminDb();
    const effectiveTaskQueueSettings = deps.withEffectiveRunningHubConcurrency(current.taskQueueSettings, adminDb.providers);
    await deps.appendAudit(adminUser, "system.taskQueue.read", "system", "task-queue-settings", "查看任务并发设置", requestContext);
    deps.sendT8(response, buildAdminQueueSettingsPayload({
      taskQueueSettings: effectiveTaskQueueSettings,
      revision: current.revision,
      updatedAt: current.updatedAt,
    }));
    return true;
  }

  if (request.method !== "PATCH") return false;

  const body = await readJsonBody<AdminQueueSettingsMutationBody>(request);
  const current = await deps.readTaskQueueSettingsRecord();
  const saved = await deps.writeTaskQueueSettingsRecord(
    deps.normalizeTaskQueueSettings(body.taskQueueSettings, current.taskQueueSettings),
    deps.adminSettingsRevisionFromPayload(body),
  );
  const adminDb = await deps.readAdminDb();
  const effectiveTaskQueueSettings = deps.withEffectiveRunningHubConcurrency(saved.taskQueueSettings, adminDb.providers);
  await deps.appendAudit(adminUser, "system.taskQueue.update", "system", "task-queue-settings", "更新任务并发设置", requestContext);
  deps.sendT8(response, buildAdminQueueSettingsPayload({
    taskQueueSettings: effectiveTaskQueueSettings,
    revision: saved.revision,
    updatedAt: saved.updatedAt,
  }));
  return true;
}
