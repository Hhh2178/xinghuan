import type { IncomingMessage, ServerResponse } from "node:http";
import {
  handleAdminQueueSettingsRoutes,
  type AdminQueueSettingsRouteDeps,
  type CurrentUserShape as QueueCurrentUserShape,
  type RequestContextShape as QueueRequestContextShape,
} from "./admin-queue-settings-routes.js";
import {
  handleAdminSystemSettingsRoutes,
  type AdminSystemSettingsRouteDeps,
} from "./admin-system-settings-routes.js";
import {
  handleAdminAssistantSettingsRoutes,
  type AdminAssistantSettingsRouteDeps,
} from "./admin-assistant-settings-routes.js";

type CurrentUserShape = QueueCurrentUserShape;
type RequestContextShape = QueueRequestContextShape;

export interface AdminSystemRouteDeps {
  systemSettings: AdminSystemSettingsRouteDeps;
  queueSettings: AdminQueueSettingsRouteDeps;
  assistantSettings: AdminAssistantSettingsRouteDeps;
}

function isAdminSystemPath(pathname: string) {
  return pathname === "/api/admin/system"
    || pathname === "/api/admin/queue-settings"
    || pathname === "/api/admin/assistant/settings";
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
  if (!isAdminSystemPath(url.pathname)) return false;

  if (await handleAdminSystemSettingsRoutes({
    request,
    response,
    url,
    adminUser,
    requestContext,
    deps: deps.systemSettings,
  })) {
    return true;
  }

  if (await handleAdminQueueSettingsRoutes({
    request,
    response,
    url,
    adminUser,
    requestContext,
    deps: deps.queueSettings,
  })) {
    return true;
  }

  if (await handleAdminAssistantSettingsRoutes({
    request,
    response,
    url,
    adminUser,
    requestContext,
    deps: deps.assistantSettings,
  })) {
    return true;
  }

  return false;
}
