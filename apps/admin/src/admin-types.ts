import { type TaskStatus } from "@xinghuan/shared";
import type { AdminTabId } from "./admin-view-model";

export type UserRole = "admin" | "member";
export type Capability = "chat" | "image" | "video";
export type ProviderProtocol =
  | "openai"
  | "gemini"
  | "runninghub"
  | "volcengine"
  | "apimart"
  | "custom"
  | "grsai_draw";
export type TabId = AdminTabId;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AdminUser extends AuthUser {
  disabled: boolean;
  passwordAvailable: boolean;
  password: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderRecord {
  id: string;
  name: string;
  baseUrl: string;
  protocol: ProviderProtocol;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyPreview: string;
  lastProbeStatus: string;
  lastProbeMessage: string;
  lastFetchedAt: number;
  rhApps: RunningHubEntry[];
  rhWorkflows: RunningHubEntry[];
  msLoras: ModelScopeLora[];
  note: string;
  updatedAt: number;
}

export interface RunningHubEntry {
  id: string;
  title: string;
  note?: string;
  thumbnail?: string;
  enabled: boolean;
  kind?: "app" | "workflow";
  appId?: string;
  workflowId?: string;
  runTargetId?: string;
  workflowJson?: string;
  fields?: RunningHubFieldDefinition[];
}

export interface RunningHubFieldDefinition {
  nodeId: string;
  fieldName: string;
  label?: string;
  description?: string;
  fieldType?: string;
  valueType?: string;
  placeholder?: string;
  required?: boolean;
  fieldValue?: string | number | boolean;
  defaultValue?: string | number | boolean;
  options?: Array<string | number>;
}

export interface ModelScopeLora {
  id: string;
  name?: string;
  targetModel: string;
  strength: number;
  enabled: boolean;
  note?: string;
}

export interface ModelRecord {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capability: Capability;
  enabled: boolean;
  inputProfile: string;
  inputCapabilities?: ModelInputCapabilities;
  parameterSchema: string;
  advancedConfig?: Record<string, unknown>;
  protocolOverride?: string;
  updatedAt: number;
}

export interface ModelInputCapabilities {
  prompt?: boolean;
  imageReference?: boolean;
  multiImage?: boolean;
  firstFrame?: boolean;
  lastFrame?: boolean;
  mask?: boolean;
  audioReference?: boolean;
}

export interface FetchModelsResult {
  ok: boolean;
  status: number;
  message: string;
  modelCount: number;
  total: number;
  all: string[];
  chatModels: string[];
  imageModels: string[];
  videoModels: string[];
}

export interface TaskRecord {
  id: string;
  title: string;
  status: TaskStatus;
  providerId?: string;
  modelId?: string;
  logs: string[];
  updatedAt: number;
}

export interface Summary {
  users: number;
  enabledUsers: number;
  providers: number;
  enabledProviders: number;
  models: number;
  enabledModels: number;
  tasks: number;
  runningTasks: number;
  auditLogs: number;
  environment: string;
  storage: {
    canvases: number;
    resources: number;
    inputFiles: number;
    outputFiles: number;
  };
}

export interface SystemInfo {
  environment: string;
  dataDir: string;
  storageDriver: string;
  database: {
    configured: boolean;
    status: string;
    serverTime?: string;
    migrations: string[];
    error: string;
  };
  redis: {
    configured: boolean;
    status: string;
    queue: string;
    depth: number;
    error: string;
  };
  authDbPath: string;
  adminDbPath: string;
  service: string;
  version: string;
  storage: Summary["storage"];
}

export interface AuditRecord {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: number;
}

export interface AssistantAnalysisRequest {
  providerName?: string;
  baseUrl?: string;
  protocolHint?: string;
  capability?: Capability;
  modelId?: string;
  docUrl?: string;
  sampleRequest?: string;
  sampleResponse?: string;
  notes?: string;
}

export interface AssistantDraft {
  provider: {
    name: string;
    baseUrl: string;
    protocol: string;
    note: string;
  };
  model: {
    modelId: string;
    displayName: string;
    capability: Capability;
    inputProfile: string;
    inputCapabilities: ModelInputCapabilities;
    parameterSchema: string;
    advancedConfig: Record<string, unknown>;
  };
}

export interface AssistantAnalysisResult {
  mode: "hermes" | "fallback";
  summary: string;
  recommendedLayer: "default" | "advanced" | "adapter";
  protocol: string;
  asyncTask: boolean;
  docFetch: {
    attempted: boolean;
    ok: boolean;
    status?: number;
    excerpt?: string;
    error?: string;
  };
  probe: {
    attempted: boolean;
    ok: boolean;
    status?: number;
    error?: string;
  };
  drafts: AssistantDraft;
  risks: string[];
  checklist: string[];
  rawAssistant: string;
}

export interface AssistantChatAttachment {
  id?: string;
  kind?: string;
  title?: string;
  summary?: string;
  payload?: Record<string, unknown>;
}

export interface AssistantChatRequest {
  message?: string;
  attachments?: AssistantChatAttachment[];
  scope?: "canvas" | "admin";
  conversationId?: string;
}

export interface AssistantChatResult {
  mode: "hermes" | "fallback";
  message: string;
  rawAssistant: string;
}

export interface AssistantProcessEntry {
  label: string;
  content: string;
}

export interface AssistantFrontendSettings {
  enabled: boolean;
  title: string;
  hint: string;
  placeholder: string;
  allowWorkflowAttachment: boolean;
  allowNodeAttachment: boolean;
  allowMediaAttachment: boolean;
  persistMemory: false;
}

export interface AssistantBackendSettings {
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

export interface AssistantIntegrationSettings {
  kernel: "hermes" | "fallback";
  endpoint: string;
  endpointConfigured?: boolean;
  workspace: string;
  model: string;
  profile: string;
  persistMemory: boolean;
  strictMode: boolean;
}

export interface AssistantSettings {
  frontend: AssistantFrontendSettings;
  backend: AssistantBackendSettings;
  integration: AssistantIntegrationSettings;
  updatedAt: number;
}

export interface PublicAssistantSettings {
  frontend: AssistantFrontendSettings;
  integration: AssistantIntegrationSettings;
  updatedAt: number;
}

export type ConfirmAction = {
  title: string;
  message: string;
  detail: string;
  confirmLabel: string;
  tone: "danger" | "warning";
  onConfirm: () => Promise<void>;
};
