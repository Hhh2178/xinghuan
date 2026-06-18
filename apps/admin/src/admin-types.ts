import { type AssistantChatResult as SharedAssistantChatResult, type AssistantMessageBlock, type ProviderGenerationExecutionMode, type TaskQueueSettings, type TaskStatus } from "@xinghuan/shared";
import type {
  EnvironmentSyncProviderModelSummary,
  EnvironmentSyncApplyItem,
  EnvironmentSyncApplyRequest,
  EnvironmentSyncApplyResponse,
  EnvironmentSyncApplyResultRow,
  EnvironmentSyncDecision,
  EnvironmentSyncDiffState,
  EnvironmentSyncObjectKind,
  EnvironmentSyncPreviewResponse,
  EnvironmentSyncPreviewRow,
  EnvironmentSyncTarget,
} from "@xinghuan/shared";
import type { AdminTabId } from "./admin-view-model";

export type UserRole = "admin" | "member";
export type Capability = "chat" | "image" | "video" | "audio";
export type ModelCapabilityTag =
  | "text_chat"
  | "image_understanding"
  | "video_understanding"
  | "audio_understanding"
  | "reasoning"
  | "long_context"
  | "web_search"
  | "image_generation"
  | "image_edit"
  | "video_generation"
  | "tts"
  | "voice_design"
  | "voice_clone"
  | "music_generation"
  | "audio_cover"
  | "audio_extend";
export type ProviderProtocol =
  | "openai"
  | "gemini"
  | "runninghub"
  | "volcengine"
  | "apimart"
  | "modelscope"
  | "custom"
  | "grsai_draw";
export type TabId = AdminTabId;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AdminUserGroup {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdminUser extends AuthUser {
  groupId?: string;
  groupName?: string;
  remark: string;
  disabled: boolean;
  passwordAvailable: boolean;
  password: string;
  createdAt: number;
  updatedAt: number;
}

export interface AdminSessionRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  ip: string;
  userAgent: string;
  revokedAt?: number;
  current: boolean;
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
  capabilityTags?: ModelCapabilityTag[];
  testState?: ModelTestState;
  enabled: boolean;
  executionMode?: ProviderGenerationExecutionMode;
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
  videoReference?: boolean;
}

export interface ModelTestResult {
  ok: boolean;
  status: number;
  message: string;
  checkedAt: number;
  latencyMs?: number;
  inferredTags?: ModelCapabilityTag[];
  sampleOutput?: string;
}

export interface ModelTestState {
  chat?: ModelTestResult;
  imageUnderstanding?: ModelTestResult;
  videoUnderstanding?: ModelTestResult;
  imageGeneration?: ModelTestResult;
  videoGeneration?: ModelTestResult;
  audioGeneration?: ModelTestResult;
  voiceClone?: ModelTestResult;
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
  audioModels: string[];
  modelTags?: Record<string, ModelCapabilityTag[]>;
}

export interface TaskRecord {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRemark?: string;
  ownerGroupId?: string;
  ownerGroupName?: string;
  ownerDeleted?: boolean;
  providerId?: string;
  modelId?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  logs: string[];
  createdAt?: number;
  updatedAt: number;
}

export interface TaskListPage {
  items: TaskRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  filters: {
    status: string;
    providerId: string;
    capability: string;
  };
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
    currentDatabase?: string;
    expectedDatabase?: string;
    targetMatched?: boolean;
  };
  redis: {
    configured: boolean;
    status: string;
    queue: string;
    depth: number;
    queues?: Array<{
      capability: "image" | "audio" | "video";
      queue: string;
      concurrency: number;
      depth?: number;
    }>;
    error: string;
  };
  observability: {
    tasks: {
      total: number;
      queued: number;
      running: number;
      succeeded: number;
      failed: number;
      cancelled: number;
      failedLast1h: number;
      failedLast24h: number;
      failedLast7d: number;
      failedLast30d: number;
      health: {
        status: "healthy" | "warning" | "critical";
        summary: string;
      };
      trend: {
        failed24hDailyAverageBaseline: number;
        failed30dDailyAverageBaseline: number;
        failed24hVs7dDailyAverage: number;
        failed24hVs30dDailyAverage: number;
        failed7dDailyAverage: number;
        failed7dVs30dDailyAverage: number;
      };
    };
    audits: {
      total: number;
      sampled: number;
      withRequestId: number;
      requestIdCoveragePercent: number;
      sampledLast24h: number;
      withRequestIdLast24h: number;
      requestIdCoverageLast24hPercent: number;
      sampledLast7d: number;
      withRequestIdLast7d: number;
      requestIdCoverageLast7dPercent: number;
      coverageHealth: {
        status: "healthy" | "warning" | "critical";
        summary: string;
      };
      coverageTrend: {
        requestIdCoverageLast24hVsLatestSample: number;
        requestIdCoverageLast7dVsLatestSample: number;
      };
      conflicts: {
        totalLast24h: number;
        totalLast7d: number;
        totalLast30d: number;
        canvasRevisionLast24h: number;
        resourceRevisionLast24h: number;
        adminSettingsRevisionLast24h: number;
        health: {
          status: "healthy" | "warning" | "critical";
          summary: string;
        };
        trend: {
          total7dDailyAverageBaseline: number;
          total30dDailyAverageBaseline: number;
          total24hVs7dDailyAverage: number;
          total24hVs30dDailyAverage: number;
        };
      };
      latestCreatedAt?: number;
    };
    alerts: {
      activeCount: number;
      highestSeverity: "healthy" | "warning" | "critical";
      items: Array<{
        code: string;
        severity: "warning" | "critical";
        source: string;
        summary: string;
        action: string;
      }>;
    };
  };
  taskQueueSettings: TaskQueueSettings;
  taskQueueSettingsRevision: number;
  taskQueueSettingsUpdatedAt: number;
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
  requestId?: string;
  ip?: string;
  userAgent?: string;
  createdAt: number;
}

export interface AssistantAnalysisRequest {
  providerName?: string;
  baseUrl?: string;
  protocolHint?: string;
  capability?: Capability;
  modelId?: string;
  docUrl?: string;
  docUrls?: string[];
  sampleRequest?: string;
  sampleResponse?: string;
  asyncTemplate?: string;
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
    executionMode?: ProviderGenerationExecutionMode;
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
  executionMode?: ProviderGenerationExecutionMode;
  chainTemplate?: string;
  chainTemplateVersion?: string;
  docFetch: {
    attempted: boolean;
    ok: boolean;
    status?: number;
    excerpt?: string;
    error?: string;
    items?: Array<{
      url: string;
      ok: boolean;
      status?: number;
      excerpt?: string;
      error?: string;
    }>;
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

export interface AssistantChatResult extends SharedAssistantChatResult {}

export type { AssistantMessageBlock };

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
  revision: number;
}

export interface PublicAssistantSettings {
  frontend: AssistantFrontendSettings;
  integration: AssistantIntegrationSettings;
  updatedAt: number;
  revision: number;
}

export type {
  EnvironmentSyncProviderModelSummary,
  EnvironmentSyncTarget,
  EnvironmentSyncObjectKind,
  EnvironmentSyncDiffState,
  EnvironmentSyncDecision,
  EnvironmentSyncPreviewRow,
  EnvironmentSyncPreviewResponse,
  EnvironmentSyncApplyItem,
  EnvironmentSyncApplyRequest,
  EnvironmentSyncApplyResultRow,
  EnvironmentSyncApplyResponse,
};

export type ConfirmAction = {
  title: string;
  message: string;
  detail: string;
  confirmLabel: string;
  tone: "danger" | "warning";
  onConfirm: () => Promise<void>;
};
