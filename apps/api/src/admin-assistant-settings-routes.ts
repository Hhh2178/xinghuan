import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "./http-session-utils.js";

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

interface AssistantFrontendSettingsShape {
  enabled: boolean;
  title: string;
  hint: string;
  placeholder: string;
  allowWorkflowAttachment: boolean;
  allowNodeAttachment: boolean;
  allowMediaAttachment: boolean;
  persistMemory: false;
}

interface AssistantBackendSettingsShape {
  enabled: boolean;
  title: string;
  hint: string;
  placeholder: string;
  defaultOpen: boolean;
  allowProviderContext: boolean;
  allowModelContext: boolean;
  allowTaskContext: boolean;
  allowUserContext: boolean;
  allowAuditContext: boolean;
}

interface AssistantIntegrationSettingsShape {
  kernel: "hermes" | "fallback";
  endpoint: string;
  endpointConfigured?: boolean;
  workspace: string;
  model: string;
  profile: string;
  persistMemory: boolean;
  strictMode: boolean;
}

interface AssistantSettingsRecordShape {
  frontend: AssistantFrontendSettingsShape;
  backend: AssistantBackendSettingsShape;
  integration: AssistantIntegrationSettingsShape;
  updatedAt: number;
  revision: number;
}

export interface AdminAssistantSettingsRouteDeps {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number) => void;
  appendAudit: (
    actor: CurrentUserShape,
    action: string,
    targetType: string,
    targetId: string,
    summary: string,
    requestContext: RequestContextShape,
  ) => Promise<void>;
  readAssistantSettingsRecord: () => Promise<AssistantSettingsRecordShape>;
  defaultAssistantSettings: () => AssistantSettingsRecordShape;
  normalizeAssistantSettings: (
    value: unknown,
    base?: AssistantSettingsRecordShape,
  ) => AssistantSettingsRecordShape;
  writeAssistantSettingsRecord: (
    settings: AssistantSettingsRecordShape,
    expectedRevision?: number,
  ) => Promise<AssistantSettingsRecordShape>;
  adminSettingsRevisionFromPayload: (value: unknown) => number | undefined;
  maskAssistantEndpoint: (settings: AssistantSettingsRecordShape) => AssistantSettingsRecordShape;
}

export async function handleAdminAssistantSettingsRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  adminUser: CurrentUserShape;
  requestContext: RequestContextShape;
  deps: AdminAssistantSettingsRouteDeps;
}) {
  const { request, response, url, adminUser, requestContext, deps } = input;
  if (url.pathname !== "/api/admin/assistant/settings") return false;

  if (request.method === "GET") {
    const settings = await deps.readAssistantSettingsRecord();
    deps.sendT8(response, deps.maskAssistantEndpoint(settings || deps.defaultAssistantSettings()));
    return true;
  }

  if (request.method === "PATCH") {
    const body = await readJsonBody<Partial<AssistantSettingsRecordShape>>(request);
    const current = await deps.readAssistantSettingsRecord();
    const settings = deps.normalizeAssistantSettings(body, current || deps.defaultAssistantSettings());
    const saved = await deps.writeAssistantSettingsRecord(settings, deps.adminSettingsRevisionFromPayload(body));
    await deps.appendAudit(
      adminUser,
      "assistant.settings.update",
      "assistant",
      "assistant-settings",
      "更新 AI 助手接入与显示设置",
      requestContext,
    );
    deps.sendT8(response, deps.maskAssistantEndpoint(saved));
    return true;
  }

  return false;
}
