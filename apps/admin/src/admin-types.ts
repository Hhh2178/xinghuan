import {
  type AssistantChatResult as SharedAssistantChatResult,
  type AssistantMessageBlock,
  type ComfyuiDetectedInput,
  type ComfyuiDetectedOutput,
  type ComfyuiWorkflowDisplayTier,
  type ComfyuiWorkflowExecutionMode,
  type ComfyuiWorkflowInstanceBinding,
  type ComfyuiParserWarning,
  type ComfyuiWorkflowAnalysisResult,
  type ComfyuiWorkflowInputSchemaItem,
  type ComfyuiWorkflowOutputSchemaItem,
  type ComfyuiWorkflowValueKind,
  type ProviderGenerationExecutionMode,
  type TaskQueueSettings,
  type TaskStatus,
} from "@xinghuan/shared";
import type {
  AnnouncementPriority,
  AnnouncementRecord,
  AnnouncementScope,
  AnnouncementStatus,
  AnnouncementType,
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

export type {
  AnnouncementPriority,
  AnnouncementScope,
  AnnouncementStatus,
  AnnouncementType,
};

export type UserRole = "admin" | "member";
export type Capability = "chat" | "image" | "video" | "audio";
export type ResourceKind = "image" | "video" | "audio" | "set" | "pose" | "workflow";
export type ResourceMediaKind = "image" | "video" | "audio";
export type GenerationLibraryKind = "image" | "video" | "audio";
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
  | "aicopy"
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

export interface ResourceCategory {
  id: string;
  kind: ResourceKind;
  name: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export interface SharedResourceItem {
  id: string;
  kind: ResourceKind;
  title: string;
  fileUrl?: string;
  url?: string;
  mime?: string;
  size?: number;
  categoryId?: string;
  tags: string[];
  favorite: boolean;
  note?: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  publishedBy?: string;
  publishedAt?: number;
  workflowFragment?: Record<string, unknown>;
  workflowNodeCount?: number;
  workflowEdgeCount?: number;
  workflowNodeTypes?: string[];
  workflowPreview?: {
    nodes: Array<{ id: string; type: string; label: string; x: number; y: number }>;
    edges: Array<{ source: string; target: string }>;
  };
}

export type ComfyuiInstanceHealth = "online" | "offline" | "degraded" | "unknown";

export interface ComfyuiInstanceRecord {
  id: string;
  name: string;
  tailscaleAddress: string;
  baseUrl: string;
  reportedBaseUrl?: string;
  baseUrlSource?: "manual" | "connector";
  health: ComfyuiInstanceHealth;
  concurrency: number;
  capabilities: string[];
  lastSeenAt: number;
  createdAt: number;
  updatedAt: number;
  note?: string;
  connectorVersion?: string;
}

export interface ComfyuiConnectionTestResult {
  success: boolean;
  latency?: number;
  systemStats?: {
    system?: {
      os?: string;
      python_version?: string;
      embedded_python?: boolean;
    };
    devices?: Array<{
      name?: string;
      type?: string;
      vram_total?: number;
      vram_free?: number;
    }>;
  };
  queueInfo?: {
    running?: number;
    pending?: number;
  };
  error?: string;
  errorDetail?: string;
}

export interface ComfyuiWorkflowFieldDraft {
  key: string;
  nodeId: string;
  fieldName: string;
  label: string;
  source: string;
  kind: ComfyuiWorkflowValueKind;
  required?: boolean;
  value?: unknown;
}

export interface ComfyuiWorkflowOutputDraft {
  key: string;
  label: string;
  kind: "text" | "image" | "video" | "audio";
  sourceNodeId?: string;
  sourceFieldName?: string;
}

export interface ComfyuiWorkflowDraft {
  id: string;
  instanceId: string;
  title: string;
  description?: string;
  workflowJson: Record<string, unknown>;
  analysis: ComfyuiWorkflowAnalysisResult;
  inputSchema: ComfyuiWorkflowInputSchemaItem[];
  exposedFields: ComfyuiWorkflowFieldDraft[];
  defaultValues: Record<string, unknown>;
  hiddenFields: string[];
  outputSchema: ComfyuiWorkflowOutputSchemaItem[];
  instanceBindings: ComfyuiWorkflowInstanceBinding[];
  sharedWorkflowId?: string;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  publishedBy?: string;
}

export type {
  ComfyuiDetectedInput,
  ComfyuiDetectedOutput,
  ComfyuiWorkflowDisplayTier,
  ComfyuiWorkflowExecutionMode,
  ComfyuiWorkflowInstanceBinding,
  ComfyuiParserWarning,
  ComfyuiWorkflowAnalysisResult,
  ComfyuiWorkflowInputSchemaItem,
  ComfyuiWorkflowOutputSchemaItem,
  ComfyuiWorkflowValueKind,
};

export interface GenerationLibraryItem {
  id: string;
  kind: GenerationLibraryKind;
  title: string;
  url: string;
  fileUrl: string;
  mime?: string;
  size?: number;
  filename?: string;
  previewUrl?: string;
  downloadUrl?: string;
  openUrl?: string;
  canDownload?: boolean;
  isExpired?: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  taskId?: string;
  providerId?: string;
  modelId?: string;
  duplicate?: boolean;
}

export interface AdminSharedResourceDraft {
  title: string;
  categoryId: string;
  tagsText: string;
  note: string;
}

export type AdminSharedResourcePreviewKind = ResourceMediaKind | "other";

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
  sortOrder: number;
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
  rhKeyPool?: RunningHubKeyPoolItem[];
  msLoras: ModelScopeLora[];
  note: string;
  updatedAt: number;
}

export interface RunningHubKeyPoolItem {
  id: string;
  note: string;
  apiKeyPreview: string;
  maxConcurrency: number;
  enabled: boolean;
  isDefault: boolean;
  currentInFlight?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdminAnnouncementUpsertPayload {
  title: string;
  summary: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  status?: AnnouncementStatus;
  scope: AnnouncementScope;
  pinned: boolean;
  strongReminder: boolean;
  popupEnabled: boolean;
  versionTag?: string;
  publishedAt?: number;
  expireAt?: number;
}

export interface AdminAnnouncementRecord extends AnnouncementRecord {}

export interface RunningHubEntry {
  id: string;
  title: string;
  note?: string;
  thumbnail?: string;
  enabled: boolean;
  kind?: "app" | "workflow";
  pageId?: string;
  appId?: string;
  workflowId?: string;
  runTargetId?: string;
  allowsEmptyInputs?: boolean;
  taskCapability?: "image" | "video" | "audio" | "chat";
  workflowJson?: string;
  fields?: RunningHubFieldDefinition[];
}

export interface RunningHubAdminEditorMetadata {
  parameterSchema?: string;
  outputSchema?: RunningHubOutputDefinition[];
  executionRules?: RunningHubExecutionRules;
  testPayload?: string;
}

export interface RunningHubAdminItem extends RunningHubEntry, RunningHubAdminEditorMetadata {
  providerId: string;
  providerName: string;
  catalogId: string;
}

export interface RunningHubAdminItemsResponse {
  items: RunningHubAdminItem[];
}

export interface RunningHubAdminItemCreatePayload extends RunningHubAdminEditorMetadata {
  providerId: string;
  kind: "app" | "workflow";
  title?: string;
  note?: string;
  sourceCatalogId?: string;
  enabled?: boolean;
  thumbnail?: string;
  workflowJson?: string;
  fields?: RunningHubFieldDefinition[];
  pageId?: string;
  appId?: string;
  workflowId?: string;
  runTargetId?: string;
  taskCapability?: "image" | "video" | "audio" | "chat";
}

export interface RunningHubAdminItemUpdatePayload extends RunningHubAdminEditorMetadata {
  kind?: "app" | "workflow";
  title?: string;
  note?: string;
  enabled?: boolean;
  thumbnail?: string;
  workflowJson?: string;
  fields?: RunningHubFieldDefinition[];
  pageId?: string;
  appId?: string;
  workflowId?: string;
  runTargetId?: string;
  taskCapability?: "image" | "video" | "audio" | "chat";
}

export interface RunningHubAdminItemTestResult {
  ok: boolean;
  message: string;
  checkedAt: number;
  requestPreview?: Record<string, unknown>;
  responsePreview?: Record<string, unknown>;
}

export interface RunningHubAnalyzeDraftSection {
  key: string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
}

export interface RunningHubAnalyzeDraft {
  summary: string;
  sections: RunningHubAnalyzeDraftSection[];
  warnings: string[];
  detectedKind?: "app" | "workflow";
  detectedTargetId?: string;
  autoSwitchMessage?: string;
  driftSummary?: string[];
}

export interface RunningHubAnalyzePayload {
  providerId: string;
  kind: "app" | "workflow";
  sourceUrl?: string;
  pageId?: string;
  runTargetId?: string;
  docUrl?: string;
  requestExample?: string;
  responseExample?: string;
  notes?: string;
}

export interface RunningHubFieldDefinition {
  nodeId: string;
  fieldName: string;
  label?: string;
  displayLabel?: string;
  description?: string;
  fieldType?: string;
  valueType?: string;
  placeholder?: string;
  required?: boolean;
  fieldValue?: string | number | boolean;
  defaultValue?: string | number | boolean;
  options?: Array<string | number>;
}

export interface RunningHubOutputDefinition {
  key: string;
  label: string;
  kind: string;
  path?: string;
  multiple?: boolean;
}

export interface RunningHubExecutionRules {
  submitMode: "direct";
  targetType: "app" | "workflow";
  method: "POST";
  endpoint: string;
  resultPath: string;
  errorPath: string;
  acceptsUploads: boolean;
  acceptsRemoteUrls: boolean;
  outputKind: "remote-url";
  supportsMultipleOutputs: boolean;
  pollingStrategy: "none" | "fixed-interval";
  pollingIntervalMs: number;
  pollingTimeoutMs?: number;
  retryable: boolean;
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
  sortOrder: number;
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

export interface ModelPricingRecord {
  id: string;
  modelId: string;
  providerId: string;
  enabled: boolean;
  billingUnit: "per_request" | "per_second";
  unitPrice: string;
  currency: string;
  note: string;
  effectiveFrom: number;
  createdAt: number;
}

export interface AdminCostRankingRow {
  id: string;
  label: string;
  amount: string;
  chargedTasks: number;
}

export interface AdminCostSummary {
  range: { from: number; to: number };
  currency: string;
  totals: {
    amount: string;
    chargedTasks: number;
    billedRequests: number;
    billedSeconds: number;
    unpricedTasks: number;
  };
  providers: AdminCostRankingRow[];
  models: AdminCostRankingRow[];
  groups: AdminCostRankingRow[];
  accounts: AdminCostRankingRow[];
  daily: Array<{ day: string; amount: string; chargedTasks: number }>;
}

export interface VideoDurationRange {
  min: number;
  max: number;
  step: number;
  default: number;
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
  displayStatus?: string;
  displayMessage?: string;
  displayTone?: "muted" | "warning" | "success" | "danger";
  runtimeStage?: string;
  providerState?: string;
  logs: string[];
  createdAt?: number;
  updatedAt: number;
  finalizedAt?: number;
}

export interface TaskListPage {
  items: TaskRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  windowLimit: number;
  windowSize: number;
  truncated: boolean;
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
      capability: "image" | "audio" | "video" | "chat";
      queue: string;
      concurrency: number;
      userConcurrency?: number;
      depth?: number;
      effectiveConcurrency?: number;
      workerCount?: number;
      slotCount?: number;
    }>;
    runninghub?: {
      concurrency: number;
      enabled: boolean;
      activeWindowCount?: number;
    };
    error: string;
  };
  observability: {
    environment?: string;
    generatedAt?: number;
    freshness?: { status: "fresh" | "stale" | "unknown"; generatedAt?: number };
    range?: { key: "1h" | "24h" | "7d" | "30d"; bucket: "minute" | "hour" | "day"; durationMs: number; from: number; to: number };
    tasks: {
      total: number;
      queued: number;
      running: number;
      succeeded: number;
      failed: number;
      cancelled: number;
      failedLast1h: number;
      failedLast24h: number;
      finalizedLast24h: number;
      failedLast7d: number;
      finalizedLast7d: number;
      failedLast30d: number;
      finalizedLast30d: number;
      health: {
        status: "healthy" | "warning" | "critical" | "unknown";
        summary: string;
        reason?: string;
        sampleSize?: number;
        failureRatePercent?: number;
        baselinePercent?: number;
        thresholdPercent?: number;
      };
      trend: {
        failed24hDailyAverageBaseline: number;
        failed30dDailyAverageBaseline: number;
        failed24hVs7dDailyAverage: number;
        failed24hVs30dDailyAverage: number;
        failed7dDailyAverage: number;
        failed7dVs30dDailyAverage: number;
        failureRate24hPercent?: number;
        failureRate7dPercent?: number;
        failureRate30dPercent?: number;
      };
      range?: { key: "1h" | "24h" | "7d" | "30d"; bucket: "minute" | "hour" | "day"; durationMs: number; from: number; to: number };
      series?: Array<{ at: number; succeeded: number; failed: number; cancelled: number }>;
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
        distinctTargetsLast24h: number;
        distinctActorsLast24h: number;
        canvasRevisionLast24h: number;
        resourceRevisionLast24h: number;
        adminSettingsRevisionLast24h: number;
        health: {
          status: "healthy" | "warning" | "critical";
          summary: string;
          reason?: "no_conflicts" | "conflicts_observed" | "above_baseline" | "baseline_regression";
          baselineCount?: number;
          warningThresholdCount?: number;
          criticalThresholdCount?: number;
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
    queueConsistency?: {
      databaseQueued: number;
      redisQueued: number;
      mismatch: number;
      status: "healthy" | "warning";
      summary: string;
    };
    alerts: {
      activeCount: number;
      highestSeverity: "healthy" | "info" | "warning" | "critical";
      items: Array<{
        code: string;
        severity: "info" | "warning" | "critical";
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

export type UsageCapability =
  | "image"
  | "video"
  | "runninghub_app"
  | "runninghub_workflow"
  | "llm"
  | "audio"
  | "unknown";

export interface UsageGroupRow {
  groupId: string;
  groupName: string;
  memberCount: number;
  total: number;
  image: number;
  video: number;
  runninghubApp: number;
  runninghubWorkflow: number;
  llm: number;
  audio: number;
  topModelName?: string;
  topRunningHubEntryTitle?: string;
}

export interface UsageUserRow {
  userId: string;
  email: string;
  name: string;
  remark?: string;
  groupId?: string;
  groupName?: string;
  ownerDeleted?: boolean;
  total: number;
  image: number;
  video: number;
  runninghubApp: number;
  runninghubWorkflow: number;
  llm: number;
  audio: number;
  topModelName?: string;
  topRunningHubEntryTitle?: string;
}

export interface UsageModelRow {
  capability: "image" | "video" | "llm" | "audio";
  providerId: string;
  providerName: string;
  modelRecordId: string;
  modelId: string;
  displayName: string;
  total: number;
  topGroupName?: string;
  topUserEmail?: string;
}

export interface UsageRunningHubEntryRow {
  kind: "app" | "workflow";
  providerId: string;
  providerName: string;
  catalogId: string;
  title: string;
  runTargetId: string;
  total: number;
  topGroupName?: string;
  topUserEmail?: string;
}

export interface UsageDailyRow {
  day: string;
  image: number;
  video: number;
  runninghubApp: number;
  runninghubWorkflow: number;
  llm: number;
  audio: number;
  total: number;
}

export interface UsageSelectedUserModelRow {
  capability: "image" | "video" | "llm" | "audio";
  providerId: string;
  providerName: string;
  modelRecordId: string;
  modelId: string;
  displayName: string;
  total: number;
  lastUsedAt?: number;
}

export interface UsageSelectedUserRunningHubRow {
  kind: "app" | "workflow";
  providerId: string;
  providerName: string;
  catalogId: string;
  title: string;
  runTargetId: string;
  total: number;
  lastUsedAt?: number;
}

export interface UsageSelectedUserSummary {
  userId: string;
  email: string;
  name: string;
  remark?: string;
  groupId?: string;
  groupName?: string;
  ownerDeleted?: boolean;
  successful: number;
  lastSucceededAt?: number;
  modelBreakdown: UsageSelectedUserModelRow[];
  runningHubBreakdown: UsageSelectedUserRunningHubRow[];
}

export interface AdminUsageSummary {
  range: { from: number; to: number };
  totals: {
    successful: number;
    image: number;
    video: number;
    runninghubApp: number;
    runninghubWorkflow: number;
    llm: number;
    audio: number;
    unknown: number;
  };
  groups: UsageGroupRow[];
  users: UsageUserRow[];
  models: UsageModelRow[];
  runningHubEntries: UsageRunningHubEntryRow[];
  daily: UsageDailyRow[];
  selectedUser?: UsageSelectedUserSummary;
}

export interface GroupPermissionDeny {
  sharedResourceCategoryIds: string[];
  sharedResourceItemIds: string[];
  runningHubAppCatalogIds: string[];
  runningHubWorkflowCatalogIds: string[];
  nodeTypes: string[];
}

export interface AdminGroupPermissionPolicy {
  groupId: string;
  groupName?: string;
  memberCount: number;
  deny: GroupPermissionDeny;
  updatedAt: number;
  updatedBy?: string;
}

export interface EffectivePermissions {
  groupId: string;
  isAdmin: boolean;
  deny: GroupPermissionDeny;
}

export interface PermissionNodeType {
  id: string;
  label: string;
  group: string;
  description?: string;
}

export interface AdminPermissionCatalog {
  userGroups: AdminUserGroup[];
  sharedResourceCategories: ResourceCategory[];
  sharedResourceItems: SharedResourceItem[];
  runningHubApps: RunningHubAdminItem[];
  runningHubWorkflows: RunningHubAdminItem[];
  nodeTypes: PermissionNodeType[];
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
  mode: "agent" | "fallback";
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
  idempotencyKey?: string;
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
  runtime: "internal";
  assistantAgentKey: string;
  providerAnalysisAgentKey: string;
  knowledgeProfile: string;
  persistMemory: false;
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
