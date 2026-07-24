export interface AssistantFrontendSettingsRecord {
  enabled: boolean;
  title: string;
  hint: string;
  placeholder: string;
  allowWorkflowAttachment: boolean;
  allowNodeAttachment: boolean;
  allowMediaAttachment: boolean;
  persistMemory: false;
}

export interface AssistantBackendSettingsRecord {
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

export interface AssistantIntegrationSettingsRecord {
  runtime: "internal";
  frontendAssistantAgentKey: string;
  backendAssistantAgentKey: string;
  providerAnalysisAgentKey: string;
  knowledgeProfile: string;
  persistMemory: false;
  strictMode: boolean;
}

export interface AssistantSettingsRecord {
  frontend: AssistantFrontendSettingsRecord;
  backend: AssistantBackendSettingsRecord;
  integration: AssistantIntegrationSettingsRecord;
  updatedAt: number;
  revision: number;
}

export function defaultAssistantSettings(now = Date.now()): AssistantSettingsRecord {
  return {
    frontend: {
      enabled: true,
      title: "画布 AI 助手",
      hint: "",
      placeholder: "输入问题或要求",
      allowWorkflowAttachment: true,
      allowNodeAttachment: true,
      allowMediaAttachment: true,
      persistMemory: false,
    },
    backend: {
      enabled: true,
      title: "后台 AI 助手",
      hint: "",
      placeholder: "输入问题或要求",
      defaultOpen: true,
      allowProviderContext: true,
      allowModelContext: true,
      allowTaskContext: true,
      allowUserContext: true,
      allowAuditContext: true,
    },
    integration: {
      runtime: "internal",
      frontendAssistantAgentKey: "assistant-planner",
      backendAssistantAgentKey: "admin-assistant-planner",
      providerAnalysisAgentKey: "provider-analysis-planner",
      knowledgeProfile: "public-canvas",
      persistMemory: false,
      strictMode: true,
    },
    updatedAt: now,
    revision: 1,
  };
}

export function normalizeAssistantSettings(
  value: unknown,
  base: AssistantSettingsRecord = defaultAssistantSettings(),
): AssistantSettingsRecord {
  const source = plainObject(value);
  const frontendSource = plainObject(source.frontend);
  const backendSource = plainObject(source.backend);
  const integrationSource = plainObject(source.integration);
  const legacyAgentKey = safeText(integrationSource.assistantAgentKey);
  return {
    frontend: {
      enabled: booleanValue(frontendSource.enabled, base.frontend.enabled),
      title: safeText(frontendSource.title, base.frontend.title),
      hint: safeText(frontendSource.hint, base.frontend.hint),
      placeholder: safeText(frontendSource.placeholder, base.frontend.placeholder),
      allowWorkflowAttachment: booleanValue(frontendSource.allowWorkflowAttachment, base.frontend.allowWorkflowAttachment),
      allowNodeAttachment: booleanValue(frontendSource.allowNodeAttachment, base.frontend.allowNodeAttachment),
      allowMediaAttachment: booleanValue(frontendSource.allowMediaAttachment, base.frontend.allowMediaAttachment),
      persistMemory: false,
    },
    backend: {
      enabled: booleanValue(backendSource.enabled, base.backend.enabled),
      title: safeText(backendSource.title, base.backend.title),
      hint: safeText(backendSource.hint, base.backend.hint),
      placeholder: safeText(backendSource.placeholder, base.backend.placeholder),
      defaultOpen: booleanValue(backendSource.defaultOpen, base.backend.defaultOpen),
      allowProviderContext: booleanValue(backendSource.allowProviderContext, base.backend.allowProviderContext),
      allowModelContext: booleanValue(backendSource.allowModelContext, base.backend.allowModelContext),
      allowTaskContext: booleanValue(backendSource.allowTaskContext, base.backend.allowTaskContext),
      allowUserContext: booleanValue(backendSource.allowUserContext, base.backend.allowUserContext),
      allowAuditContext: booleanValue(backendSource.allowAuditContext, base.backend.allowAuditContext),
    },
    integration: {
      runtime: "internal",
      frontendAssistantAgentKey: safeText(
        integrationSource.frontendAssistantAgentKey,
        legacyAgentKey || base.integration.frontendAssistantAgentKey,
      ),
      backendAssistantAgentKey: safeText(
        integrationSource.backendAssistantAgentKey,
        legacyAgentKey || base.integration.backendAssistantAgentKey,
      ),
      providerAnalysisAgentKey: safeText(integrationSource.providerAnalysisAgentKey, base.integration.providerAnalysisAgentKey),
      knowledgeProfile: safeText(integrationSource.knowledgeProfile, base.integration.knowledgeProfile),
      persistMemory: false,
      strictMode: booleanValue(integrationSource.strictMode, base.integration.strictMode),
    },
    updatedAt: positiveNumber(source.updatedAt, base.updatedAt),
    revision: positiveInteger(source.revision, base.revision),
  };
}

export function assistantAgentKeyForScope(settings: AssistantSettingsRecord, scope: "canvas" | "admin" | undefined) {
  return scope === "admin"
    ? settings.integration.backendAssistantAgentKey
    : settings.integration.frontendAssistantAgentKey;
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function positiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveInteger(value: unknown, fallback: number) {
  return Math.floor(positiveNumber(value, fallback));
}
