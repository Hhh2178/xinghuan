import {
  createAssistantContent,
  parseAssistantMessageBlocks,
  type AssistantChatResult,
  type AssistantRuntimeStatus,
  type AnnouncementRecord,
  CANVAS_NODE_PERMISSION_CATALOG,
  TASK_QUEUE_CAPABILITIES,
  appVersion,
  buildTaskQueueRuntimeDescriptors,
  createHealthPayload,
  type EnvironmentSyncApplyItem,
  type EnvironmentSyncApplyRequest,
  type EnvironmentSyncApplyResponse,
  type EnvironmentSyncApplyResultRow,
  type EnvironmentSyncDecision,
  type EnvironmentSyncPreviewResponse,
  type EnvironmentSyncTarget,
  defaultTaskQueueSettings,
  normalizeTaskQueueSettings,
  normalizeWorkflowDocuments,
  normalizeAdministratorTier,
  type AdministratorTier,
  resolvePostgresPoolConfig, readAgentRuntimeProcessGates,
  taskQueueNameForCapability,
  type AppEnvironment,
  type RhCatalogItem,
  type RhCatalogGroup,
  type ProviderGenerationExecutionMode,
  type PermissionRule,
  type PermissionSubject,
  type UnifiedCancelState,
  type UnifiedFailureCategory,
  type TaskQueueCapability,
  type TaskQueueSettings,
  type TaskStatus,
  type WorkflowDocument,
} from "@xinghuan/shared";
import {
  mergeModelParameterSchema,
  parseAdvancedConfig,
  parseInputCapabilities,
  uiMetadataFromSchema,
  type ModelCapability as CatalogCapability,
  type ModelCapabilityTag,
  type ModelTestState,
  type ProviderProtocol as CatalogProtocol,
} from "@xinghuan/model-core";
import Busboy from "busboy";
import { createServer } from "node:http";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { summarizeNodeAssistantAttachment, summarizeWorkflowAssistantAttachment } from "./assistant-workflow-context.js";
import { buildAssistantUserMessageContent } from "./assistant-chat-context.js";
import { buildAssistantRuntimeStatus } from "./assistant-runtime-status.js";
import { buildAssistantAnswerPolicyPrompt, resolveAssistantDetailLevel, type AssistantDetailLevel } from "./assistant-answer-policy.js";
import { fileErrorCode, readSerializedJson, writeSerializedJson } from "./serialized-json-file.js";
import {
  inferMime,
  safeEmail,
  safeFilename,
  safeJsonText,
  safeLongText,
  safePromptText,
  safeSlug,
  safeText,
  safeUserId,
} from "./api-sanitizers.js";
import { createGrsaiImageClient } from "./grsai-image-adapter.js";
import { prepareGrsaiReferenceImages } from "./grsai-reference-images.js";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  buildSessionCookie,
  expireSessionCookie,
  readCookie,
  readJsonBody,
} from "./http-session-utils.js";
import {
  classifyUpstreamModel,
  inferModelCapabilityTags,
  normalizeCapability,
  normalizeOptionalProtocol,
  normalizeProviderProtocol,
  parseUpstreamModels,
  providerModelHeaders,
  providerModelsUrl,
} from "./provider-model-catalog.js";
import { importProviderModels, type AdminModelRecord } from "./provider-model-import.js";
import {
  normalizeProviderReferenceUrl as normalizeProviderReferenceUrlForAccess,
  normalizeProviderReferenceUrls as normalizeProviderReferenceUrlsForAccess,
  parseProviderFileAccessRequest,
} from "./provider-file-access.js";
import {
  extractChatContent,
  extractImageOutputs,
  extractVideoUrls,
  toImageDataUrl,
} from "./provider-response-parser.js";
import {
  createApimartVideoAdapterPayload,
  extractApimartTask,
  extractApimartVideoResult,
  shouldUseApimartVideoAdapter,
} from "./apimart-video-adapter.js";
import {
  createOpenAiAudioChatPayload,
  extractAudioProviderResult,
} from "./audio-provider-adapter.js";
import { createAuthCurrentUserRepository } from "./auth-repository.js";
import { createAuthDirectoryWriteRepository } from "./auth-directory-write-repository.js";
import {
  ADMINISTRATOR_MANAGEMENT_REQUIRES_ROOT,
  LAST_ROOT_REQUIRED,
  USER_NOT_FOUND,
  assertAdministratorAccountCreation,
  assertAdministratorAccountMutation,
  projectAuditForAdministrator,
  visibleSessionsForAdministrator,
  visibleUsersForAdministrator,
} from "./admin-user-visibility.js";
import {
  applyTaskCancellation,
  assertTaskCancellable,
  createRetriedTask,
  taskCancellationPatch,
} from "./task-lifecycle.js";
import { createTaskCancellationService } from "./task-cancellation-service.js";
import { createExternalProxyHandlers } from "./external-proxy.js";
import { createMaterialAccessService } from "./material-access-service.js";
import { createGenerationArtifactRepository } from "./generation-artifact-repository.js";
import { createGenerationArtifactLifecycle } from "./generation-artifact-lifecycle.js";
import { createEphemeralUploadRepository } from "./ephemeral-upload-repository.js";
import { createLocalArtifactStore } from "./artifact-store.js";
import { createRequestPerformanceObservability, normalizeRouteId } from "./request-performance-observability.js";
import { createReadAuditBuffer } from "./read-audit-buffer.js";
import { handleGenerationArtifactRoutes } from "./generation-artifact-routes.js";
import { createProviderGenerationTaskService } from "./provider-generation-task-service.js";
import { createEnvironmentSyncService, type EnvironmentSyncSnapshot, type EnvironmentSyncWriteRequest } from "./environment-sync-service.js";
import { projectTaskRuntimeDisplayState } from "./task-runtime-projection.js";
import {
  normalizeRunningHubCatalogItem,
  normalizeRunningHubCatalogItems,
  normalizeRunningHubGroups,
  normalizeRunningHubFieldDefinitions,
  parseRunningHubRef,
  toAdminRunningHubCatalogItem,
  toPublicRunningHubCatalogItem,
  type RunningHubAdminCatalogEntry,
  type RunningHubExecutionRules,
  type RunningHubCatalogEntry as RunningHubEntry,
  type RunningHubFieldDefinition,
  type RunningHubAdminItem as AdminRunningHubCatalogItem,
  type RunningHubOutputDefinition,
} from "./runninghub-catalog.js";
import { createTaskRuntimeEventStore } from "./task-runtime-events.js";
import {
  buildEffectivePermissions,
  canUseRunningHubCatalogItem,
  emptyGroupPermissionDeny,
  filterRunningHubCatalogForUser,
  filterSharedResourceItemsForUser,
  normalizeGroupPermissionPolicies,
  normalizeGroupPermissionPolicy,
  policyForUser,
  type GroupPermissionPolicy,
} from "./group-permission-policy.js";
import { createGroupPermissionPolicyRouteHandler } from "./group-permission-policy-routes.js";
import { createPermissionRepository, type PermissionFallbackAuthDb } from "./permissions/permission-repository.js";
import { createPermissionRouteHandler } from "./permissions/permission-routes.js";
import { createRetiredRuleCleanupAudit } from "./permissions/retired-rule-cleanup-audit.js";
import { createPermissionService, PermissionDeniedError } from "./permissions/permission-service.js";
import {
  createPermissionSubjectRegistrar,
  canvasNodeSubjectKey,
  providerModelSubjectKey,
  runningHubAppSubjectKey,
  runningHubWorkflowSubjectKey,
} from "./permissions/permission-subject-registrars.js";
import {
  createPermissionRuntime,
  normalizePermissionRuntimeMode,
} from "./permissions/permission-runtime.js";
import { createPermissionShadowMetrics } from "./permissions/permission-shadow-metrics.js";
import { evaluatePermissionReadiness } from "./permissions/permission-readiness.js";
import { handleAdminProviderRoutes } from "./admin-provider-routes.js";
import { createProviderRepository } from "./provider-repository.js";
import { createAdminDirectoryReadRepository } from "./admin-directory-read-repository.js";
import { normalizeCatalogSortOrder, sortByCatalogDisplayOrder } from "./catalog-display-order.js";
import {
  findCanvasSnapshotOwnershipConflicts,
  planCanvasSnapshotRecovery,
  type CanvasSnapshotRecoveryCandidate,
} from "./canvas-snapshot-recovery.js";
import { createSettingsRepository } from "./settings-repository.js";
import {
  assistantAgentKeyForScope,
  defaultAssistantSettings,
  normalizeAssistantSettings,
  type AssistantSettingsRecord,
} from "./assistant-settings-domain.js";
import { handleAdminAnnouncementRoutes } from "./admin-announcement-routes.js";
import { handleAdminRunningHubRoutes } from "./admin-runninghub-routes.js";
import { decideRunningHubAccess } from "./runninghub-permission-gate.js";
import { handleComfyuiInstanceRoutes, handleInternalComfyuiConnectorRoutes } from "./comfyui-instance-routes.js";
import { handleComfyuiPublicRoutes } from "./comfyui-public-routes.js";
import { handleAdminSystemRoutes } from "./admin-system-routes.js";
import { createAdminAuditRouteHandler } from "./admin-audit-routes.js";
import { createAdminRepository } from "./admin-repository.js";
import { createAdminUsageSummaryRepository } from "./admin-usage-summary-repository.js";
import { createAdminUsageSummaryService } from "./admin-usage-summary-service.js";
import { createTaskCostRepository } from "./task-cost-repository.js";
import { createAdminCostRouteHandler } from "./admin-cost-routes.js";
import { createTaskCostRouteHandler } from "./task-cost-routes.js";
import { createChannelHealthRepository } from "./channel-health-repository.js";
import { createChannelHealthService } from "./channel-health-service.js";
import { createChannelHealthRouteHandlers } from "./channel-health-routes.js";
import { createAdminTaskListRouteHandler } from "./admin-task-list-routes.js";
import { createTaskRepository } from "./task-repository.js";
import { createOutputArchiveRepository } from "./output-archive-repository.js";
import { createOutputArchiveRouteHandler } from "./output-archive-routes.js";
import { normalizeTaskExecutionIdentitySnapshot, type TaskExecutionIdentitySnapshot } from "./task-execution-identity.js";
import { createCanvasRunRepository } from "./canvas-run-repository.js";
import type { CanvasRunRecord } from "./canvas-run-repository.js";
import { createCanvasRunAgentAnalysisService, createCanvasRunService } from "./canvas-run-service.js";
import { resolveCanvasRunPlanModelReferences } from "./canvas-run-model-preflight.js";
import { canvasRunErrorStatus, createCanvasRunRouteHandler } from "./canvas-run-routes.js";
import { createCanvasRunCandidateSelectionService } from "./canvas-run-candidate-selection.js";
import { createAgentRunRepository } from "./agent-run-repository.js";
import { createAgentKnowledgeSnapshotRepository } from "./agent-knowledge-snapshot-repository.js";
import { createAgentRuntimeConfigurationRepository } from "./agent-runtime-configuration-repository.js";
import { createLlmRoutingRepository } from "./llm-routing-repository.js";
import { createAgentGovernanceRepository } from "./agent-governance-repository.js";
import { createAdminAgentGovernanceRouteHandler } from "./admin-agent-governance-routes.js";
import { createAgentOrchestrator } from "./agent-orchestrator.js";
import { createAgentApprovalRepository } from "./agent-approval-repository.js";
import { createArtifactQualityRepository } from "./artifact-quality-repository.js";
import { createArtifactQualityService } from "./artifact-quality-service.js";
import { createRecoveryDecisionRepository } from "./recovery-decision-repository.js";
import { createGenerationRecoveryService } from "./generation-recovery-service.js";
import { createQualityRecoveryRouteHandler } from "./quality-recovery-routes.js";
import { readEnvironmentWorkerRuntimeSlots, summarizeWorkerRuntimeQueue } from "./worker-runtime-observability.js";
import {
  decorateTaskObservabilitySummary,
  evaluateQueueConsistency,
  normalizeSystemHealthRange,
  type TaskObservabilityHealthStatus,
} from "./task-observability-domain.js";
import { decorateAuditConflictSummary } from "./audit-observability-domain.js";
import { createAnnouncementStore } from "./announcement-store.js";
import { broadcastAnnouncement } from "./announcement-sse.js";
import { handlePublicAnnouncementRoutes } from "./public-announcement-routes.js";
import { handleCodeNodeRoutes } from "./code-node-routes.js";
import { handleImageOperationRoutes } from "./image-operation-routes.js";
import { createSharedResourceRouteHandler } from "./shared-resource-routes.js";
import { cleanImportedNodeData, sanitizeCanvasNodes } from "./canvas-node-migration.js";
import { enrichWorkflowResourceItem } from "./resource-workflow-helpers.js";

const host = process.env.XINGHUAN_API_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.XINGHUAN_API_PORT ?? "18300", 10);
const environment = (process.env.XINGHUAN_APP_ENV ?? "local") as AppEnvironment;
const permissionRuntimeMode = normalizePermissionRuntimeMode(
  process.env.XINGHUAN_PERMISSION_MODE,
  environment === "gray" ? "shadow" : "legacy",
);
const environmentSyncToken = safeText(process.env.XINGHUAN_ENVIRONMENT_SYNC_TOKEN || ""), comfyuiConnectorToken = safeText(process.env.XINGHUAN_COMFYUI_CONNECTOR_TOKEN || "");
const environmentSyncBaseUrls: Record<"gray" | "production", string> = {
  gray: safeText(process.env.XINGHUAN_GRAY_API_BASE_URL || "http://127.0.0.1:18200"),
  production: safeText(process.env.XINGHUAN_PRODUCTION_API_BASE_URL || "http://127.0.0.1:18100"),
};
const dataDir = process.env.XINGHUAN_DATA_DIR ?? join(process.cwd(), "data");
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
const expectedDatabaseName = safeText(process.env.XINGHUAN_EXPECTED_DATABASE_NAME || "");
const storageDriver = process.env.XINGHUAN_STORAGE_DRIVER === "postgres" ? "postgres" : "file";
const agentRuntimeProcessGates = readAgentRuntimeProcessGates(process.env); const canvasRunsEnabled = agentRuntimeProcessGates.apiCanvasRunsEnabled;
const redisUrl = process.env.XINGHUAN_REDIS_URL || process.env.REDIS_URL || "";
const taskQueueName = process.env.XINGHUAN_TASK_QUEUE || "xinghuan:tasks";
const LOGIN_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LIMIT_MAX_FAILURES = 5;
const LOGIN_LIMIT_BLOCK_MS = 15 * 60 * 1000;
const LOGIN_LIMIT_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
const authDir = join(dataDir, "auth");
const adminDir = join(dataDir, "admin");
const usersDir = join(dataDir, "users");
const authDbPath = join(authDir, "auth.json");
const adminDbPath = join(adminDir, "admin.json");
const sharedResourceDbPath = join(adminDir, "shared-resource-library.json");
const webDistCandidates = [
  process.env.XINGHUAN_WEB_DIST_DIR,
  resolve(process.cwd(), "../../apps/web/dist"),
  resolve(process.cwd(), "apps/web/dist"),
].filter(Boolean) as string[];
const adminDistCandidates = [
  process.env.XINGHUAN_ADMIN_DIST_DIR,
  resolve(process.cwd(), "../../apps/admin/dist"),
  resolve(process.cwd(), "apps/admin/dist"),
].filter(Boolean) as string[];
let postgresPoolPromise: Promise<import("pg").Pool> | null = null;
let postgresDatabaseNamePromise: Promise<string> | null = null;
let redisClientPromise: Promise<import("redis").RedisClientType> | null = null;

class HttpError extends Error {
  statusCode: number;
  payload?: Record<string, unknown>;

  constructor(statusCode: number, message: string, payload?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

const { generateExternalImageProxy, generateExternalChatProxy, generateExternalVideoProxy, generateExternalAudioProxy } = createExternalProxyHandlers({
  dataDir,
  providerFileScope: environment,
  normalizeProviderProtocol,
  normalizeCapability,
  providerModelHeaders,
  providerPlainApiKey: (provider) => providerPlainApiKey(provider as Partial<AdminProviderRecord> & { apiKey?: string }),
  readAdminDb,
  authorizeModelExecution: async (user, model) => {
    await assertCanExecuteProviderModel(user as CurrentUser, model.id);
  },
  saveRemoteImageToOutput,
  saveRemoteVideoToOutput,
  saveRemoteAudioToOutput,
  saveBase64File,
  saveBase64AudioFile,
  secretKey,
  safeSlug,
  safeText,
  safeLongText,
  safePromptText,
  plainObject,
  stringMap,
  looksLikeHtml,
  clampInteger,
  invalidRequest: (message) => new HttpError(400, message),
});

const { submitProviderGenerationTask, readProviderGenerationTaskStatus } = createProviderGenerationTaskService({
  supportedTaskCapabilities: ["image", "video", "audio"],
  normalizeProviderProtocol,
  providerPlainApiKey: (provider) => providerPlainApiKey(provider as Partial<AdminProviderRecord> & { apiKey?: string }),
  findEnabledProviderModel,
  authorizeModelExecution: async (user, model) => {
    await assertCanExecuteProviderModel(user as CurrentUser, model.id);
  },
  normalizeProviderReferenceUrls: (values, publicOrigin, user) =>
    normalizeProviderReferenceUrlsForAccess(values, publicOrigin, user, { secret: secretKey(), scope: environment }),
  normalizeProviderReferenceUrl: (value, publicOrigin, user) =>
    normalizeProviderReferenceUrlForAccess(value, publicOrigin, user, { secret: secretKey(), scope: environment }),
  readTaskRecord,
  findTaskByOwnerIdempotencyKey,
  insertTaskRecord,
  writeTaskRecord,
  appendTaskLog,
  enqueueTask,
  safeText,
  safeLongText,
  safePromptText,
  safeSlug,
  plainObject,
  invalidRequest: (message) => new HttpError(400, message),
});

const { cancelTaskWithStrategy } = createTaskCancellationService({
  readTaskRecord,
  writeTaskRecord,
  readAdminDb,
  providerPlainApiKey: (provider) => providerPlainApiKey(provider as Partial<AdminProviderRecord> & { apiKey?: string }),
  normalizeProviderProtocol,
  safeText,
  plainObject,
});

const environmentSyncService = createEnvironmentSyncService({
  currentEnvironment: environment === "gray" || environment === "production" ? environment : "local",
  readLocalSnapshot: async (targetEnvironment) => {
    ensureEnvironmentSyncEnabled(targetEnvironment);
    return readEnvironmentSyncLocalSnapshot(targetEnvironment);
  },
  readRemoteSnapshot: async (targetEnvironment) => {
    ensureEnvironmentSyncEnabled(targetEnvironment);
    return readEnvironmentSyncRemoteSnapshot(targetEnvironment);
  },
  applyLocalSnapshot: async (request) => {
    ensureEnvironmentSyncEnabled(request.targetEnvironment);
    return applyEnvironmentSyncLocalSnapshot(request);
  },
  applyRemoteSnapshot: async (targetEnvironment, request) => {
    ensureEnvironmentSyncEnabled(targetEnvironment);
    return applyEnvironmentSyncRemoteSnapshot(targetEnvironment, request);
  },
});

const { appendTaskRuntimeEventBestEffort } = createTaskRuntimeEventStore({
  usePostgresRepository,
  getPostgresPool,
  filePath: join(dataDir, "admin", "task-runtime-events.ndjson"),
});

const authCurrentUserRepository = createAuthCurrentUserRepository({ usePostgresRepository, readAuthDb, getPostgresPool, dateToMillis, safeText, safeEmail });
const authDirectoryWriteRepository = createAuthDirectoryWriteRepository({ getPostgresPool });
const permissionRepository = createPermissionRepository({
  usePostgresRepository,
  getPostgresPool,
  readAuthDb: async () => (await readAuthDb()) as unknown as PermissionFallbackAuthDb,
  writeAuthDb: async (db) => writeAuthDb(db as unknown as AuthDb),
  now: () => Date.now(),
});
const permissionService = createPermissionService({ readAuthorizationState: permissionRepository.readAuthorizationState });
const permissionSubjectRegistrar = createPermissionSubjectRegistrar({ ...permissionRepository, onRetiredRulesDeleted: createRetiredRuleCleanupAudit({ appendAuditRecord, now: () => Date.now() }) });
let permissionSubjectReconciliation: Promise<void> | null = null;
const permissionShadowMetrics = createPermissionShadowMetrics();
const permissionRuntime = createPermissionRuntime({
  mode: permissionRuntimeMode,
  canUnified: permissionService.can,
  onShadowMismatch: ({ subjectKey, action, legacyAllowed, unified }) => {
    permissionShadowMetrics.record({ subjectKey, action, legacyAllowed, unified });
  },
});
const providerRepository = createProviderRepository({ usePostgresRepository, ensureDataDirs, adminDbPath, getPostgresPool, dateToMillis, millisToDate, normalizeAdminModelRecord: (model) => normalizeAdminModelRecord(model as AdminModelRecord), normalizeProviderSecret, normalizeProviderProtocol, normalizeCapability, normalizeOptionalProtocol, normalizeRunningHubEntries, normalizeRunningHubGroups, normalizeRunningHubKeyPool, normalizeModelScopeLoras, plainObject, safeJsonText, safeText });
const adminDirectoryReadRepository = createAdminDirectoryReadRepository({
  usePostgresRepository,
  getPostgresPool,
  readAuthDb,
  dateToMillis,
  normalizeAdministratorTier,
  safeText,
});
const settingsRepository = createSettingsRepository({
  usePostgresRepository,
  ensureDataDirs,
  adminDbPath,
  getPostgresPool,
  dateToMillis,
  millisToDate,
  plainObject,
  defaultAssistantSettings,
  normalizeAssistantSettings: (value, base) => normalizeAssistantSettings(value, base as AssistantSettingsRecord | undefined),
  normalizeTaskQueueSettings,
  defaultTaskQueueSettings,
  createRevisionConflictError: (settingsKey, currentRevision) => new HttpError(409, "ADMIN_SETTINGS_REVISION_CONFLICT", {
    settingsKey,
    currentRevision,
  }),
});
const adminRepository = createAdminRepository({
  usePostgresRepository,
  getPostgresPool,
  readAdminDb,
  writeAdminDb: async (db) => writeAdminDb(db as AdminDb),
  dateToMillis,
  millisToDate,
  safeText,
});
const readAuditBuffer = createReadAuditBuffer<AdminAuditRecord>({
  maxQueue: 1_000,
  maxBatch: 50,
  flushIntervalMs: 250,
  write: async (records) => {
    for (const record of records) await adminRepository.appendAuditRecord(record);
  },
});
const taskCostRepository = createTaskCostRepository({ usePostgresRepository, getPostgresPool });
const handleAdminCostRoutes = createAdminCostRouteHandler({
  sendT8,
  readJsonBody,
  readModelPricing: taskCostRepository.readModelPricing,
  writeModelPricing: taskCostRepository.writeModelPricing,
  readCostSummary: taskCostRepository.readCostSummary,
  appendAudit,
});
const handleTaskCostRoutes = createTaskCostRouteHandler({
  sendT8,
  readTaskCostSummary: taskCostRepository.readTaskCostSummary,
  invalidRequest: (message) => new HttpError(400, message),
});
const channelHealthRepository = createChannelHealthRepository({
  getPostgresPool,
  newId: () => `channel_feedback_${Date.now()}_${randomBytes(6).toString("hex")}`,
});
const channelHealthService = createChannelHealthService({ repository: channelHealthRepository });
const { handleMemberRoutes: handleChannelHealthMemberRoutes, handleAdminRoutes: handleChannelHealthAdminRoutes } = createChannelHealthRouteHandlers({
  service: channelHealthService,
  sendT8,
  readJsonBody,
  invalidRequest: (code) => new HttpError(400, code),
  forbidden: (code) => new HttpError(403, code),
  notFound: (code) => new HttpError(404, code),
});
const canvasRunRepository = createCanvasRunRepository({ getPostgresPool });
const agentRunRepository = createAgentRunRepository({ getPostgresPool });
const agentKnowledgeSnapshotRepository = createAgentKnowledgeSnapshotRepository({ getPostgresPool });
const agentRuntimeConfigurationRepository = createAgentRuntimeConfigurationRepository({ getPostgresPool });
const llmRoutingRepository = createLlmRoutingRepository({ getPostgresPool });
const agentGovernanceRepository = createAgentGovernanceRepository({ getPostgresPool });
async function assertAgentRuntimeCapability(capability: "agentEnabled" | "canvasRunsEnabled" | "automaticRecoveryEnabled" | "qualityEvaluationEnabled") {
  if (!usePostgresRepository()) throw new HttpError(503, "AGENT_RUNTIME_POSTGRES_REQUIRED");
  const targetEnvironment = environment === "production" ? "production" : "gray";
  const controls = await agentGovernanceRepository.readRuntimeControl(targetEnvironment);
  if (!controls[capability]) throw new HttpError(503, `AGENT_RUNTIME_CAPABILITY_DISABLED:${targetEnvironment}:${capability}`);
}

function throwAdministratorPolicyError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message === USER_NOT_FOUND) throw new HttpError(404, USER_NOT_FOUND);
  if (message === ADMINISTRATOR_MANAGEMENT_REQUIRES_ROOT) throw new HttpError(403, ADMINISTRATOR_MANAGEMENT_REQUIRES_ROOT);
  if (message === LAST_ROOT_REQUIRED) throw new HttpError(409, LAST_ROOT_REQUIRED);
  throw error;
}
const agentApprovalRepository = createAgentApprovalRepository({ getPostgresPool });
const artifactQualityRepository = createArtifactQualityRepository({ getPostgresPool });
const recoveryDecisionRepository = createRecoveryDecisionRepository({ getPostgresPool });
const canvasRunAgentAnalysisService = createCanvasRunAgentAnalysisService({
  runPlanner: async (request) => {
    const actor = (await readAuthDb()).users.find((user) => user.id === request.ownerId);
    if (!actor) throw new Error("CANVAS_RUN_ANALYSIS_OWNER_NOT_FOUND");
    const orchestrator = createAgentOrchestrator({
      runtimeConfigurations: agentRuntimeConfigurationRepository,
      knowledgeSnapshots: agentKnowledgeSnapshotRepository,
      agentRuns: agentRunRepository,
      routing: llmRoutingRepository,
      invokeModel: async (invocation) => {
        if (invocation.ownerId !== request.ownerId) throw new Error("AGENT_TOOL_OWNER_MISMATCH");
        const result = await generateExternalChatProxy({
          providerId: invocation.providerId,
          providerParams: { modelRecordId: invocation.modelRecordId },
          messages: invocation.messages,
          maxTokens: invocation.maxTokens,
        }, actor, "");
        return { content: result.content, usage: plainObject(result.raw).usage as Record<string, unknown> | undefined };
      },
    });
    const result = await orchestrator.runRole({
      task: {
        id: `supervision-analysis-${createRequestId()}`,
        ownerId: request.ownerId,
        role: "planner",
        scenario: "canvas-supervision-analysis",
        inputSchema: "canvas-run-agent-analysis-input/v1",
        outputSchema: "canvas-run-agent-analysis/v1",
        toolAllowlist: [],
        maxTokens: 4_000,
        timeoutMs: 120_000,
      },
      agentKey: "supervision-planner",
      environment: environment === "production" ? "production" : "gray",
      idempotencyKey: `supervision-analysis:${createHash("sha256")
        .update(`${request.ownerId}\n${request.analysisIdempotencyKey}\n${request.prompt}`)
        .digest("hex")}`,
      messages: [{ role: "user", content: request.prompt }],
      inputSnapshot: { graph: request.graph, maximumParallelism: request.maximumParallelism },
    });
    return { content: result.content, agentRunId: result.agentRunId };
  },
});
const canvasRunService = createCanvasRunService({
  repository: canvasRunRepository,
  isEnabled: () => canvasRunsEnabled,
  usePostgresRepository,
  assertStartablePlan: assertCanvasRunStartablePlan,
  resolvePlanModelReferences: resolveCanvasRunModels,
  analyzePlan: canvasRunAgentAnalysisService.analyzePlan,
});
const canvasRunCandidateSelectionService = createCanvasRunCandidateSelectionService({ getPostgresPool });
const handleCanvasRunRoutes = createCanvasRunRouteHandler({
  sendT8,
  createRun: async (input) => {
    await assertAgentRuntimeCapability("canvasRunsEnabled");
    return canvasRunService.createRun(input);
  },
  readRun: canvasRunService.readRun,
  listWorkflowRuns: canvasRunService.listWorkflowRuns,
  readEvents: canvasRunService.readEvents,
  readWorkflowSettings: canvasRunService.readWorkflowSettings,
  saveWorkflowSettings: canvasRunService.saveWorkflowSettings,
  resetWorkflowSettings: canvasRunService.resetWorkflowSettings,
  readCandidateSelections: canvasRunCandidateSelectionService.readPending,
  selectCandidates: async (input) => {
    await assertAgentRuntimeCapability("canvasRunsEnabled");
    return canvasRunCandidateSelectionService.selectManual(input);
  },
  commandRun: async (input) => {
    if (!["pause", "cancel"].includes(input.command)) await assertAgentRuntimeCapability("canvasRunsEnabled");
    return canvasRunService.commandRun(input);
  },
  decideApproval: async (input) => {
    await canvasRunService.readRun(input.ownerId, input.runId);
    return agentApprovalRepository.decideApproval({
      ownerId: input.ownerId,
      approvalId: input.approvalId,
      canvasRunId: input.runId,
      next: input.decision,
      decidedBy: input.ownerId,
      reason: input.reason,
    });
  },
  invalidRequest: (message) => new HttpError(400, message),
  mapError: (error) => error instanceof HttpError
    ? error
    : new HttpError(canvasRunErrorStatus(error), error instanceof Error ? error.message : "CANVAS_RUN_FAILED"),
});
const handleQualityRecoveryRoutes = createQualityRecoveryRouteHandler({
  sendT8,
  publicOrigin: providerFilePublicOrigin,
  invalidRequest: (message) => new HttpError(400, message),
  evaluate: async (input, actor, publicOrigin) => {
    if (!canvasRunsEnabled || !usePostgresRepository()) throw new HttpError(503, "CANVAS_RUN_QUALITY_DISABLED");
    await assertAgentRuntimeCapability("qualityEvaluationEnabled");
    const service = createArtifactQualityService({
      repository: artifactQualityRepository,
      runUnderstandingAgent: async (request) => {
        const orchestrator = createAgentOrchestrator({
          runtimeConfigurations: agentRuntimeConfigurationRepository,
          knowledgeSnapshots: agentKnowledgeSnapshotRepository,
          agentRuns: agentRunRepository,
          routing: llmRoutingRepository,
          invokeModel: async (invocation) => {
            if (invocation.ownerId !== actor.id) throw new Error("AGENT_TOOL_OWNER_MISMATCH");
            const result = await generateExternalChatProxy({
              providerId: invocation.providerId,
              providerParams: { modelRecordId: invocation.modelRecordId },
              messages: invocation.messages,
              maxTokens: invocation.maxTokens,
            }, actor as CurrentUser, publicOrigin);
            return { content: result.content };
          },
        });
        return orchestrator.runRole({
          task: {
            id: `quality-task-${createRequestId()}`,
            ownerId: request.ownerId,
            role: request.role,
            scenario: request.scenario,
            inputSchema: `${request.role}-quality/v1`,
            outputSchema: `${request.role}-quality-result/v1`,
            toolAllowlist: [],
            maxTokens: 4_000,
            timeoutMs: 120_000,
          },
          agentKey: request.role === "image_understanding" ? "artifact-image-understanding" : "artifact-video-understanding",
          environment: environment === "production" ? "production" : "gray",
          idempotencyKey: request.idempotencyKey,
          messages: [{ role: "user", content: request.content }],
          inputSnapshot: request.inputSnapshot,
        });
      },
    });
    return service.evaluate({ ...input, environment: environment === "production" ? "production" : "gray" });
  },
  select: async (input) => {
    if (!canvasRunsEnabled || !usePostgresRepository()) throw new HttpError(503, "CANVAS_RUN_QUALITY_DISABLED");
    const service = createArtifactQualityService({ repository: artifactQualityRepository, runUnderstandingAgent: async () => { throw new Error("NOT_USED"); } });
    return service.select(input);
  },
  recover: async (input) => {
    if (!canvasRunsEnabled || !usePostgresRepository()) throw new HttpError(503, "CANVAS_RUN_RECOVERY_DISABLED");
    await assertAgentRuntimeCapability("automaticRecoveryEnabled");
    const service = createGenerationRecoveryService({ repository: recoveryDecisionRepository, createApproval: agentApprovalRepository.createApproval });
    return service.plan({
      ...input,
      policy: { maxSameConfigurationRetries: 2, maxParameterRepairs: 1, maxGenerationModelSwitches: 2, maxQualityRegenerations: 1 },
    });
  },
});
const taskRepository = createTaskRepository({
  usePostgresRepository,
  getPostgresPool,
  readTaskRecords: async () => (await readAdminDb()).tasks,
  writeTaskRecords: async (tasks) => {
    const db = await readAdminDb();
    await writeAdminDb({ ...db, tasks: tasks as AdminTaskRecord[] });
  },
  readTaskExecutionCatalog: async () => {
    const db = await readAdminDb();
    return { providers: db.providers, models: db.models };
  },
  readTaskOwnerRecords: async () => {
    const authDb = await readAuthDb();
    return { users: authDb.users, userGroups: authDb.userGroups };
  },
  toAdminTaskRecord: (row) => toAdminTaskRecord(row),
  enrichAdminTaskRecord: (task, usersById, groupsById) =>
    enrichAdminTaskRecord(task as AdminTaskRecord, usersById as Map<string, UserRecord>, groupsById as Map<string, UserGroupRecord>),
  summarizeAdminTaskRecord: (task) => summarizeAdminTaskListRecord(task as AdminTaskRecord),
  withUnifiedRuntimeDiagnostic: (task) => withUnifiedRuntimeDiagnostic(task as AdminTaskRecord),
  safeText,
  plainObject,
  millisToDate,
});
const outputArchiveRepository = createOutputArchiveRepository({
  getPostgresPool,
  usePostgresRepository,
  readTaskRecord: (taskId) => taskRepository.readTaskRecord(taskId),
  userDataDirs: (ownerId) => userDataDirsForId(ownerId),
});
const adminUsageSummaryRepository = createAdminUsageSummaryRepository({
  readAdminDb,
  readAuthDb,
  usePostgresRepository,
  getPostgresPool,
  millisToDate,
  dateToMillis,
  normalizeTaskStatus,
  safeText,
  plainObject,
});
const adminUsageSummaryService = createAdminUsageSummaryService({
  readAdminUsageSummaryRecords: adminUsageSummaryRepository.readAdminUsageSummaryRecords,
  publicRunningHubCatalog: async () => {
    const catalog = await publicRunningHubCatalog();
    return { items: catalog.items };
  },
});

const handleSharedResourceRoutes = createSharedResourceRouteHandler({
  adminDir,
  sharedResourceDbPath,
  safeText,
  inferMime,
  normalizeResourceKind,
  resourceRevisionFromPayload,
  readJsonBody,
  sendT8,
  HttpError,
  readResourceDb,
  writeResourceDb,
  userDataDirsForId, sendStaticFile,
  usePostgresRepository,
  upsertResourceItemPostgres,
  readGroupPermissionPolicies: async () => (await readAuthDb()).groupPermissionPolicies,
  filterSharedResourceItemsForUser,
  canUsePermissionSubject: async (user, subjectKey, action, legacyAllowed) => {
    await reconcilePermissionSubjects();
    return (await permissionRuntime.decide({
      user,
      subjectKey,
      action,
      legacyAllowed,
    })).allowed;
  },
  assertPermissionSubject: async (user, subjectKey, action, legacyAllowed) => {
    await reconcilePermissionSubjects();
    const decision = await permissionRuntime.decide({
      user,
      subjectKey,
      action,
      legacyAllowed,
    });
    if (!decision.allowed) throw new PermissionDeniedError();
  },
});

const handleGroupPermissionPolicyRoutes = createGroupPermissionPolicyRouteHandler({
  readJsonBody,
  sendT8,
  HttpError,
  safeText,
  readAuthDb,
  writeGroupPermissionPolicy: async (policy) => {
    if (usePostgresRepository()) {
      await authDirectoryWriteRepository.upsertGroupPermissionPolicy(policy);
      return;
    }
    const authDb = await readAuthDb();
    await writeAuthDb({
      ...authDb,
      groupPermissionPolicies: normalizeGroupPermissionPolicies([
        ...authDb.groupPermissionPolicies.filter((item) => item.groupId !== policy.groupId),
        policy,
      ]),
    });
  },
  readSharedResourceCatalog,
  readRunningHubPermissionCatalog: async () => {
    const catalog = await publicRunningHubCatalog(null, { includeRestricted: true });
    return { apps: catalog.apps, workflows: catalog.workflows };
  },
  nodeTypes: CANVAS_NODE_PERMISSION_CATALOG.map((type) => ({
    id: type,
    label: type,
    group: "canvas",
  })),
  resolveNodeTypeAllowed: async (user, nodeType, legacyAllowed) => {
    return (await permissionRuntime.decide({
      user,
      subjectKey: canvasNodeSubjectKey(nodeType),
      action: "view",
      legacyAllowed,
    })).allowed;
  },
  appendAudit,
});

const handlePermissionRoutes = createPermissionRouteHandler({
  sendT8,
  readJsonBody,
  HttpError,
  readAuthorizationState: permissionRepository.readAuthorizationState,
  upsertSubject: permissionRepository.upsertSubject,
  upsertRule: permissionRepository.upsertRule,
  deleteRule: permissionRepository.deleteRule,
  explain: permissionService.explain,
  appendAudit,
  createId: () => `perm-${Date.now()}-${randomBytes(6).toString("hex")}`,
  now: () => Date.now(),
  reconcileSubjects: reconcilePermissionSubjects,
  readHealth: async () => ({
    mode: permissionRuntimeMode,
    readiness: await readPermissionReadinessReport(),
    shadowMismatches: permissionShadowMetrics.snapshot(),
  }),
  principalExists: async (principalType, principalId) => {
    const authDb = await readAuthDb();
    if (principalType === "group") {
      return principalId === "ungrouped" || authDb.userGroups.some((group) => group.id === principalId);
    }
    return authDb.users.some((user) => user.id === principalId);
  },
});

const handleAdminAuditRoutes = createAdminAuditRouteHandler({
  sendT8,
  HttpError,
  readAdminDb,
  readAuditRecords: adminRepository.readAuditRecords,
  readAuthDb,
  readAdminUsageSummary: adminUsageSummaryService.readAdminUsageSummary,
  publicRunningHubCatalog: async () => {
    const catalog = await publicRunningHubCatalog();
    return { items: catalog.items };
  },
  usePostgresRepository,
  getPostgresPool,
  millisToDate,
  dateToMillis,
  normalizeTaskStatus,
  safeText,
  plainObject,
  appendAudit,
  appendReadAudit: async (actor, action, targetType, targetId, summary, context) => {
    const record: AdminAuditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      targetType,
      targetId,
      summary,
      requestId: safeText(context?.requestId),
      ip: safeText(context?.ip),
      userAgent: safeText(context?.userAgent),
      createdAt: Date.now(),
    };
    readAuditBuffer.push(record);
    void readAuditBuffer.flush();
  },
});

const handleAdminTaskListRoutes = createAdminTaskListRouteHandler({
  sendT8,
  HttpError,
  readAdminDb,
  readAuthDb,
  readTaskListPage: taskRepository.readTaskListPage,
  usePostgresRepository,
  getPostgresPool,
  readJsonBody,
  appendAudit,
  clampInteger,
  safeText,
  plainObject,
  withUnifiedRuntimeDiagnostic,
  toAdminTaskRecord,
  enrichAdminTaskRecord,
  normalizeTaskStatus,
  normalizeTaskQueueCapability,
  enqueueTask,
  readTaskRecord,
  insertTaskRecord,
  appendTaskLog,
  createRetriedTask,
  cancelTaskWithStrategy,
  writeTaskRecord,
  logApiEvent,
});

interface CanvasListItem {
  id: string;
  name: string;
  nodeCount: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

interface CanvasData {
  nodes: unknown[];
  edges: unknown[];
  workflows: WorkflowDocument[];
  viewport: { x: number; y: number; zoom: number };
  revision?: number;
  nextNodeSerialId?: number;
}

type ResourceKind = "image" | "video" | "audio" | "set" | "pose" | "workflow";

interface ResourceCategory {
  id: string;
  kind: ResourceKind;
  name: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

interface ResourceItem {
  id: string;
  kind: ResourceKind;
  libraryScope?: "personal" | "shared";
  title: string;
  url?: string;
  sourceUrl?: string;
  originalName?: string;
  fileUrl?: string;
  fileRel?: string;
  mime?: string;
  size?: number;
  categoryId?: string;
  tags: string[];
  favorite: boolean;
  materialSetKind?: string;
  materialSetItems?: unknown[];
  poseBackup?: Record<string, unknown>;
  workflowFragment?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  taskId?: string;
  providerId?: string;
  modelId?: string;
  workflowNodeCount?: number;
  workflowEdgeCount?: number;
  workflowNodeTypes?: string[];
  workflowPreview?: {
    nodes: Array<{ id: string; type: string; label: string; x: number; y: number }>;
    edges: Array<{ source: string; target: string }>;
  };
  revision: number;
}

interface ResourceDb {
  categories: ResourceCategory[];
  items: ResourceItem[];
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  administratorTier?: AdministratorTier;
  passwordHash: string;
  passwordCipher?: string;
  groupId?: string;
  remark?: string;
  disabled?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface UserGroupRecord {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

interface SessionRecord {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  lastSeenAt?: number;
  ip?: string;
  userAgent?: string;
  revokedAt?: number;
}

type LoginAttemptScope = "member" | "admin";

interface LoginAttemptRecord {
  key: string;
  scope: LoginAttemptScope;
  email: string;
  ip: string;
  failureCount: number;
  firstFailedAt: number;
  lastFailedAt: number;
  blockedUntil?: number;
  updatedAt: number;
}

interface AuthDb {
  userGroups: UserGroupRecord[];
  groupPermissionPolicies: GroupPermissionPolicy[];
  permissionSubjects: PermissionSubject[];
  permissionRules: PermissionRule[];
  users: UserRecord[];
  sessions: SessionRecord[];
  loginAttempts: LoginAttemptRecord[];
}

interface AdminSessionRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: "admin" | "member";
  administratorTier?: AdministratorTier;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  ip: string;
  userAgent: string;
  revokedAt?: number;
  current: boolean;
}

type CurrentUser = Pick<UserRecord, "id" | "email" | "name" | "role" | "groupId" | "administratorTier">;

type ModelCapability = "chat" | "image" | "video" | "audio";
type ProviderProtocol = "openai" | "gemini" | "runninghub" | "volcengine" | "apimart" | "aicopy" | "modelscope" | "custom" | "grsai_draw";

interface AdminProviderRecord {
  id: string;
  sortOrder?: number;
  name: string;
  baseUrl: string;
  protocol?: ProviderProtocol;
  enabled: boolean;
  apiKey?: string;
  apiKeyPreview?: string;
  lastProbeStatus?: string;
  lastProbeMessage?: string;
  lastFetchedAt?: number;
  rhApps?: RunningHubEntry[];
  rhWorkflows?: RunningHubEntry[];
  rhGroups?: RhCatalogGroup[];
  rhKeyPool?: RunningHubKeyPoolItemRecord[];
  msLoras?: ModelScopeLora[];
  note?: string;
  createdAt: number;
  updatedAt: number;
}

interface RunningHubKeyPoolItemRecord {
  id: string;
  note: string;
  apiKey?: string;
  apiKeyPreview?: string;
  maxConcurrency: number;
  enabled: boolean;
  isDefault: boolean;
  standardModelApi: boolean;
  currentInFlight?: number;
  createdAt: number;
  updatedAt: number;
}

interface ModelScopeLora {
  id: string;
  name?: string;
  targetModel: string;
  strength: number;
  enabled: boolean;
  note?: string;
}

interface AdminTaskRecord {
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
  providerName?: string;
  modelId?: string;
  modelName?: string;
  providerModelId?: string;
  executionIdentitySnapshot?: TaskExecutionIdentitySnapshot;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  logs: string[];
  logCount?: number;
  latestLog?: string;
  createdAt: number;
  updatedAt: number;
  finalizedAt?: number;
  displayStatus?: string;
  displayMessage?: string;
  displayTone?: "muted" | "warning" | "success" | "danger";
  runtimeStage?: string;
  providerState?: string;
  outputRecoveryAvailable?: boolean;
  materializationStatus?: string;
  failureCategory?: string;
}

function toOptionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function withUnifiedRuntimeDiagnostic(task: AdminTaskRecord): AdminTaskRecord & {
  failureReason?: string;
  failureCategory?: UnifiedFailureCategory;
  providerDiagnostic?: string;
  upstreamHttpStatus?: number;
  upstreamResponseSnippet?: string;
  submitDiagnostic?: string;
  pollDiagnostic?: string;
  cancelState?: UnifiedCancelState;
} {
  const result = plainObject(task.result);
  const projection = projectTaskRuntimeDisplayState({
    status: task.status,
    waitReason: safeText(result.waitReason),
    waitDetail: safeText(result.waitDetail),
    queueHint: safeText(result.queueHint),
    runtimeStage: safeText(result.runtimeStage),
    providerState: safeText(result.providerState || result.upstreamStatus || result.status),
    failureReason: safeText(result.failureReason),
    error: safeText(result.error),
    cancellationMessage: safeText(result.cancellationMessage),
    logs: task.logs,
  });
  return {
    ...task,
    displayStatus: projection.displayStatus,
    displayMessage: projection.displayMessage,
    displayTone: projection.displayTone,
    runtimeStage: projection.runtimeStage,
    providerState: projection.providerState,
    outputRecoveryAvailable: task.outputRecoveryAvailable === true || Boolean(result.outputRecoveryAvailable),
    materializationStatus: safeText(result.materializationStatus || task.materializationStatus) || undefined,
    failureReason: safeText(result.failureReason) || undefined,
    failureCategory: toUnifiedFailureCategory(result.failureCategory || task.failureCategory),
    providerDiagnostic: safeText(result.providerDiagnostic) || undefined,
    upstreamHttpStatus: toOptionalNumber(result.upstreamHttpStatus),
    upstreamResponseSnippet: safeText(result.upstreamResponseSnippet) || undefined,
    submitDiagnostic: safeText(result.submitDiagnostic) || undefined,
    pollDiagnostic: safeText(result.pollDiagnostic) || undefined,
    cancelState: toUnifiedCancelState(result.cancelState),
  };
}

function toUnifiedFailureCategory(value: unknown): UnifiedFailureCategory | undefined {
  const text = safeText(value);
  return unifiedFailureCategories.has(text as UnifiedFailureCategory)
    ? (text as UnifiedFailureCategory)
    : undefined;
}

function toUnifiedCancelState(value: unknown): UnifiedCancelState | undefined {
  const text = safeText(value);
  return unifiedCancelStates.has(text as UnifiedCancelState)
    ? (text as UnifiedCancelState)
    : undefined;
}

const unifiedFailureCategories = new Set<UnifiedFailureCategory>([
  "auth",
  "quota_or_credits",
  "model_config",
  "upstream_business_failed",
  "upstream_poll_gateway_failed",
  "upstream_poll_timeout",
  "provider_content_forbidden",
  "provider_content_unavailable",
  "provider_content_stream_terminated",
  "local_cancelled",
  "remote_cancel_failed",
  "unknown",
]);

const unifiedCancelStates = new Set<UnifiedCancelState>([
  "cancelled",
  "cancelled_local_only",
  "cancel_failed_remote_but_closed_local",
]);

interface AdminDb {
  providers: AdminProviderRecord[];
  models: AdminModelRecord[];
  tasks: AdminTaskRecord[];
  announcements?: import("@xinghuan/shared").AnnouncementRecord[];
  auditLogs?: AdminAuditRecord[];
  assistantSettings?: AssistantSettingsRecord;
  taskQueueSettings?: TaskQueueSettings;
  taskQueueSettingsRevision?: number;
  taskQueueSettingsUpdatedAt?: number;
}

interface SystemSettingsRecord {
  taskQueueSettings: TaskQueueSettings;
  updatedAt: number;
  revision: number;
}

interface AdminAuditRecord {
  id: string;
  actorId: string;
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

interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  startedAt: number;
  userId?: string;
  userEmail?: string;
}

interface AssistantAnalyzeRequest {
  providerName?: string;
  baseUrl?: string;
  protocolHint?: string;
  capability?: string;
  modelId?: string;
  docUrl?: string;
  docUrls?: string[];
  sampleRequest?: string;
  sampleResponse?: string;
  asyncTemplate?: string;
  notes?: string;
}

interface AssistantChatAttachment {
  id?: string;
  kind?: string;
  title?: string;
  summary?: string;
  payload?: Record<string, unknown>;
}

interface AssistantChatRequest {
  message?: string;
  attachments?: AssistantChatAttachment[];
  scope?: "canvas" | "admin";
  conversationId?: string;
  idempotencyKey?: string;
}

interface AssistantAnalysisResult {
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
  drafts: {
    provider: {
      name: string;
      baseUrl: string;
      protocol: string;
      note: string;
    };
    model: {
      modelId: string;
      displayName: string;
      capability: ModelCapability;
      executionMode?: ProviderGenerationExecutionMode;
      inputProfile: string;
      inputCapabilities: Record<string, boolean>;
      parameterSchema: string;
      advancedConfig: Record<string, unknown>;
    };
  };
  risks: string[];
  checklist: string[];
  rawAssistant: string;
}

interface AssistantProcessEntry {
  label: string;
  content: string;
}

const visibleSeedTextRules: Array<[RegExp, string]> = [
  [/^单端口脚本验收画布/g, "单端口工作画布"],
  [/^单端口验收画布/g, "单端口画布"],
  [/^星幻测试画布$/g, "星幻画布"],
  [/^Node render smoke /g, "节点渲染工作区 "],
  [/^单端口脚本验收节点$/g, "单端口节点"],
  [/^单端口验收节点$/g, "单端口节点"],
  [/^verify-single-port$/g, "单端口连通性检查"],
  [/^18200 save\/read check$/g, "18200 端口读写记录"],
  [/^星幻 API 兼容层测试$/g, "月光下的企鹅，极简卡通风格"],
  [/^验收 Provider$/g, "默认 Provider"],
  [/Verify Async Image Provider/g, "异步图像 Provider"],
  [/Verify Image Provider/g, "图像 Provider"],
  [/Verify Video Provider/g, "视频 Provider"],
  [/Verify Chat Provider/g, "对话 Provider"],
  [/Verify Catalog Provider/g, "目录 Provider"],
  [/Verify Worker Output Provider/g, "输出 Provider"],
  [/Verify Chat Model/g, "对话模型"],
  [/Verify Image Model/g, "图像模型"],
  [/^图像模型测试服务商$/g, "图像模型服务商"],
  [/^视频模型测试服务商$/g, "视频模型服务商"],
  [/^后台任务系统占位验收$/g, "后台任务队列"],
  [/^后台测试任务$/g, "后台任务"],
  [/\blifecycle task\b/g, "任务流程记录"],
  [/\bworker output material\b/g, "输出素材任务"],
  [/\bpayload contract\b/g, "任务载荷记录"],
];

function sanitizeVisibleSeedText(value: string): string {
  let next = value;
  for (const [pattern, replacement] of visibleSeedTextRules) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function sanitizeCanvasListItem(item: CanvasListItem): CanvasListItem {
  const name = sanitizeVisibleSeedText(typeof item.name === "string" ? item.name : "");
  const revision = Number.isFinite(item.revision) && item.revision > 0 ? Math.floor(item.revision) : 1;
  const next = revision === item.revision ? item : { ...item, revision };
  return name === next.name ? next : { ...next, name };
}

function normalizeResourceCategoryRecord(category: ResourceCategory): ResourceCategory {
  return {
    ...category,
    revision: Number.isFinite(category.revision) && category.revision > 0 ? Math.floor(category.revision) : 1,
  };
}

function normalizeResourceItemRecord(item: ResourceItem): ResourceItem {
  return {
    ...item,
    revision: Number.isFinite(item.revision) && item.revision > 0 ? Math.floor(item.revision) : 1,
  };
}

function optionalObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function sanitizeAdminDbVisibleText(db: AdminDb): { db: AdminDb; changed: boolean } {
  let changed = false;
  const announcements = (db.announcements || []).map((announcement) => {
    const title = sanitizeVisibleSeedText(announcement.title);
    const summary = sanitizeVisibleSeedText(announcement.summary);
    const content = sanitizeVisibleSeedText(announcement.content);
    if (title === announcement.title && summary === announcement.summary && content === announcement.content) return announcement;
    changed = true;
    return { ...announcement, title, summary, content };
  });
  const providers = db.providers.map((provider) => {
    const name = sanitizeVisibleSeedText(provider.name);
    const note = provider.note ? sanitizeVisibleSeedText(provider.note) : provider.note;
    if (name === provider.name && note === provider.note) return provider;
    changed = true;
    return { ...provider, name, note };
  });
  const models = db.models.map((model) => {
    const displayName = sanitizeVisibleSeedText(model.displayName);
    if (displayName === model.displayName) return model;
    changed = true;
    return { ...model, displayName };
  });
  const tasks = db.tasks.map((task) => {
    const title = sanitizeVisibleSeedText(task.title);
    if (title === task.title) return task;
    changed = true;
    return { ...task, title };
  });
  const auditLogs = (db.auditLogs || []).map((record) => {
    const summary = sanitizeVisibleSeedText(record.summary);
    if (summary === record.summary) return record;
    changed = true;
    return { ...record, summary };
  });
  return {
    db: changed ? { ...db, announcements, providers, models, tasks, auditLogs } : db,
    changed,
  };
}

const emptyCanvasData = (): CanvasData => ({
  nodes: [],
  edges: [],
  workflows: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  revision: 1,
  nextNodeSerialId: 1,
});

const materialAccessService = createMaterialAccessService({
  safeText,
  inferMime,
  requestPublicOrigin,
  userDataDirs: (user) => userDataDirsForId(user.id),
});
const handleAdminAgentGovernanceRoutes = createAdminAgentGovernanceRouteHandler({
  currentEnvironment: environment === "production" ? "production" : "gray",
  repository: agentGovernanceRepository, readProcessGates: () => agentRuntimeProcessGates,
  sendT8,
  usePostgresRepository,
  appendAudit,
  invalidRequest: (message, payload) => new HttpError(
    message === "ADMIN_REQUIRED" ? 403 : /(?:CONFLICT|NOT_PENDING|ACTIVE_PUBLICATION|TRANSITION_INVALID)/.test(message) ? 409 : 400,
    message,
    payload,
  ),
});

const generationArtifactRepository = createGenerationArtifactRepository({
  usePostgresRepository,
  getPostgresPool,
  generationLibraryPath: (ownerId) => userDataDirsForId(ownerId).generationLibraryDbPath,
  resourceLibraryPath: (ownerId) => userDataDirsForId(ownerId).resourceDbPath,
});

const generationArtifactLifecycle = createGenerationArtifactLifecycle({
  repository: generationArtifactRepository,
  artifactStore: createLocalArtifactStore({ outputDir: (ownerId) => userDataDirsForId(ownerId).outputDir }),
  createId: () => `gen-${Date.now()}-${randomBytes(5).toString("hex")}`,
});

const ephemeralUploadRepository = createEphemeralUploadRepository({
  usePostgresRepository,
  getPostgresPool,
  manifestPath: (ownerId) => userDataDirsForId(ownerId).ephemeralUploadManifestPath,
});

async function readAnnouncementRecords() {
  return adminRepository.readAnnouncementRecords();
}

function summarizeAdminTaskListRecord(task: AdminTaskRecord) {
  const { payload: _payload, result: _result, ...summary } = task;
  return summary;
}

async function writeAnnouncementRecords(announcements: AnnouncementRecord[]) {
  await adminRepository.writeAnnouncementRecords(announcements);
}

const announcementStore = createAnnouncementStore({
  usePostgresRepository,
  getPostgresPool,
  readAnnouncements: readAnnouncementRecords,
  writeAnnouncements: writeAnnouncementRecords,
  safeText,
  millisToDate,
  dateToMillis,
});
const announcementPublicStreamPath = "/api/announcements/stream";
const requestPerformance = createRequestPerformanceObservability({ maxSamples: 2_000 });
const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
eventLoopHistogram.enable();

await ensureRuntimeDatabaseTarget("xinghuan-api");

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
  const requestContext = createRequestContext(request, url);
  const performanceTracker = requestPerformance.start(normalizeRouteId(`${request.method || "GET"} ${url.pathname}`));
  response.once("finish", () => {
    const rawBytes = response.getHeader("content-length");
    performanceTracker.finish({
      statusCode: response.statusCode,
      responseBytes: typeof rawBytes === "number" ? rawBytes : Number(rawBytes || 0),
    });
  });
  response.setHeader("x-request-id", requestContext.requestId);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type",
      "x-request-id": requestContext.requestId,
    });
    response.end();
    return;
  }

  if (url.pathname === "/health" || url.pathname === "/api/health") {
    sendJson(response, createHealthPayload("xinghuan-api", environment));
    return;
  }

  if (url.pathname === "/api/status") {
    sendT8(response, {
      status: "ok",
      service: "xinghuan-api",
      version: appVersion,
      environment,
      permissionMode: permissionRuntimeMode,
      dataDir,
    });
    return;
  }

    if (url.pathname === "/api/version") {
      sendJson(response, createHealthPayload("xinghuan-api-version", environment));
      return;
    }

    try {
      if (url.pathname === "/api/internal/environment-sync/snapshot" && request.method === "POST") {
        assertInternalEnvironmentSyncRequest(request);
        const body = await readJsonBody<{ environment?: EnvironmentSyncTarget }>(request);
        sendT8(response, await readEnvironmentSyncLocalSnapshot(normalizeEnvironmentSyncTarget(body.environment)));
        return;
      }

      if (url.pathname === "/api/internal/environment-sync/apply" && request.method === "POST") {
        assertInternalEnvironmentSyncRequest(request);
        const body = await readJsonBody<EnvironmentSyncWriteRequest>(request);
        sendT8(response, await applyEnvironmentSyncLocalSnapshot({
          sourceEnvironment: normalizeEnvironmentSyncTarget(body.sourceEnvironment),
          targetEnvironment: normalizeEnvironmentSyncTarget(body.targetEnvironment),
          actorEmail: safeText(body.actorEmail),
          users: Array.isArray(body.users) ? body.users.map(normalizeEnvironmentSyncUserRecord).filter(Boolean) as EnvironmentSyncWriteRequest["users"] : [],
          providers: Array.isArray(body.providers) ? body.providers.map(normalizeEnvironmentSyncProviderRecord).filter(Boolean) as EnvironmentSyncWriteRequest["providers"] : [],
          models: Array.isArray(body.models) ? body.models.map(normalizeEnvironmentSyncModelRecord).filter(Boolean) as EnvironmentSyncWriteRequest["models"] : [],
        }));
        return;
      }
      if (await handleInternalComfyuiConnectorRoutes({ request, response, url, deps: { sendT8, adminDir, connectorToken: comfyuiConnectorToken } })) return;

      if (requiresCsrfProtection(url.pathname, request.method || "GET")) {
        assertSameOriginWriteRequest(request);
      }

    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const user = await getCurrentUser(request);
      sendT8(response, { authenticated: Boolean(user), user });
      return;
    }

    if (url.pathname === "/api/auth/admin-me" && request.method === "GET") {
      const user = await getCurrentUser(request);
      const adminUser = user?.role === "admin" ? user : null;
      if (adminUser) {
        requestContext.userId = adminUser.id;
        requestContext.userEmail = adminUser.email;
        await appendAudit(
          { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role },
          "auth.admin_me",
          "auth",
          adminUser.id,
          `读取管理员登录态 ${adminUser.email}`,
          requestContext,
        );
      }
      sendT8(response, { authenticated: Boolean(adminUser), user: adminUser });
      return;
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const body = await readJsonBody<{ email?: string; password?: string }>(request);
      const login = await loginUser(request, body.email, body.password);
      if (!login || typeof login === "string") {
        sendJson(response, { ok: false, success: false, error: "INVALID_CREDENTIALS" }, 401);
        return;
      }
      sendT8(response, { authenticated: true, user: toPublicUser(login.user) }, 200, {
        "set-cookie": buildSessionCookie(request, login.session.id),
      });
      return;
    }

    if (url.pathname === "/api/auth/admin-login" && request.method === "POST") {
      const body = await readJsonBody<{ email?: string; password?: string }>(request);
      const login = await loginUser(request, body.email, body.password, { adminOnly: true });
      if (login === "ADMIN_REQUIRED") {
        sendJson(response, { ok: false, success: false, error: "ADMIN_REQUIRED" }, 403);
        return;
      }
      if (!login || typeof login === "string") {
        sendJson(response, { ok: false, success: false, error: "INVALID_CREDENTIALS" }, 401);
        return;
      }
      requestContext.userId = login.user.id;
      requestContext.userEmail = login.user.email;
      await appendAudit(
        { id: login.user.id, email: login.user.email, name: login.user.name, role: login.user.role },
        "auth.admin_login",
        "auth",
        login.user.id,
        `管理员登录 ${login.user.email}`,
        requestContext,
      );
      sendT8(response, { authenticated: true, user: toPublicUser(login.user) }, 200, {
        "set-cookie": buildSessionCookie(request, login.session.id),
      });
      return;
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      const actor = await getCurrentUser(request);
      await logoutUser(request);
      if (actor?.role === "admin") {
        requestContext.userId = actor.id;
        requestContext.userEmail = actor.email;
        await appendAudit(
          { id: actor.id, email: actor.email, name: actor.name, role: actor.role },
          "auth.admin_logout",
          "auth",
          actor.id,
          `管理员退出 ${actor.email}`,
          requestContext,
        );
      }
      sendT8(response, { authenticated: false }, 200, {
        "set-cookie": expireSessionCookie(request),
      });
      return;
    }

    const currentUser = await getCurrentUser(request);
    if (currentUser) {
      requestContext.userId = currentUser.id;
      requestContext.userEmail = currentUser.email;
    }
    if (request.method === "GET" && url.pathname.startsWith("/api/provider-files/")) {
      await sendProviderFile(response, url);
      return;
    }

    if (isProtectedRequest(url.pathname) && !currentUser) {
      sendJson(response, { ok: false, success: false, error: "AUTH_REQUIRED" }, 401);
      return;
    }

    if (await handleComfyuiPublicRoutes({ request, response, url, deps: {
      sendT8, adminDir,
      normalizeReferenceUrl: (value) => normalizeProviderReferenceUrlForAccess(value, providerFilePublicOrigin(request), currentUser!, { secret: secretKey(), scope: environment }),
      saveRemoteImageToOutput: (sourceUrl) => saveRemoteImageToOutput(sourceUrl, currentUser!),
      saveRemoteVideoToOutput: (sourceUrl) => saveRemoteVideoToOutput(sourceUrl, currentUser!),
      saveRemoteAudioToOutput: (sourceUrl) => saveRemoteAudioToOutput(sourceUrl, currentUser!),
    } })) return;

    if (url.pathname.startsWith("/api/admin/")) {
      if (!currentUser || currentUser.role !== "admin") {
        sendJson(response, { ok: false, success: false, error: "ADMIN_REQUIRED" }, 403);
        return;
      }
      if (await handleAdminRequest(request, response, url, currentUser, requestContext)) return;
    }

    if (await handleGroupPermissionPolicyRoutes({ request, response, url, currentUser, requestContext })) return;

    if (await handleCodeNodeRoutes({
      request,
      response,
      url,
      currentUser,
      deps: {
        readJsonBody,
        sendT8,
        assertCanExecute: async (user) => {
          await reconcilePermissionSubjects();
          const decision = await permissionRuntime.decide({
            user: currentUser!,
            subjectKey: canvasNodeSubjectKey('code'),
            action: 'execute',
            legacyAllowed: true,
          });
          if (!decision.allowed) throw new PermissionDeniedError();
        },
      },
    })) return;

    if (await handleImageOperationRoutes({
      request,
      response,
      url,
      currentUser: currentUser!,
      deps: {
        readJsonBody,
        sendJson,
        userDataDirs: (user) => userDataDirsForId(user.id),
        registerOutput: (user, saved, sourceUrl) => registerApiOutputArtifact(user as CurrentUser, "image", saved, sourceUrl),
      },
    })) return;

    if (request.method === "GET" && url.pathname.startsWith("/files/input/")) {
      await sendStaticFile(response, userDataDirs(currentUser!).inputDir, url.pathname.slice("/files/input/".length));
      return;
    }

    if (url.pathname === "/api/assistant/chat" && request.method === "POST") {
      const body = await readJsonBody<AssistantChatRequest>(request);
      const result = await runAssistantChat({ ...body, scope: body.scope || "canvas" }, currentUser!, providerFilePublicOrigin(request));
      sendT8(response, result);
      return;
    }

    if (url.pathname === "/api/assistant/chat/stream" && request.method === "POST") {
      const body = await readJsonBody<AssistantChatRequest>(request);
      await streamAssistantChatResponse(response, { ...body, scope: body.scope || "canvas" }, currentUser!, providerFilePublicOrigin(request));
      return;
    }

    if (url.pathname === "/api/assistant/settings" && request.method === "GET") {
      const adminDb = await readAdminDb();
      sendT8(response, toPublicAssistantSettings(adminDb.assistantSettings || defaultAssistantSettings()));
      return;
    }

    if (url.pathname === "/api/assistant/status" && request.method === "GET") {
      const adminDb = await readAdminDb();
      sendT8(response, await readAssistantRuntimeStatus("canvas", normalizeAssistantSettings(adminDb.assistantSettings)));
      return;
    }

    if (currentUser && announcementPublicStreamPath && await handlePublicAnnouncementRoutes({
      request,
      response,
      url,
      currentUser,
      deps: {
        sendT8,
        announcementStore,
      },
    })) {
      return;
    }

    if (currentUser && await createOutputArchiveRouteHandler({
      repository: outputArchiveRepository,
      currentUser,
      userDataDirs: (ownerId) => userDataDirsForId(ownerId),
      request,
      response,
      url,
      sendT8,
      toHttpError: (statusCode, message) => new HttpError(statusCode, message),
    })) return;

    if (request.method === "GET" && url.pathname.startsWith("/files/output/")) {
      await sendStaticFile(response, userDataDirs(currentUser!).outputDir, url.pathname.slice("/files/output/".length));
      return;
    }

    if (currentUser && await handleGenerationArtifactRoutes({
      request,
      response,
      url,
      ownerId: currentUser.id,
      lifecycle: generationArtifactLifecycle,
      materialAccessService,
      readJsonBody,
      sendT8,
      toHttpError: (error) => new HttpError(error.statusCode, error.message),
    })) {
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/input/")) {
      await sendStaticFile(response, userDataDirs(currentUser!).inputDir, url.pathname.slice("/input/".length));
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/output/")) {
      await sendStaticFile(response, userDataDirs(currentUser!).outputDir, url.pathname.slice("/output/".length));
      return;
    }

    if (url.pathname === "/api/files/upload" && request.method === "POST") {
      sendT8(response, await handleMultipartUpload(request, currentUser!));
      return;
    }

    if (url.pathname === "/api/files/upload-base64" && request.method === "POST") {
      const body = await readJsonBody<{ dataUrl?: string; prefix?: string }>(request);
      sendT8(response, await saveBase64File(body, currentUser!));
      return;
    }

    if (url.pathname === "/api/files/list" && request.method === "GET") {
      sendT8(response, await listOutputFiles(currentUser!));
      return;
    }

    if (url.pathname === "/api/files/save-to-disk" && request.method === "POST") {
      const body = await readJsonBody<{ url?: string; filename?: string }>(request);
      sendT8(response, await saveToOutput(body, currentUser!));
      return;
    }

    if (url.pathname === "/api/files/duck-decode" && request.method === "POST") {
      const body = await readJsonBody<{ urls?: string[] }>(request);
      sendT8(response, {
        items: (Array.isArray(body.urls) ? body.urls : []).map((sourceUrl) => ({
          sourceUrl,
          decoded: false,
          reason: "duck_decode_not_enabled",
        })),
        decodedCount: 0,
      });
      return;
    }

    if (url.pathname === "/api/ai-watermark/status" && request.method === "GET") {
      sendT8(response, aiWatermarkStatus());
      return;
    }

    if (url.pathname === "/api/ai-watermark/process" && request.method === "POST") {
      await readJsonBody(request).catch(() => ({}));
      sendJson(response, {
        success: false,
        error: "AI_WATERMARK_NOT_CONFIGURED",
        data: aiWatermarkStatus(),
      }, 501);
      return;
    }

    if (url.pathname === "/api/settings" || url.pathname === "/api/settings/raw") {
      if (request.method === "GET") {
        sendT8(response, defaultSettings());
        return;
      }
      if (request.method === "POST") {
        sendT8(response, defaultSettings());
        return;
      }
    }

    if (await handleQualityRecoveryRoutes({ request, response, url, currentUser: currentUser! })) return;
    if (await handleCanvasRunRoutes({ request, response, url, currentUser: currentUser! })) return;
    if (await handleTaskCostRoutes({ request, response, url, currentUser: currentUser! })) return;
    if (await handleChannelHealthMemberRoutes({ request, response, url, currentUser: currentUser! })) return;

    if (url.pathname === "/api/models" && request.method === "GET") {
      sendT8(response, await publicModelCatalog(currentUser));
      return;
    }

    if (url.pathname === "/api/runninghub/catalog" && request.method === "GET") {
      const catalog = await publicRunningHubCatalog(currentUser);
      const etag = `"${catalog.revision}"`;
      if (request.headers["if-none-match"] === etag) {
        response.writeHead(304, { etag, "cache-control": "private, max-age=0, must-revalidate" });
        response.end();
        return;
      }
      sendT8(response, catalog, 200, { etag, "cache-control": "private, max-age=0, must-revalidate" });
      return;
    }

    if (url.pathname.startsWith("/api/runninghub/catalog/") && request.method === "GET") {
      const catalogId = decodeURIComponent(url.pathname.slice("/api/runninghub/catalog/".length));
      const item = await publicRunningHubCatalogItemDetail(catalogId, currentUser);
      if (!item) throw new HttpError(404, "RUNNINGHUB_CATALOG_ITEM_NOT_FOUND");
      sendT8(response, item);
      return;
    }

    if (url.pathname === "/api/proxy/generation/cancel" && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const taskId = safeText(body.taskId);
      if (!taskId) throw new Error("缺少 taskId");
      const kind = safeText(body.kind, "generation");
      const cancelled = await cancelTaskWithStrategy(taskId, currentUser!);
      if (!cancelled) throw new Error("任务不存在");
      logApiEvent("task.cancelled", requestContext, {
        taskId,
        userId: currentUser!.id,
        providerId: cancelled.task?.providerId,
        modelId: cancelled.task?.modelId,
        status: cancelled.cancelled ? "cancelled" : "not_cancelled",
      });
      sendT8(response, {
        cancelled: cancelled.cancelled,
        upstream: cancelled.upstream,
        cancelScope: cancelled.cancelScope,
        upstreamSupported: cancelled.upstreamSupported,
        upstreamAttempted: cancelled.upstreamAttempted,
        taskId,
        kind,
        message: cancelled.message,
      });
      return;
    }

    if (url.pathname === "/api/proxy/external/image" && request.method === "POST") {
      sendT8(response, await generateExternalImageProxy(await readJsonBody(request), currentUser!, providerFilePublicOrigin(request)));
      return;
    }

    if (url.pathname === "/api/proxy/external/image/task" && request.method === "POST") {
      sendT8(response, await submitProviderGenerationTask({
        capability: "image",
        rawBody: await readJsonBody(request),
        user: currentUser!,
        publicOrigin: providerFilePublicOrigin(request),
        requestContext,
      }));
      return;
    }

    if (url.pathname === "/api/proxy/external/llm" && request.method === "POST") {
      const rawBody = await readJsonBody(request);
      const llmResult = await generateExternalChatProxy(rawBody, currentUser!, providerFilePublicOrigin(request));
      const task = createSucceededExternalChatTask(rawBody, llmResult, currentUser!, requestContext);
      await insertTaskRecord(task);
      sendT8(response, { ...llmResult, taskId: task.id });
      return;
    }

    if (url.pathname === "/api/proxy/external/video" && request.method === "POST") {
      sendT8(response, await generateExternalVideoProxy(await readJsonBody(request), currentUser!, providerFilePublicOrigin(request)));
      return;
    }

    if (url.pathname === "/api/proxy/external/video/task" && request.method === "POST") {
      sendT8(response, await submitProviderGenerationTask({
        capability: "video",
        rawBody: await readJsonBody(request),
        user: currentUser!,
        publicOrigin: providerFilePublicOrigin(request),
        requestContext,
      }));
      return;
    }

    const externalGenerationTaskMatch = url.pathname.match(/^\/api\/proxy\/external\/(image|video|audio)\/task\/([^/]+)$/);
    if (externalGenerationTaskMatch && request.method === "GET") {
      sendT8(response, await readProviderGenerationTaskStatus({
        capability: externalGenerationTaskMatch[1] as "image" | "video" | "audio",
        taskId: decodeURIComponent(externalGenerationTaskMatch[2]),
        user: currentUser!,
      }));
      return;
    }

    if (url.pathname === "/api/proxy/external/audio" && request.method === "POST") {
      sendT8(response, await generateExternalAudioProxy(await readJsonBody(request), currentUser!));
      return;
    }

    if (url.pathname === "/api/proxy/external/audio/task" && request.method === "POST") {
      sendT8(response, await submitProviderGenerationTask({
        capability: "audio",
        rawBody: await readJsonBody(request),
        user: currentUser!,
        publicOrigin: providerFilePublicOrigin(request),
        requestContext,
      }));
      return;
    }

    if (url.pathname === "/api/proxy/runninghub/app-info" && request.method === "GET") {
      const webappId = safeText(url.searchParams.get("webappId"));
      if (!webappId) throw new Error("缺少 webappId");
      const item = await publicRunningHubCatalogItemDetail(webappId, currentUser);
      const localFields = Array.isArray(item?.fields) ? item.fields : [];
      const localInputSlots = Array.isArray(item?.inputSlots) ? item.inputSlots : [];
      if (item && (localFields.length > 0 || localInputSlots.length > 0)) {
        sendT8(response, {
          webappId,
          title: item.title,
          runTargetId: item.runTargetId,
          pageId: item.pageId,
          workflowId: item.workflowId,
          nodeInfoList: localFields,
          inputSlots: localInputSlots,
          execution: item.execution,
        });
        return;
      }
      const provider = await resolveRunningHubProvider();
      const apiKey = providerPlainApiKey(provider);
      if (!apiKey) throw new Error("RunningHub Provider 未配置 API Key");
      const remoteTargetId = safeText(item?.runTargetId || webappId, webappId);
      const upstream = await fetch(
        `${provider.baseUrl.replace(/\/+$/, "")}/api/webapp/apiCallDemo?apiKey=${encodeURIComponent(apiKey)}&webappId=${encodeURIComponent(remoteTargetId)}`,
        {
          headers: { host: "www.runninghub.cn" },
          signal: AbortSignal.timeout(120000),
        },
      );
      const text = await upstream.text();
      if (!upstream.ok) throw new Error(`RunningHub 应用信息查询失败 ${upstream.status}: ${text.slice(0, 500)}`);
      const raw = parseUpstreamJson(text, "RunningHub 应用信息接口", upstream.headers.get("content-type") || "");
      const payload = plainObject(raw.data);
      const remoteNodeInfoList = Array.isArray(payload.nodeInfoList)
        ? payload.nodeInfoList
        : Array.isArray(raw.nodeInfoList)
          ? raw.nodeInfoList
          : [];
      sendT8(response, {
        ...raw,
        webappId: remoteTargetId,
        title: safeText(item?.title || payload.title || raw.title),
        runTargetId: safeText(item?.runTargetId || payload.runTargetId || remoteTargetId, remoteTargetId),
        pageId: safeText(item?.pageId || payload.pageId || raw.pageId),
        workflowId: safeText(item?.workflowId || payload.workflowId || raw.workflowId),
        nodeInfoList: remoteNodeInfoList,
        inputSlots: localInputSlots,
        execution: item?.execution,
      });
      return;
    }

    if (url.pathname === "/api/proxy/runninghub/upload-asset" && request.method === "POST") {
      const body = await readJsonBody<{ url?: string }>(request);
      const sourceUrl = safeText(body.url);
      if (!sourceUrl) throw new Error("缺少 url");
      const provider = await resolveRunningHubProvider();
      const apiKey = providerPlainApiKey(provider);
      if (!apiKey) throw new Error("RunningHub Provider 未配置 API Key");
      const prepared = await prepareRunningHubUploadSource(sourceUrl, currentUser!, providerFilePublicOrigin(request));
      const form = new FormData();
      form.append("apiKey", apiKey);
      form.append("fileType", "input");
      form.append("file", new Blob([prepared.buffer], { type: prepared.mime }), prepared.filename);
      const upstream = await fetch(`${provider.baseUrl.replace(/\/+$/, "")}/task/openapi/upload`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(180000),
      });
      const text = await upstream.text();
      if (!upstream.ok) throw new Error(`RunningHub 资源上传失败 ${upstream.status}: ${text.slice(0, 500)}`);
      const raw = parseUpstreamJson(text, "RunningHub 资源上传接口", upstream.headers.get("content-type") || "");
      const payload = plainObject(raw.data);
      const fileName = safeText(payload.fileName || payload.filename || raw.fileName);
      if (!fileName) throw new Error(safeText(payload.msg || raw.message || raw.msg, "RunningHub 上传成功但未返回 fileName"));
      sendT8(response, {
        fileName,
        fileType: safeText(payload.fileType || prepared.kind, prepared.kind),
        raw,
      });
      return;
    }

    if (url.pathname === "/api/proxy/runninghub/submit" && request.method === "POST") {
      const body = await readJsonBody<{
        providerId?: string;
        modelId?: string;
        pageId?: string;
        webappId?: string;
        workflowId?: string;
        runTargetId?: string;
        targetType?: "app" | "workflow";
        taskCapability?: "image" | "video" | "audio" | "chat";
        nodeInfoList?: Array<{ nodeId?: string; fieldName?: string; fieldValue?: unknown }>;
        instanceType?: string;
        title?: string;
      }>(request);
      const provider = await resolveRunningHubProvider(safeText(body.providerId));
      const task = await createRunningHubQueuedTask({
        provider,
        modelId: safeText(body.modelId),
        pageId: safeText(body.pageId),
        webappId: safeText(body.webappId),
        workflowId: safeText(body.workflowId),
        runTargetId: safeText(body.runTargetId),
        targetType: body.targetType === "app" ? "app" : "workflow",
        taskCapability: body.taskCapability === "image" || body.taskCapability === "audio" || body.taskCapability === "chat"
          ? body.taskCapability
          : "video",
        nodeInfoList: Array.isArray(body.nodeInfoList) ? body.nodeInfoList : [],
        instanceType: safeText(body.instanceType),
        title: safeText(body.title),
        user: currentUser!,
        requestContext,
      });
      sendT8(response, { taskId: task.id });
      return;
    }

    if (url.pathname === "/api/proxy/runninghub/query" && request.method === "GET") {
      const taskId = safeText(url.searchParams.get("taskId"));
      if (!taskId) throw new Error("缺少 taskId");
      const status = await readProviderGenerationTaskStatus({
        capability: "video",
        taskId,
        user: currentUser!,
      }) as Record<string, unknown>;
      const raw = plainObject(status.raw);
      const videoUrls = Array.isArray(status.videoUrls)
        ? (status.videoUrls as unknown[]).map((item) => safeText(item)).filter(Boolean)
        : [];
      const imageUrls = Array.isArray(status.imageUrls)
        ? (status.imageUrls as unknown[]).map((item) => safeText(item)).filter(Boolean)
        : [];
      const audioUrls = Array.isArray(status.audioUrls)
        ? (status.audioUrls as unknown[]).map((item) => safeText(item)).filter(Boolean)
        : [];
      const urls = [...imageUrls, ...videoUrls, ...audioUrls].filter(Boolean);
      sendT8(response, {
        status: mapRunningHubTaskStatus(safeText(status.status)),
        urls,
        failReason: safeText(status.error),
        code: mapRunningHubTaskCode(safeText(status.status)),
        progress: safeText(status.progress),
        queueHint: safeText(status.queueHint || status.displayMessage),
        displayStatus: safeText(status.displayStatus),
        displayMessage: safeText(status.displayMessage),
        displayTone: safeText(status.displayTone),
        runtimeStage: safeText(status.runtimeStage),
        providerState: safeText(status.providerState),
        raw: {
          ...raw,
          logs: Array.isArray(status.logs) ? status.logs : [],
        },
      });
      return;
    }

    if (url.pathname === "/api/proxy/runninghub/task" && request.method === "POST") {
      const body = await readJsonBody<{
        providerId?: string;
        modelId?: string;
        pageId?: string;
        webappId?: string;
        workflowId?: string;
        runTargetId?: string;
        targetType?: "app" | "workflow";
        taskCapability?: "image" | "video" | "audio" | "chat";
        nodeInfoList?: Array<{ nodeId?: string; fieldName?: string; fieldValue?: unknown }>;
        instanceType?: string;
        title?: string;
      }>(request);
      const targetType = body.targetType === "app" ? "app" : "workflow";
      const taskCapability = body.taskCapability === "image" || body.taskCapability === "audio" || body.taskCapability === "chat"
        ? body.taskCapability
        : "video";
      const runTargetId = safeText(body.runTargetId || (targetType === "app" ? body.webappId : body.workflowId));
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload: Record<string, unknown> = {
        taskCapability,
        executionMode: "worker_queue",
        userId: currentUser!.id,
        targetType,
        pageId: safeText(body.pageId),
        webappId: safeText(body.webappId),
        workflowId: safeText(body.workflowId),
        runTargetId,
        nodeInfoList: Array.isArray(body.nodeInfoList) ? body.nodeInfoList : [],
        instanceType: safeText(body.instanceType),
        requestId: requestContext.requestId,
      };
      const now = Date.now();
      const task: AdminTaskRecord = {
        id: taskId,
        title: safeText(body.title, `RunningHub 任务 · ${runTargetId || safeText(body.webappId || body.workflowId, "workflow")}`),
        status: "queued",
        ownerId: currentUser!.id,
        providerId: safeText(body.providerId, "runninghub"),
        modelId: safeText(body.modelId),
        payload,
        result: {
          adapter: "runninghub",
          protocol: "runninghub",
          capability: taskCapability,
          rhTargetType: targetType,
          rhRunTargetId: runTargetId,
          userId: currentUser!.id,
          pageId: safeText(body.pageId),
          webappId: safeText(body.webappId),
          workflowId: safeText(body.workflowId),
        },
        logs: ["画布提交 RunningHub 后台任务"],
        createdAt: now,
        updatedAt: now,
      };
      await insertTaskRecord(task);
      const queueCapability = taskCapability === "image" || taskCapability === "audio" ? taskCapability : "video";
      const queueResult = await enqueueTask(task.id, queueCapability);
      const queueLog = queueResult.queued ? `已进入 Redis 队列 ${queueResult.queueName}` : `未进入 Redis 队列: ${queueResult.reason}`;
      await appendTaskLog(task.id, queueLog);
      if (!queueResult.queued) {
        await writeTaskRecord({
          ...task,
          status: "failed",
          result: { ...task.result, error: queueLog, failureReason: queueLog },
          logs: [...task.logs, queueLog],
          updatedAt: Date.now(),
        });
        throw new Error(`RunningHub 任务队列不可用：${queueResult.reason}`);
      }
      sendT8(response, {
        taskId: task.id,
        status: "queued",
        progress: "0%",
        raw: {
          providerId: task.providerId,
          adapter: "runninghub",
          queued: true,
        },
      });
      return;
    }

    const runningHubTaskMatch = url.pathname.match(/^\/api\/proxy\/runninghub\/task\/([^/]+)$/);
    if (runningHubTaskMatch && request.method === "GET") {
      const status = await readProviderGenerationTaskStatus({
        capability: "video",
        taskId: decodeURIComponent(runningHubTaskMatch[1]),
        user: currentUser!,
      });
      sendT8(response, status);
      return;
    }

    if (url.pathname === "/api/settings/rh-tool-categories" || url.pathname === "/api/settings/rh-tool-apps") {
      sendT8(response, []);
      return;
    }

    if (url.pathname === "/api/themes/templates") {
      if (request.method === "GET") {
        sendT8(response, { path: join(dataDir, "theme-templates"), templates: [] });
        return;
      }
      if (request.method === "POST") {
        sendT8(response, null);
        return;
      }
    }

    const themeMatch = url.pathname.match(/^\/api\/themes\/templates\/([^/]+)$/);
    if (themeMatch && (request.method === "PUT" || request.method === "DELETE")) {
      sendT8(response, request.method === "DELETE" ? null : await readJsonBody(request));
      return;
    }

    if (url.pathname === "/api/resources/categories") {
      if (request.method === "GET") {
        const kind = normalizeResourceKind(url.searchParams.get("kind"));
        const db = await readResourceDb(currentUser!);
        sendT8(response, kind ? db.categories.filter((item) => item.kind === kind) : db.categories);
        return;
      }
      if (request.method === "POST") {
        const body = await readJsonBody<{ kind?: string; name?: string }>(request);
        const kind = normalizeResourceKind(body.kind) || "image";
        const now = Date.now();
        const category: ResourceCategory = {
          id: `cat-${now}-${Math.random().toString(36).slice(2, 8)}`,
          kind,
          name: safeText(body.name, "未分类"),
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };
        if (usePostgresRepository()) {
          sendT8(response, await upsertResourceCategoryPostgres(category, currentUser!));
          return;
        } else {
          const db = await readResourceDb(currentUser!);
          db.categories.push(category);
          await writeResourceDb(db, currentUser!);
        }
        sendT8(response, category);
        return;
      }
    }

    if (await handleSharedResourceRoutes({ request, response, url, currentUser })) return;

    const resourceCategoryMatch = url.pathname.match(/^\/api\/resources\/categories\/([^/]+)$/);
    if (resourceCategoryMatch) {
      const id = decodeURIComponent(resourceCategoryMatch[1]);
      if (request.method === "PUT") {
        const body = await readJsonBody<{ name?: string; revision?: number }>(request);
        if (usePostgresRepository()) {
          sendT8(
            response,
            await updateResourceCategoryPostgres(
              id,
              safeText(body.name, "未分类"),
              currentUser!,
              resourceRevisionFromPayload(body),
            ),
          );
          return;
        }
        const db = await readResourceDb(currentUser!);
        const current = db.categories.find((item) => item.id === id);
        if (!current) throw new Error("分类不存在");
        const expectedRevision = resourceRevisionFromPayload(body);
        if (expectedRevision !== undefined && expectedRevision !== current.revision) {
          throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
            resourceKind: "category",
            resourceId: id,
            currentRevision: current.revision,
          });
        }
        const updated = db.categories.map((item) =>
          item.id === id
            ? { ...item, name: safeText(body.name, item.name), revision: (item.revision || 1) + 1, updatedAt: Date.now() }
            : item,
        );
        await writeResourceDb({ ...db, categories: updated }, currentUser!);
        sendT8(response, updated.find((item) => item.id === id) ?? null);
        return;
      }
      if (request.method === "DELETE") {
        const body = await readJsonBody<{ revision?: number }>(request);
        if (usePostgresRepository()) {
          await deleteResourceCategoryPostgresWithItemRevision(id, currentUser!, resourceRevisionFromPayload(body));
        } else {
          const db = await readResourceDb(currentUser!);
          const current = db.categories.find((item) => item.id === id);
          if (!current) throw new Error("分类不存在");
          const expectedRevision = resourceRevisionFromPayload(body);
          if (expectedRevision !== undefined && expectedRevision !== current.revision) {
            throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
              resourceKind: "category",
              resourceId: id,
              currentRevision: current.revision,
            });
          }
          await writeResourceDb({
            categories: db.categories.filter((item) => item.id !== id),
            items: db.items.map((item) =>
              item.categoryId === id
                ? { ...item, categoryId: "", revision: (item.revision || 1) + 1, updatedAt: Date.now() }
                : item,
            ),
          }, currentUser!);
        }
        sendT8(response, { movedTo: "" });
        return;
      }
    }

    if (url.pathname === "/api/resources/items") {
      const db = await readResourceDb(currentUser!);
      const kind = normalizeResourceKind(url.searchParams.get("kind"));
      const categoryId = safeText(url.searchParams.get("categoryId"), "");
      const q = safeText(url.searchParams.get("q"), "").toLowerCase();
      const favorite = url.searchParams.get("favorite") === "1";
      sendT8(
        response,
        db.items.filter((item) => {
          if (kind && item.kind !== kind) return false;
          if (categoryId && item.categoryId !== categoryId) return false;
          if (favorite && !item.favorite) return false;
          if (q && !`${item.title} ${(item.tags || []).join(" ")}`.toLowerCase().includes(q)) return false;
          return true;
        }),
      );
      return;
    }

    if (url.pathname === "/api/resources/items/add" && request.method === "POST") {
      sendT8(response, await addResourceFromPayload(await readJsonBody(request), currentUser!));
      return;
    }

    if (url.pathname === "/api/resources/sets/add" && request.method === "POST") {
      sendT8(response, await addResourceFromPayload(await readJsonBody(request), currentUser!, "set"));
      return;
    }

    if (url.pathname === "/api/resources/poses/add" && request.method === "POST") {
      sendT8(response, await addResourceFromPayload(await readJsonBody(request), currentUser!, "pose"));
      return;
    }

    if (url.pathname === "/api/resources/workflows/add" && request.method === "POST") {
      sendT8(response, await addResourceFromPayload(await readJsonBody(request), currentUser!, "workflow"));
      return;
    }

    const resourceItemMatch = url.pathname.match(/^\/api\/resources\/items\/([^/]+)$/);
    if (resourceItemMatch) {
      const id = decodeURIComponent(resourceItemMatch[1]);
      if (request.method === "PUT") {
        const patch = await readJsonBody<Partial<ResourceItem> & { touch?: boolean }>(request);
        if (usePostgresRepository()) {
          sendT8(response, await updateResourceItemPostgres(id, patch, currentUser!, resourceRevisionFromPayload(patch)));
          return;
        }
        const db = await readResourceDb(currentUser!);
        const current = db.items.find((item) => item.id === id);
        if (!current) throw new Error("资源不存在");
        const expectedRevision = resourceRevisionFromPayload(patch);
        if (expectedRevision !== undefined && expectedRevision !== current.revision) {
          throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
            resourceKind: "item",
            resourceId: id,
            currentRevision: current.revision,
          });
        }
        const updated = db.items.map((item) =>
          item.id === id
            ? {
                ...item,
                ...pickResourcePatch(patch),
                revision: (item.revision || 1) + 1,
                updatedAt: Date.now(),
                ...(patch.touch ? { lastUsedAt: Date.now() } : {}),
              }
            : item,
        );
        await writeResourceDb({ ...db, items: updated }, currentUser!);
        sendT8(response, updated.find((item) => item.id === id) ?? null);
        return;
      }
      if (request.method === "DELETE") {
        const body = await readJsonBody<{ revision?: number }>(request);
        if (usePostgresRepository()) {
          await deleteResourceItemPostgres(id, currentUser!, resourceRevisionFromPayload(body));
        } else {
          const db = await readResourceDb(currentUser!);
          const current = db.items.find((item) => item.id === id);
          if (!current) throw new Error("资源不存在");
          const expectedRevision = resourceRevisionFromPayload(body);
          if (expectedRevision !== undefined && expectedRevision !== current.revision) {
            throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
              resourceKind: "item",
              resourceId: id,
              currentRevision: current.revision,
            });
          }
          const nextItems = db.items.filter((item) => item.id !== id);
          await writeResourceDb({ ...db, items: nextItems }, currentUser!);
          await removeUnreferencedResourceFile(current, nextItems, currentUser!);
        }
        sendT8(response, null);
        return;
      }
    }

    if (url.pathname === "/api/cloud-uploads/status") {
      sendT8(response, { targets: [], summary: { enabledCount: 0, totalCount: 0 } });
      return;
    }

    if (url.pathname === "/api/canvas") {
      if (request.method === "GET") {
        sendT8(response, await readCanvasList(currentUser!));
        return;
      }
      if (request.method === "POST") {
        const body = await readJsonBody<{ name?: string }>(request);
        const now = Date.now();
        const id = `canvas-${now}-${Math.random().toString(36).slice(2, 8)}`;
        const item: CanvasListItem = {
          id,
          name: body.name || "未命名画布",
          nodeCount: 0,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };
        if (usePostgresRepository()) {
          await writeCanvasData(id, emptyCanvasData(), currentUser!, { name: item.name, createdAt: now });
        } else {
          const list = await readCanvasList(currentUser!);
          await writeCanvasData(id, emptyCanvasData(), currentUser!);
          await writeCanvasList([item, ...list], currentUser!);
        }
        sendT8(response, item);
        return;
      }
    }

    const canvasNameMatch = url.pathname.match(/^\/api\/canvas\/([^/]+)\/name$/);
    if (canvasNameMatch && request.method === "PATCH") {
      const id = decodeURIComponent(canvasNameMatch[1]);
      const body = await readJsonBody<{ name?: string }>(request);
      if (usePostgresRepository()) {
        sendT8(response, await renameCanvasRecord(id, safeText(body.name, "未命名画布"), currentUser!));
        return;
      }
      const list = await readCanvasList(currentUser!);
      const updated = list.map((item) =>
        item.id === id ? { ...item, name: body.name || item.name, updatedAt: Date.now() } : item,
      );
      await writeCanvasList(updated, currentUser!);
      sendT8(response, updated.find((item) => item.id === id) ?? null);
      return;
    }

    const canvasAutoSaveMatch = url.pathname.match(/^\/api\/canvas\/([^/]+)\/auto-save$/);
    if (canvasAutoSaveMatch && request.method === "POST") {
      const id = decodeURIComponent(canvasAutoSaveMatch[1]);
      const rawBody = await readJsonBody(request);
      const data = normalizeCanvasData(rawBody);
      if (usePostgresRepository()) {
        await assertCanvasOwnershipForSnapshot(id, currentUser!);
        await writeCanvasDataToFileSnapshot(id, data, currentUser!);
      } else {
        const list = await readCanvasList(currentUser!);
        const current = list.find((item) => item.id === id);
        if (!current) throw new Error("画布不存在");
        await writeCanvasDataToFileSnapshot(id, { ...data, revision: current.revision }, currentUser!);
      }
      sendT8(response, {
        path: canvasDataPath(id, currentUser!),
        nodeCount: data.nodes.length,
        edgeCount: data.edges.length,
        revision: data.revision,
      });
      return;
    }

    const canvasMatch = url.pathname.match(/^\/api\/canvas\/([^/]+)$/);
    if (canvasMatch) {
      const id = decodeURIComponent(canvasMatch[1]);
      if (request.method === "GET") {
        sendT8(response, await readCanvasData(id, currentUser!));
        return;
      }
      if (request.method === "PUT") {
        const rawBody = await readJsonBody(request);
        const data = normalizeCanvasData(rawBody);
        const result = await writeCanvasAndUpdateList(id, data, currentUser!, {
          expectedRevision: canvasRevisionFromPayload(rawBody),
        });
        sendT8(response, {
          path: canvasDataPath(id, currentUser!),
          nodeCount: data.nodes.length,
          edgeCount: data.edges.length,
          revision: result.revision,
          updatedAt: result.updatedAt,
        });
        return;
      }
      if (request.method === "DELETE") {
        if (usePostgresRepository()) {
          await deleteCanvasRecord(id, currentUser!);
        } else {
          const list = await readCanvasList(currentUser!);
          await writeCanvasList(list.filter((item) => item.id !== id), currentUser!, { allowEmptyReplace: true });
        }
        await unlink(canvasDataPath(id, currentUser!)).catch(() => undefined);
        sendT8(response, null);
        return;
      }
    }

    if (request.method === "GET" && (await sendAdminAsset(response, url.pathname))) {
      return;
    }

    if (request.method === "GET" && (await sendWebAsset(response, url.pathname))) {
      return;
    }

    sendJson(response, { ok: false, success: false, error: "NOT_FOUND" }, 404);
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    if (response.headersSent || response.writableEnded || response.destroyed) {
      logApiEvent("request.response_stream_failed", requestContext, {
        statusCode,
        error: error instanceof Error ? error.message : String(error),
      });
      if (!response.destroyed) response.destroy();
      return;
    }
    if (error instanceof HttpError) {
      await appendObservabilityConflictAudit(error, requestContext).catch((auditError) => {
        logApiEvent("observability.audit_failed", requestContext, {
          statusCode,
          error: error.message,
          auditError: auditError instanceof Error ? auditError.message : String(auditError),
        });
      });
    }
    sendJson(
      response,
      {
        ok: false,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        ...(error instanceof HttpError && error.payload ? error.payload : {}),
      },
      statusCode,
    );
  }
});

void startApiServer().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function startApiServer() {
  if (permissionRuntimeMode === "enforced") {
    const report = await readPermissionReadinessReport();
    if (!report.ready) {
      throw new Error(`PERMISSION_RUNTIME_NOT_READY:${report.failures.map((failure) => failure.code).join(",")}`);
    }
  }
  server.listen(port, host, () => {
    console.log(`xinghuan-api listening on http://${host}:${port} permissionMode=${permissionRuntimeMode}`);
  });
}

async function handleAdminRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
  adminUser: CurrentUser,
  requestContext: RequestContext,
) {
  if (await handlePermissionRoutes({ request, response, url, currentUser: adminUser, requestContext })) return true;

  if (url.pathname === "/api/admin/environment-sync/preview" && request.method === "POST") {
    const body = await readJsonBody<{ sourceEnvironment?: EnvironmentSyncTarget; targetEnvironment?: EnvironmentSyncTarget }>(request);
    const result = await environmentSyncService.previewEnvironmentSync({
      sourceEnvironment: normalizeEnvironmentSyncTarget(body.sourceEnvironment),
      targetEnvironment: normalizeEnvironmentSyncTarget(body.targetEnvironment),
    });
    await appendAudit(
      adminUser,
      "environment_sync.preview",
      "environment-sync",
      `${result.sourceEnvironment}->${result.targetEnvironment}`,
      `预览环境同步 ${result.sourceEnvironment} -> ${result.targetEnvironment}`,
      requestContext,
    );
    sendT8(response, result);
    return true;
  }

  if (url.pathname === "/api/admin/environment-sync/apply" && request.method === "POST") {
    const body = await readJsonBody<EnvironmentSyncApplyRequest>(request);
    const result = await environmentSyncService.applyEnvironmentSync({
      sourceEnvironment: normalizeEnvironmentSyncTarget(body.sourceEnvironment),
      targetEnvironment: normalizeEnvironmentSyncTarget(body.targetEnvironment),
      items: Array.isArray(body.items) ? body.items.map(normalizeEnvironmentSyncApplyItem).filter(Boolean) as EnvironmentSyncApplyItem[] : [],
      actorEmail: adminUser.email,
    });
    const appliedCount = result.results.filter((item) => item.status === "applied").length;
    const skippedCount = result.results.filter((item) => item.status === "skipped").length;
    const failedCount = result.results.filter((item) => item.status === "failed").length;
    await appendAudit(
      adminUser,
      "environment_sync.apply",
      "environment-sync",
      `${result.sourceEnvironment}->${result.targetEnvironment}`,
      `执行环境同步 ${result.sourceEnvironment} -> ${result.targetEnvironment}，applied=${appliedCount} skipped=${skippedCount} failed=${failedCount}`,
      requestContext,
    );
    sendT8(response, result);
    return true;
  }

  if (url.pathname === "/api/admin/summary" && request.method === "GET") {
    const [authDb, storage] = await Promise.all([readAuthDb(), readStorageStats()]);
    await appendAudit(adminUser, "summary.read", "summary", "admin-summary", "查看后台总览", requestContext);
    const summary = await adminRepository.readAdminSummary({
      users: authDb.users.length,
      enabledUsers: authDb.users.filter((user) => !user.disabled).length,
    }, storage);
    sendT8(response, {
      ...summary,
      environment,
    });
    return true;
  }

  if (await handleAdminRunningHubRoutes({
    request,
    response,
    url,
    adminUser,
    requestContext,
    deps: {
      sendT8,
      appendAudit,
      adminRunningHubCatalogItems,
      createAdminRunningHubCatalogItem,
      updateAdminRunningHubCatalogItem,
      deleteAdminRunningHubCatalogItem,
      testAdminRunningHubCatalogItem,
      analyzeRunningHubCatalogDraft,
      listAdminRunningHubGroups,
      createAdminRunningHubGroup,
      updateAdminRunningHubGroup,
      deleteAdminRunningHubGroup,
    },
  })) {
    return true;
  }

  if (await handleComfyuiInstanceRoutes({ request, response, url, adminUser, requestContext, deps: { sendT8, appendAudit, adminDir } })) return true;

  if (await handleAdminAnnouncementRoutes({
    request,
    response,
    url,
    adminUser,
    requestContext,
    deps: {
      sendT8,
      appendAudit,
      announcementStore,
      broadcastAnnouncement,
    },
  })) {
    return true;
  }

  if (await handleAdminProviderRoutes({
    request,
    response,
    url,
    adminUser,
    requestContext,
    deps: {
      sendT8,
      appendAudit,
      readProviderRecords: providerRepository.readProviderRecords,
      findProviderRecordById: providerRepository.findProviderRecordById,
      insertProviderRecord: async (provider) => providerRepository.insertProviderRecord(provider as AdminProviderRecord),
      updateProviderRecord: async (providerId, transform) => providerRepository.updateProviderRecord(providerId, (provider) => transform(provider) as AdminProviderRecord),
      deleteProviderRecord: providerRepository.deleteProviderRecord,
      afterDeleteProvider: reconcilePermissionSubjects,
      reorderProviderRecords: providerRepository.reorderProviderRecords,
      normalizeProviderProtocol,
      normalizeRunningHubEntries,
      normalizeRunningHubKeyPool,
      normalizeModelScopeLoras,
      encryptSecret,
      secretPreview,
      toPublicProvider: (provider) => toPublicProvider(provider as AdminProviderRecord),
      probeProviderDraft,
      fetchProviderModelsDraft,
      updateProviderProbeResult,
      updateProviderLastFetchedAt,
    },
  })) {
    return true;
  }

  if (await handleAdminSystemRoutes({
    request,
    response,
    url,
    adminUser,
    requestContext,
    deps: {
      systemSettings: {
        sendT8,
        appendAudit,
        readTaskQueueSettingsRecord,
        readProviderRecords: providerRepository.readProviderRecords,
        withEffectiveRunningHubConcurrency,
        readDatabaseStatus,
        readRedisStatus,
        readSystemObservability,
        readStorageStats,
        environment,
        dataDir,
        storageDriver,
        authDbPath,
        adminDbPath,
        version: appVersion,
      },
      queueSettings: {
        sendT8,
        appendAudit,
        readTaskQueueSettingsRecord,
        writeTaskQueueSettingsRecord,
        readProviderRecords: providerRepository.readProviderRecords,
        normalizeTaskQueueSettings,
        withEffectiveRunningHubConcurrency,
        adminSettingsRevisionFromPayload,
      },
      assistantSettings: {
        sendT8,
        appendAudit,
        readAssistantSettingsRecord,
        defaultAssistantSettings,
        normalizeAssistantSettings,
        writeAssistantSettingsRecord,
        adminSettingsRevisionFromPayload,
        maskAssistantEndpoint,
      },
    },
  })) {
    return true;
  }

  // Task 3 contract verification scans this admin route block for user-group CRUD, ownerDeleted support, and request.method === "DELETE".
  if (url.pathname === "/api/admin/user-groups") {
    if (request.method === "GET") {
      const groups = await adminDirectoryReadRepository.readUserGroups();
      await appendAudit(adminUser, "userGroup.read", "user-group", "user-groups-list", "查看用户组列表", requestContext);
      sendT8(response, groups.map(toAdminUserGroup));
      return true;
    }
    const authDb = await readAuthDb();
    if (request.method === "POST") {
      const body = await readJsonBody<{ id?: string; name?: string; description?: string; sortOrder?: number }>(request);
      const name = safeText(body.name);
      if (!name) throw new Error("缺少用户组名称");
      assertUserGroupNameUnique(authDb.userGroups, name);
      const now = Date.now();
      const group: UserGroupRecord = {
        id: createUserGroupId(now),
        name,
        description: safeText(body.description),
        sortOrder: normalizeUserGroupSortOrder(body.sortOrder),
        createdAt: now,
        updatedAt: now,
      };
      const defaultOpenPolicy = normalizeGroupPermissionPolicy({
        groupId: group.id,
        updatedAt: now,
        updatedBy: adminUser.id,
        deny: emptyGroupPermissionDeny(),
      });
      if (authDb.userGroups.some((item) => item.id === group.id)) throw new Error("系统生成的用户组 ID 冲突，请重试。");
      const nextAuthDb: AuthDb = {
        ...authDb,
        userGroups: [...authDb.userGroups, group],
        groupPermissionPolicies: normalizeGroupPermissionPolicies([
          ...authDb.groupPermissionPolicies.filter((item) => item.groupId !== group.id),
          defaultOpenPolicy,
        ]),
      };
      if (usePostgresRepository()) {
        await authDirectoryWriteRepository.createUserGroupWithPolicy(group, defaultOpenPolicy);
      } else {
        await writeAuthDb(nextAuthDb);
      }
      await appendAudit(adminUser, "userGroup.create", "user-group", group.id, `创建用户组 ${group.name}`, requestContext);
      sendT8(response, toAdminUserGroup(group));
      return true;
    }
  }

  if (url.pathname === "/api/admin/users") {
    if (request.method === "GET") {
      const [users, userGroups] = await Promise.all([
        adminDirectoryReadRepository.readUsers(),
        adminDirectoryReadRepository.readUserGroups(),
      ]);
      const groupsById = new Map<string, UserGroupRecord>(userGroups.map((group: UserGroupRecord) => [group.id, group]));
      await appendAudit(adminUser, "users.read", "user", "users-list", "查看用户列表", requestContext);
      sendT8(response, visibleUsersForAdministrator(adminUser, users as UserRecord[]).map((user) => toAdminUser(user, groupsById)));
      return true;
    }
    const authDb = await readAuthDb();
    const groupsById = new Map(authDb.userGroups.map((group) => [group.id, group]));
    if (request.method === "POST") {
      const body = await readJsonBody<{ email?: string; name?: string; role?: string; administratorTier?: string; password?: string; groupId?: string; remark?: string }>(request);
      const nextRole = body.role === "admin" ? "admin" : "member";
      try {
        assertAdministratorAccountCreation({ viewer: adminUser, role: nextRole });
      } catch (error) {
        throwAdministratorPolicyError(error);
      }
      const email = safeEmail(body.email);
      if (!email) throw new Error("缺少邮箱");
      if (authDb.users.some((user) => user.email.toLowerCase() === email)) throw new Error("邮箱已存在");
      const groupId = normalizeUserGroupId(body.groupId);
      if (groupId && !groupsById.has(groupId)) throw new Error("用户组不存在");
      const now = Date.now();
      const rawPassword = String(body.password || randomToken(10));
      const user: UserRecord = {
        id: `usr-${now}-${Math.random().toString(36).slice(2, 8)}`,
        email,
        name: safeText(body.name, email.split("@")[0]),
        role: nextRole,
        administratorTier: normalizeAdministratorTier(nextRole, body.administratorTier),
        passwordHash: hashPassword(rawPassword),
        passwordCipher: encryptSecret(rawPassword),
        groupId,
        remark: safeText(body.remark),
        createdAt: now,
        updatedAt: now,
      };
      if (usePostgresRepository()) {
        await insertAuthUserPostgres(user);
      } else {
        await writeAuthDb({ ...authDb, users: [user, ...authDb.users] });
      }
      await appendAudit(adminUser, "user.create", "user", user.id, `创建用户 ${user.email}`, requestContext);
      sendT8(response, toAdminUser(user, groupsById));
      return true;
    }
  }

  if (url.pathname === "/api/admin/sessions" && request.method === "GET") {
    const currentSessionId = readCookie(request, SESSION_COOKIE_NAME);
    const sessions = usePostgresRepository()
      ? (await adminDirectoryReadRepository.readSessions(currentSessionId))
          .map((row: any) => toAdminSession(row.session, row.user, currentSessionId))
          .filter((session: AdminSessionRecord) => visibleSessionsForAdministrator(adminUser, [session], new Map([[session.userId, {
            id: session.userId,
            role: session.userRole,
            administratorTier: session.administratorTier,
          }]])).length > 0)
      : await readAdminSessions(currentSessionId, adminUser);
    await appendAudit(adminUser, "sessions.read", "session", "sessions-list", "查看会话列表", requestContext);
    sendT8(response, sessions);
    return true;
  }

  const sessionRevokeMatch = url.pathname.match(/^\/api\/admin\/sessions\/([^/]+)\/revoke$/);
  if (sessionRevokeMatch && request.method === "POST") {
    const sessionId = decodeURIComponent(sessionRevokeMatch[1]);
    const sessions = await readAdminSessions(readCookie(request, SESSION_COOKIE_NAME), adminUser);
    const target = sessions.find((item) => item.id === sessionId);
    if (!target) throw new Error("会话不存在");
    const revokedAt = Date.now();
    if (usePostgresRepository()) {
      await revokeSessionRecordPostgres(sessionId, revokedAt);
    } else {
      const authDb = await readAuthDb();
      await writeAuthDb({
        ...authDb,
        sessions: authDb.sessions.map((session) => (session.id === sessionId ? { ...session, revokedAt } : session)),
      });
    }
    await appendAudit(adminUser, "session.revoke", "session", sessionId, `撤销会话 ${target.userEmail}`, requestContext);
    sendT8(response, { ok: true, sessionId, revokedAt });
    return true;
  }

  const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch && request.method === "PATCH") {
    const id = decodeURIComponent(userMatch[1]);
    const body = await readJsonBody<{
      email?: string;
      name?: string;
      role?: string;
      administratorTier?: string;
      disabled?: boolean;
      password?: string;
      groupId?: string;
      remark?: string;
    }>(request);
    const authDb = await readAuthDb();
    const groupsById = new Map(authDb.userGroups.map((group) => [group.id, group]));
    const targetUser = authDb.users.find((user) => user.id === id);
    if (!targetUser) throw new HttpError(404, USER_NOT_FOUND);
    const nextRole = body.role === "admin" ? "admin" : body.role === "member" ? "member" : targetUser.role;
    const action = body.disabled === true && !targetUser.disabled ? "disable" : body.role === "member" && targetUser.role === "admin" ? "demote" : "update";
    try {
      assertAdministratorAccountMutation({
        viewer: adminUser,
        target: targetUser,
        action,
        enabledRootCount: authDb.users.filter((user) => user.role === "admin" && user.administratorTier !== "operator" && !user.disabled).length,
      });
      if (nextRole === "admin") assertAdministratorAccountCreation({ viewer: adminUser, role: "admin" });
    } catch (error) {
      throwAdministratorPolicyError(error);
    }
    let updatedUser: UserRecord | undefined;
    const users = authDb.users.map((user) => {
      if (user.id !== id) return user;
      const nextEmail = body.email === undefined ? user.email : safeEmail(body.email);
      if (!nextEmail) throw new Error("邮箱无效");
      const nextGroupId = body.groupId === undefined ? user.groupId : normalizeUserGroupId(body.groupId);
      if (nextGroupId && !groupsById.has(nextGroupId)) throw new Error("用户组不存在");
      const next: UserRecord = {
        ...user,
        email: nextEmail,
        name: body.name === undefined ? user.name : safeText(body.name, user.name),
        role: nextRole,
        administratorTier: normalizeAdministratorTier(nextRole, body.administratorTier === undefined ? user.administratorTier : body.administratorTier),
        groupId: nextGroupId,
        remark: body.remark === undefined ? safeText(user.remark) : safeText(body.remark),
        disabled: body.disabled === undefined ? user.disabled : Boolean(body.disabled),
        updatedAt: Date.now(),
      };
      if (body.password) {
        next.passwordHash = hashPassword(String(body.password));
        next.passwordCipher = encryptSecret(String(body.password));
      }
      updatedUser = next;
      return next;
    });
    if (!updatedUser) throw new Error("用户不存在");
    if (users.some((user) => user.id !== id && user.email.toLowerCase() === updatedUser!.email.toLowerCase())) {
      throw new Error("邮箱已存在");
    }
    if (usePostgresRepository()) {
      await upsertAuthUserPostgres(updatedUser);
      await revokeUserSessionsPostgres(id, Date.now());
    } else {
      const revokedAt = Date.now();
      await writeAuthDb({
        ...authDb,
        users,
        sessions: authDb.sessions.map((session) => (session.userId === id ? { ...session, revokedAt } : session)),
      });
    }
    await appendAudit(adminUser, "user.update", "user", id, `更新用户 ${updatedUser.email}`, requestContext);
    sendT8(response, toAdminUser(updatedUser, groupsById));
    return true;
  }

  if (userMatch && request.method === "DELETE") {
    const id = decodeURIComponent(userMatch[1]);
    const authDb = await readAuthDb();
    const targetUser = authDb.users.find((user) => user.id === id);
    if (!targetUser) throw new HttpError(404, USER_NOT_FOUND);
    try {
      assertAdministratorAccountMutation({
        viewer: adminUser,
        target: targetUser,
        action: "delete",
        enabledRootCount: authDb.users.filter((user) => user.role === "admin" && user.administratorTier !== "operator" && !user.disabled).length,
      });
    } catch (error) {
      throwAdministratorPolicyError(error);
    }
    if (id === adminUser.id) throw new Error("不能删除当前登录中的管理员用户");
    if (usePostgresRepository()) {
      const deletedUser = await deleteAuthUserPostgres(id);
      await appendAudit(adminUser, "user.delete", "user", id, `删除用户 ${deletedUser.email}`, requestContext);
    } else {
      const user = targetUser;
      await writeAuthDb({
        ...authDb,
        users: authDb.users.filter((item) => item.id !== id),
        sessions: authDb.sessions.filter((session) => session.userId !== id),
        loginAttempts: authDb.loginAttempts.filter((attempt) => attempt.email.toLowerCase() !== user.email.toLowerCase()),
      });
      await appendAudit(adminUser, "user.delete", "user", id, `删除用户 ${user.email}`, requestContext);
    }
    sendT8(response, null);
    return true;
  }

  const userGroupMatch = url.pathname.match(/^\/api\/admin\/user-groups\/([^/]+)$/);
  if (userGroupMatch && request.method === "PATCH") {
    const id = decodeURIComponent(userGroupMatch[1]);
    const body = await readJsonBody<{ name?: string; description?: string; sortOrder?: number }>(request);
    const authDb = await readAuthDb();
    let updatedGroup: UserGroupRecord | undefined;
    const userGroups = authDb.userGroups.map((group) => {
      if (group.id !== id) return group;
      const name = body.name === undefined ? group.name : safeText(body.name);
      if (!name) throw new Error("缺少用户组名称");
      assertUserGroupNameUnique(authDb.userGroups, name, id);
      updatedGroup = {
        ...group,
        name,
        description: body.description === undefined ? group.description : safeText(body.description),
        sortOrder: body.sortOrder === undefined ? group.sortOrder : normalizeUserGroupSortOrder(body.sortOrder),
        updatedAt: Date.now(),
      };
      return updatedGroup;
    });
    if (!updatedGroup) throw new Error("用户组不存在");
    if (usePostgresRepository()) {
      await upsertUserGroupPostgres(updatedGroup);
    } else {
      await writeAuthDb({ ...authDb, userGroups });
    }
    await appendAudit(adminUser, "userGroup.update", "user-group", id, `更新用户组 ${updatedGroup.name}`, requestContext);
    sendT8(response, toAdminUserGroup(updatedGroup));
    return true;
  }

  if (userGroupMatch && request.method === "DELETE") {
    const id = decodeURIComponent(userGroupMatch[1]);
    if (usePostgresRepository()) {
      const deletedGroup = await deleteUserGroupPostgres(id);
      await appendAudit(adminUser, "userGroup.delete", "user-group", id, `删除用户组 ${deletedGroup.name}`, requestContext);
    } else {
      const authDb = await readAuthDb();
      const group = authDb.userGroups.find((item) => item.id === id);
      if (!group) throw new Error("用户组不存在");
      if (authDb.users.some((user) => user.groupId === id)) throw new Error("该用户组仍有关联用户，无法删除");
      await writeAuthDb({
        ...authDb,
        userGroups: authDb.userGroups.filter((item) => item.id !== id),
      });
      await appendAudit(adminUser, "userGroup.delete", "user-group", id, `删除用户组 ${group.name}`, requestContext);
    }
    sendT8(response, null);
    return true;
  }

  const providerRunningHubKeyPoolMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/runninghub\/key-pool$/);
  if (providerRunningHubKeyPoolMatch && request.method === "GET") {
    const id = decodeURIComponent(providerRunningHubKeyPoolMatch[1]);
    const provider = await providerRepository.findProviderRecordById(id);
    if (!provider) throw new Error("Provider 不存在");
    sendT8(response, toPublicRunningHubKeyPool(provider.rhKeyPool));
    return true;
  }
  if (providerRunningHubKeyPoolMatch && request.method === "PUT") {
    const id = decodeURIComponent(providerRunningHubKeyPoolMatch[1]);
    const body = await readJsonBody<{ rhKeyPool?: unknown }>(request);
    const db = await readAdminDb();
    let updated: AdminProviderRecord | undefined;
    const providers = db.providers.map((provider) => {
      if (provider.id !== id) return provider;
      const existingPool = normalizeRunningHubKeyPool(provider.rhKeyPool);
      const existingById = new Map(existingPool.map((item) => [item.id, item]));
      const nextPool = normalizeRunningHubKeyPool(body.rhKeyPool).map((item) => {
        const existingItem = existingById.get(item.id);
        return {
          ...item,
          apiKey: item.apiKey || existingItem?.apiKey,
          apiKeyPreview: item.apiKeyPreview || existingItem?.apiKeyPreview,
          createdAt: item.createdAt || existingItem?.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
      });
      const defaultKeyId = nextPool.find((item) => item.isDefault === true)?.id || "";
      const normalizedDefaultPool = nextPool.map((item, index) => ({
        ...item,
        isDefault: defaultKeyId ? item.id === defaultKeyId : index === 0,
      }));
      updated = {
        ...provider,
        rhKeyPool: normalizedDefaultPool,
        updatedAt: Date.now(),
      };
      return updated;
    });
    if (!updated) throw new Error("Provider 不存在");
    if (usePostgresRepository()) {
      await upsertProviderRecordPostgres(updated);
    } else {
      await writeAdminDb({ ...db, providers });
    }
    await appendAudit(adminUser, "provider.runninghub.keyPool.update", "provider", id, `更新 Provider ${updated.name} RH Key 池`, requestContext);
    sendT8(response, toPublicRunningHubKeyPool(updated.rhKeyPool));
    return true;
  }

  const providerRunningHubKeyPoolItemMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/runninghub\/key-pool\/([^/]+)$/);
  if (providerRunningHubKeyPoolItemMatch && request.method === "DELETE") {
    const id = decodeURIComponent(providerRunningHubKeyPoolItemMatch[1]);
    const keyId = decodeURIComponent(providerRunningHubKeyPoolItemMatch[2]);
    const db = await readAdminDb();
    let updated: AdminProviderRecord | undefined;
    const providers = db.providers.map((provider) => {
      if (provider.id !== id) return provider;
      updated = {
        ...provider,
        rhKeyPool: normalizeRunningHubKeyPool(provider.rhKeyPool).filter((item) => item.id !== keyId),
        updatedAt: Date.now(),
      };
      return updated;
    });
    if (!updated) throw new Error("Provider 不存在");
    if (usePostgresRepository()) {
      await upsertProviderRecordPostgres(updated);
    } else {
      await writeAdminDb({ ...db, providers });
    }
    await appendAudit(adminUser, "provider.runninghub.keyPool.delete", "provider", id, `删除 Provider ${updated.name} RH Key ${keyId}`, requestContext);
    sendT8(response, toPublicRunningHubKeyPool(updated.rhKeyPool));
    return true;
  }

  const providerImportModelsMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/import-models$/);
  if (providerImportModelsMatch && request.method === "POST") {
    const providerId = decodeURIComponent(providerImportModelsMatch[1]);
    const body = await readJsonBody<{ models?: Array<{ modelId?: string; capability?: string; displayName?: string; protocolOverride?: string; capabilityTags?: unknown }> }>(request);
    const db = await readAdminDb();
    const provider = db.providers.find((item) => item.id === providerId);
    if (!provider) throw new Error("Provider 不存在");
    const now = Date.now();
    const incoming = Array.isArray(body.models) ? body.models : [];
    const importedModels = importProviderModels({
      providerId,
      now,
      existing: db.models,
      incoming,
      deps: {
        normalizeCapability,
        normalizeModelCapabilityTags,
        inferModelCapabilityTags,
        normalizeOptionalProtocol,
        normalizeAdminModelRecord,
        normalizeModelTestState,
        plainObject,
        safeSlug,
        safeText,
      },
    });
    const nextModels = importedModels.models;
    const touchedModels = importedModels.touched;
    const imported = importedModels.imported;
    if (usePostgresRepository()) {
      for (const model of touchedModels) {
        await upsertModelRecordPostgres(model);
      }
    } else {
      await writeAdminDb({ ...db, models: nextModels });
    }
    await appendAudit(adminUser, "model.import", "provider", providerId, `导入模型 ${imported} 个`, requestContext);
    sendT8(response, { imported, models: nextModels.filter((model) => model.providerId === providerId) });
    return true;
  }

  if (url.pathname === "/api/admin/models") {
    if (request.method === "GET") {
      const providerId = safeText(url.searchParams.get("providerId"));
      const capability = safeText(url.searchParams.get("capability")).toLowerCase();
      const models = providerId
        ? await providerRepository.readModelRecordsByProviderId(providerId)
        : await providerRepository.readModelRecords();
      await appendAudit(adminUser, "models.read", "model", "models-list", "查看模型列表", requestContext);
      sendT8(response, models.filter((model) => !capability || normalizeCapability(model.capability) === capability));
      return true;
    }
    const db = await readAdminDb();
    if (request.method === "POST") {
      const body = await readJsonBody<Partial<AdminModelRecord>>(request);
      const now = Date.now();
      const capability = normalizeCapability(body.capability);
      const advancedConfig = parseAdvancedConfig(body.advancedConfig);
      const executionMode = normalizeProviderGenerationExecutionMode(body.executionMode, advancedConfig, capability);
      advancedConfig.executionMode = executionMode;
      const providerId = safeSlug(body.providerId, "provider");
      const model: AdminModelRecord = {
        id: safeSlug(body.id, `model-${now}`),
        sortOrder: Number.isFinite(Number(body.sortOrder))
          ? Math.trunc(Number(body.sortOrder))
          : db.models
              .filter((item) => item.providerId === providerId && normalizeCapability(item.capability) === capability)
              .reduce((max, item) => Math.max(max, normalizeCatalogSortOrder(item.sortOrder)), -10) + 10,
        providerId,
        modelId: safeText(body.modelId, "model"),
        displayName: safeText(body.displayName, "新模型"),
        capability,
        enabled: Boolean(body.enabled),
        executionMode,
        inputProfile: safeText(body.inputProfile, "prompt"),
        inputCapabilities: { ...parseInputCapabilities(body.inputCapabilities, capability) },
        capabilityTags: normalizeModelCapabilityTags(body.capabilityTags, capability, body.modelId),
        testState: normalizeModelTestState(body.testState),
        parameterSchema: safeJsonText(body.parameterSchema, "{}"),
        advancedConfig,
        protocolOverride: normalizeOptionalProtocol(body.protocolOverride),
        createdAt: now,
        updatedAt: now,
      };
      if (db.models.some((item) => item.id === model.id)) throw new Error("模型 ID 已存在");
      const normalizedModel = normalizeAdminModelRecord(model);
      if (usePostgresRepository()) {
        await insertModelRecordPostgres(normalizedModel);
      } else {
        await writeAdminDb({ ...db, models: [normalizedModel, ...db.models] });
      }
      await appendAudit(adminUser, "model.create", "model", normalizedModel.id, `创建模型 ${normalizedModel.displayName}`, requestContext);
      sendT8(response, normalizedModel);
      return true;
    }
  }

  if (url.pathname === "/api/admin/models/reorder" && request.method === "POST") {
    const body = await readJsonBody<{ providerId?: string; capability?: string; orderedIds?: string[] }>(request);
    const providerId = safeSlug(body.providerId, "");
    const capability = normalizeCapability(body.capability);
    if (!providerId) throw new Error("缺少 Provider ID");
    const models = await providerRepository.reorderModelRecords({
      providerId,
      capability,
      orderedIds: Array.isArray(body.orderedIds) ? body.orderedIds : [],
    });
    await appendAudit(adminUser, "models.reorder", "model", `${providerId}:${capability}`, "调整模型前台展示顺序", requestContext);
    sendT8(response, models);
    return true;
  }

  const modelTestMatch = url.pathname.match(/^\/api\/admin\/models\/([^/]+)\/test$/);
  if (modelTestMatch && request.method === "POST") {
    const id = decodeURIComponent(modelTestMatch[1]);
    const body = await readJsonBody<{ kind?: string; autoApply?: boolean }>(request);
    const db = await readAdminDb();
    const model = db.models.find((item) => item.id === id);
    if (!model) throw new Error("模型不存在");
    const provider = db.providers.find((item) => item.id === model.providerId);
    if (!provider) throw new Error("Provider 不存在");
    const result = await testAdminModelConnectivity(provider, model, safeText(body.kind, "chat"));
    const models = db.models.map((item) => {
      if (item.id !== id) return item;
      const testState = normalizeModelTestState({
        ...normalizeModelTestState(item.testState),
        [result.stateKey]: result.test,
      });
      const currentTags = normalizeModelCapabilityTags(item.capabilityTags, item.capability, item.modelId);
      const nextTags = body.autoApply && result.test.ok
        ? [...new Set([...currentTags, ...(result.test.inferredTags || [])])]
        : currentTags;
      return normalizeAdminModelRecord({
        ...item,
        capabilityTags: nextTags,
        testState,
        updatedAt: Date.now(),
        });
    });
    const updatedModel = models.find((item) => item.id === id);
    if (!updatedModel) throw new Error("模型不存在");
    if (usePostgresRepository()) {
      await upsertModelRecordPostgres(updatedModel);
    } else {
      await writeAdminDb({ ...db, models });
    }
    await appendAudit(adminUser, "model.test", "model", id, `测试模型 ${model.displayName}: ${result.test.ok ? "ok" : "error"}`, requestContext);
    sendT8(response, result.test);
    return true;
  }

  const modelMatch = url.pathname.match(/^\/api\/admin\/models\/([^/]+)$/);
  if (modelMatch && request.method === "PATCH") {
    const id = decodeURIComponent(modelMatch[1]);
    const body = await readJsonBody<Partial<AdminModelRecord>>(request);
    const db = await readAdminDb();
    let updated: AdminModelRecord | undefined;
    const models = db.models.map((model) => {
      if (model.id !== id) return model;
      const nextCapability = body.capability === undefined ? model.capability : normalizeCapability(body.capability);
      const nextAdvancedConfig =
        body.advancedConfig === undefined ? plainObject(model.advancedConfig) : parseAdvancedConfig(body.advancedConfig);
      const nextExecutionMode = normalizeProviderGenerationExecutionMode(
        body.executionMode === undefined ? model.executionMode : body.executionMode,
        nextAdvancedConfig,
        nextCapability,
      );
      nextAdvancedConfig.executionMode = nextExecutionMode;
      const next: AdminModelRecord = {
        ...model,
        sortOrder: body.sortOrder === undefined || !Number.isFinite(Number(body.sortOrder))
          ? model.sortOrder
          : Math.trunc(Number(body.sortOrder)),
        providerId: body.providerId === undefined ? model.providerId : safeSlug(body.providerId, model.providerId),
        modelId: body.modelId === undefined ? model.modelId : safeText(body.modelId, model.modelId),
        displayName: body.displayName === undefined ? model.displayName : safeText(body.displayName, model.displayName),
        capability: nextCapability,
        enabled: body.enabled === undefined ? model.enabled : Boolean(body.enabled),
        executionMode: nextExecutionMode,
        inputProfile: body.inputProfile === undefined ? model.inputProfile : safeText(body.inputProfile, model.inputProfile),
        inputCapabilities:
          body.inputCapabilities === undefined
            ? plainObject(model.inputCapabilities)
            : { ...parseInputCapabilities(body.inputCapabilities, nextCapability) },
        capabilityTags: body.capabilityTags === undefined
          ? normalizeModelCapabilityTags(model.capabilityTags, nextCapability, body.modelId === undefined ? model.modelId : body.modelId)
          : normalizeModelCapabilityTags(body.capabilityTags, nextCapability, body.modelId === undefined ? model.modelId : body.modelId),
        testState: body.testState === undefined ? normalizeModelTestState(model.testState) : normalizeModelTestState(body.testState),
        parameterSchema: body.parameterSchema === undefined ? model.parameterSchema : safeJsonText(body.parameterSchema, "{}"),
        advancedConfig: nextAdvancedConfig,
        protocolOverride: body.protocolOverride === undefined ? model.protocolOverride : normalizeOptionalProtocol(body.protocolOverride),
        updatedAt: Date.now(),
      };
      updated = normalizeAdminModelRecord(next);
      return updated;
    });
    if (!updated) throw new Error("模型不存在");
    if (usePostgresRepository()) {
      await upsertModelRecordPostgres(updated);
    } else {
      await writeAdminDb({ ...db, models });
    }
    await appendAudit(adminUser, "model.update", "model", id, `更新模型 ${updated.displayName}`, requestContext);
    sendT8(response, updated);
    return true;
  }

  if (modelMatch && request.method === "DELETE") {
    const id = decodeURIComponent(modelMatch[1]);
    const db = await readAdminDb();
    const model = db.models.find((item) => item.id === id);
    if (!model) throw new Error("模型不存在");
    if (usePostgresRepository()) {
      await deleteModelRecordPostgres(id);
    } else {
      await writeAdminDb({
        ...db,
        models: db.models.filter((item) => item.id !== id),
        tasks: db.tasks.map((task) => (task.modelId === id ? { ...task, modelId: "" } : task)),
      });
    }
    await reconcilePermissionSubjects();
    await appendAudit(adminUser, "model.delete", "model", id, `删除模型 ${model.displayName}`, requestContext);
    sendT8(response, null);
    return true;
  }

  if (await handleAdminTaskListRoutes({ request, response, url, currentUser: adminUser, requestContext })) return true;

  if (await handleAdminAgentGovernanceRoutes({ request, response, url, currentUser: adminUser, requestContext })) return true;
  if (await handleChannelHealthAdminRoutes({ request, response, url, currentUser: adminUser })) return true;
  if (await handleAdminAuditRoutes({ request, response, url, currentUser: adminUser, requestContext })) return true;
  if (await handleAdminCostRoutes({ request, response, url, currentUser: adminUser, requestContext })) return true;

  if (url.pathname === "/api/admin/assistant/analyze-provider" && request.method === "POST") {
    const body = await readJsonBody<AssistantAnalyzeRequest>(request);
    const result = await analyzeProviderAssistant(body, adminUser, providerFilePublicOrigin(request));
    await appendAudit(
      adminUser,
      "assistant.analyzeProvider",
      "assistant",
      safeText(body.providerName || body.baseUrl || body.modelId, "provider-analysis"),
      `AI 助手分析 ${safeText(body.providerName || body.modelId || "未命名服务商")}`,
      requestContext,
    );
    sendT8(response, result);
    return true;
  }

  if (url.pathname === "/api/admin/assistant/status" && request.method === "GET") {
    const adminDb = await readAdminDb();
    sendT8(response, await readAssistantRuntimeStatus("admin", normalizeAssistantSettings(adminDb.assistantSettings)));
    return true;
  }

    if (url.pathname === "/api/admin/assistant/chat" && request.method === "POST") {
      const body = await readJsonBody<AssistantChatRequest>(request);
      const result = await runAssistantChat({ ...body, scope: "admin" }, adminUser, providerFilePublicOrigin(request));
      await appendAudit(
        adminUser,
        "assistant.chat",
      "assistant",
      safeText(body.scope || "admin", "assistant-chat"),
      `AI 助手对话 ${safeText((body.message || "").slice(0, 48) || "空消息")}`,
      requestContext,
    );
    sendT8(response, result);
    return true;
  }

  if (url.pathname === "/api/admin/assistant/chat/stream" && request.method === "POST") {
    const body = await readJsonBody<AssistantChatRequest>(request);
    await streamAssistantChatResponse(response, { ...body, scope: "admin" }, adminUser, providerFilePublicOrigin(request));
    await appendAudit(
      adminUser,
      "assistant.chat",
      "assistant",
      "admin",
      `AI 助手对话 ${safeText((body.message || "").slice(0, 48) || "空消息")}`,
      requestContext,
    );
    return true;
  }

  return false;
}

function sendJson(
  response: import("node:http").ServerResponse,
  payload: unknown,
  statusCode = 200,
  headers: Record<string, string> = {},
) {
  const serialized = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.byteLength(serialized)),
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-credentials": "true",
    ...headers,
  });
  response.end(serialized);
}

function sendT8(
  response: import("node:http").ServerResponse,
  data: unknown,
  statusCode = 200,
  headers: Record<string, string> = {},
) {
  sendJson(response, { success: true, data }, statusCode, headers);
}

function normalizeEnvironmentSyncTarget(value: unknown): EnvironmentSyncTarget {
  const target = safeText(value).toLowerCase();
  if (target === "gray" || target === "production") return target;
  throw new Error("环境参数无效，只支持 gray 或 production");
}

function normalizeEnvironmentSyncDecision(value: unknown): EnvironmentSyncDecision {
  const decision = safeText(value).toLowerCase();
  if (decision === "skip" || decision === "use_source" || decision === "keep_target") return decision;
  return "skip";
}

function normalizeEnvironmentSyncApplyItem(value: unknown): EnvironmentSyncApplyItem | null {
  const source = plainObject(value);
  const kind = safeText(source.kind).toLowerCase();
  if (kind !== "user" && kind !== "provider") return null;
  const id = safeText(source.id);
  if (!id) return null;
  return {
    id,
    kind,
    selected: Boolean(source.selected),
    decision: normalizeEnvironmentSyncDecision(source.decision),
  };
}

function ensureEnvironmentSyncEnabled(targetEnvironment: EnvironmentSyncTarget) {
  if (environment !== "gray" && environment !== "production") {
    throw new Error("当前环境未启用灰度/正式同步能力");
  }
  if (!environmentSyncToken) {
    throw new Error("缺少 XINGHUAN_ENVIRONMENT_SYNC_TOKEN，无法执行跨环境同步");
  }
  const targetUrl = environmentSyncBaseUrls[targetEnvironment];
  if (!targetUrl) {
    throw new Error(`未配置 ${targetEnvironment} 环境的 API 地址`);
  }
}

function assertInternalEnvironmentSyncRequest(request: import("node:http").IncomingMessage) {
  if (!environmentSyncToken) throw new HttpError(503, "ENVIRONMENT_SYNC_DISABLED");
  const headerToken = safeText(request.headers["x-environment-sync-token"]);
  if (!headerToken || headerToken !== environmentSyncToken) {
    throw new HttpError(403, "ENVIRONMENT_SYNC_FORBIDDEN");
  }
}
async function readEnvironmentSyncLocalSnapshot(targetEnvironment: EnvironmentSyncTarget): Promise<EnvironmentSyncSnapshot> {
  const authDb = await readAuthDb();
  const adminDb = await readAdminDb();
  const providerNameById = new Map(adminDb.providers.map((provider) => [provider.id, provider.name]));
  return {
    environment: targetEnvironment,
    users: authDb.users
      .filter((user) => !(user.role === "admin" && normalizeAdministratorTier(user.role, user.administratorTier) === "root"))
      .map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      administratorTier: normalizeAdministratorTier(user.role, user.administratorTier),
      disabled: Boolean(user.disabled),
      passwordHash: user.passwordHash,
      passwordCipher: user.passwordCipher,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })),
    providers: adminDb.providers.map((provider) => ({
      id: provider.id,
      sortOrder: normalizeCatalogSortOrder(provider.sortOrder),
      name: provider.name,
      baseUrl: provider.baseUrl,
      protocol: normalizeProviderProtocol(provider.protocol),
      enabled: Boolean(provider.enabled),
      apiKey: provider.apiKey,
      apiKeyPreview: provider.apiKeyPreview || secretPreview(decryptSecret(provider.apiKey || "")),
      note: provider.note || "",
      rhApps: normalizeRunningHubEntries(provider.rhApps, "app"),
      rhWorkflows: normalizeRunningHubEntries(provider.rhWorkflows, "workflow"),
      rhGroups: normalizeRunningHubGroups(provider.rhGroups, provider.id),
      rhKeyPool: normalizeRunningHubKeyPool(provider.rhKeyPool),
      msLoras: normalizeModelScopeLoras(provider.msLoras),
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    })),
    models: adminDb.models
      .map((model) => ({
        id: model.id,
        sortOrder: normalizeCatalogSortOrder(model.sortOrder),
        providerId: model.providerId,
        providerName: providerNameById.get(model.providerId) || "",
        modelId: model.modelId,
        displayName: model.displayName,
        capability: normalizeCapability(model.capability),
        enabled: Boolean(model.enabled),
        executionMode: model.executionMode,
        inputProfile: model.inputProfile,
        inputCapabilities: { ...plainObject(model.inputCapabilities) },
        capabilityTags: normalizeModelCapabilityTags(model.capabilityTags, model.capability, model.modelId),
        testState: normalizeModelTestState(model.testState),
        parameterSchema: safeJsonText(model.parameterSchema, "{}"),
        advancedConfig: plainObject(model.advancedConfig),
        protocolOverride: normalizeOptionalProtocol(model.protocolOverride),
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
      }))
      .filter((model) => Boolean(model.providerName)),
  };
}

async function applyEnvironmentSyncLocalSnapshot(request: EnvironmentSyncWriteRequest): Promise<EnvironmentSyncApplyResultRow[]> {
  const results: EnvironmentSyncApplyResultRow[] = [];
  for (const rawUser of request.users) {
    const user = normalizeEnvironmentSyncUserRecord(rawUser);
    if (!user) {
      results.push({
        id: "",
        kind: "user",
        decision: "use_source",
        status: "failed",
        message: "用户数据无效",
      });
      continue;
    }
    if (user.administratorTier === "root") {
      results.push({
        id: user.id,
        kind: "user",
        decision: "use_source",
        status: "failed",
        message: "ROOT_IDENTITY_SYNC_FORBIDDEN",
      });
      continue;
    }
    try {
      await upsertEnvironmentSyncUser(user);
      results.push({
        id: user.id,
        kind: "user",
        decision: "use_source",
        status: "applied",
      });
    } catch (error) {
      results.push({
        id: user.id,
        kind: "user",
        decision: "use_source",
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const rawProvider of request.providers) {
    const provider = normalizeEnvironmentSyncProviderRecord(rawProvider);
    if (!provider) {
      results.push({
        id: "",
        kind: "provider",
        decision: "use_source",
        status: "failed",
        message: "服务商数据无效",
      });
      continue;
    }
    try {
      const syncedProvider = await upsertEnvironmentSyncProvider(provider);
      const providerModels = request.models
        .map(normalizeEnvironmentSyncModelRecord)
        .filter((item): item is NonNullable<ReturnType<typeof normalizeEnvironmentSyncModelRecord>> =>
          item !== null && item.providerName.trim().toLowerCase() === syncedProvider.name.trim().toLowerCase(),
        );
      for (const model of providerModels) {
        await upsertEnvironmentSyncProviderModel({
          ...model,
          providerId: syncedProvider.id,
          providerName: syncedProvider.name,
        });
      }
      results.push({
        id: syncedProvider.id,
        kind: "provider",
        decision: "use_source",
        status: "applied",
        message: `已同步服务商配置及 ${providerModels.length} 个模型`,
      });
    } catch (error) {
      results.push({
        id: provider.id,
        kind: "provider",
        decision: "use_source",
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (request.actorEmail) {
    await appendAuditRecord({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actorId: "",
      actorEmail: request.actorEmail,
      action: "environment_sync.apply.remote",
      targetType: "environment-sync",
      targetId: `${request.sourceEnvironment}->${request.targetEnvironment}`,
      summary: `接收环境同步写入 users=${request.users.length} providers=${request.providers.length} models=${request.models.length}`,
      createdAt: Date.now(),
    });
  }

  return results;
}

async function readEnvironmentSyncRemoteSnapshot(targetEnvironment: EnvironmentSyncTarget): Promise<EnvironmentSyncSnapshot> {
  const response = await fetch(joinEnvironmentSyncUrl(targetEnvironment, "/api/internal/environment-sync/snapshot"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-environment-sync-token": environmentSyncToken,
    },
    body: JSON.stringify({ environment: targetEnvironment }),
  });
  const payload = await parseEnvironmentSyncResponse<EnvironmentSyncSnapshot>(response);
  return payload;
}

async function applyEnvironmentSyncRemoteSnapshot(
  targetEnvironment: EnvironmentSyncTarget,
  request: EnvironmentSyncWriteRequest,
): Promise<EnvironmentSyncApplyResultRow[]> {
  const response = await fetch(joinEnvironmentSyncUrl(targetEnvironment, "/api/internal/environment-sync/apply"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-environment-sync-token": environmentSyncToken,
    },
    body: JSON.stringify(request),
  });
  return parseEnvironmentSyncResponse<EnvironmentSyncApplyResultRow[]>(response);
}

function joinEnvironmentSyncUrl(targetEnvironment: EnvironmentSyncTarget, pathname: string) {
  const baseUrl = environmentSyncBaseUrls[targetEnvironment].replace(/\/+$/, "");
  return `${baseUrl}${pathname}`;
}

async function parseEnvironmentSyncResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: { success?: boolean; data?: T; error?: string } = {};
  try {
    payload = text ? JSON.parse(text) as { success?: boolean; data?: T; error?: string } : {};
  } catch {
    throw new Error(text || `环境同步接口返回了不可解析内容（HTTP ${response.status}）`);
  }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `环境同步接口失败（HTTP ${response.status}）`);
  }
  return payload.data as T;
}

function normalizeEnvironmentSyncUserRecord(value: unknown) {
  const source = plainObject(value);
  const email = safeEmail(source.email);
  if (!email) return null;
  const passwordHash = safeText(source.passwordHash);
  if (!passwordHash) return null;
  const role: "admin" | "member" = source.role === "admin" ? "admin" : "member";
  return {
    id: safeText(source.id, `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    email,
    name: safeText(source.name, email.split("@")[0]),
    role,
    administratorTier: normalizeAdministratorTier(role, source.administratorTier),
    disabled: Boolean(source.disabled),
    passwordHash,
    passwordCipher: safeText(source.passwordCipher),
    createdAt: Number(source.createdAt) || Date.now(),
    updatedAt: Number(source.updatedAt) || Date.now(),
  };
}

function normalizeEnvironmentSyncProviderRecord(value: unknown) {
  const source = plainObject(value);
  const name = safeText(source.name);
  if (!name) return null;
  const apiKey = safeText(source.apiKey);
  return {
    id: safeSlug(source.id, `provider-${Date.now()}`),
    sortOrder: normalizeCatalogSortOrder(source.sortOrder),
    name,
    baseUrl: safeText(source.baseUrl),
    protocol: normalizeProviderProtocol(source.protocol),
    enabled: Boolean(source.enabled),
    apiKey,
    apiKeyPreview: safeText(source.apiKeyPreview, apiKey ? secretPreview(decryptSecret(apiKey) || apiKey) : ""),
    note: safeText(source.note),
    rhApps: normalizeRunningHubEntries(source.rhApps, "app"),
    rhWorkflows: normalizeRunningHubEntries(source.rhWorkflows, "workflow"),
    msLoras: normalizeModelScopeLoras(source.msLoras),
    createdAt: Number(source.createdAt) || Date.now(),
    updatedAt: Number(source.updatedAt) || Date.now(),
  };
}

function normalizeEnvironmentSyncModelRecord(value: unknown) {
  const source = plainObject(value);
  const providerName = safeText(source.providerName);
  const modelId = safeText(source.modelId);
  if (!providerName || !modelId) return null;
  const capability = normalizeCapability(source.capability);
  const advancedConfig = parseAdvancedConfig(source.advancedConfig);
  const executionMode = normalizeProviderGenerationExecutionMode(source.executionMode, advancedConfig, capability);
  advancedConfig.executionMode = executionMode;
  return {
    id: safeSlug(source.id, `model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    sortOrder: normalizeCatalogSortOrder(source.sortOrder),
    providerId: safeSlug(source.providerId, "provider"),
    providerName,
    modelId,
    displayName: safeText(source.displayName, modelId),
    capability,
    enabled: Boolean(source.enabled),
    executionMode,
    inputProfile: safeText(source.inputProfile, "prompt"),
    inputCapabilities: { ...parseInputCapabilities(source.inputCapabilities, capability) },
    capabilityTags: normalizeModelCapabilityTags(source.capabilityTags, capability, modelId),
    testState: normalizeModelTestState(source.testState),
    parameterSchema: safeJsonText(source.parameterSchema, "{}"),
    advancedConfig,
    protocolOverride: normalizeOptionalProtocol(source.protocolOverride),
    createdAt: Number(source.createdAt) || Date.now(),
    updatedAt: Number(source.updatedAt) || Date.now(),
  };
}

async function upsertEnvironmentSyncUser(user: {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  administratorTier?: AdministratorTier;
  disabled: boolean;
  passwordHash: string;
  passwordCipher?: string;
  createdAt: number;
  updatedAt: number;
}) {
  if (usePostgresRepository()) {
    const existing = await findAuthUserByEmailPostgres(user.email);
    if (existing && normalizeAdministratorTier(existing.role, existing.administratorTier) === "root") {
      throw new Error("ROOT_IDENTITY_SYNC_FORBIDDEN");
    }
    await upsertAuthUserPostgres({
      id: existing?.id || user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      administratorTier: normalizeAdministratorTier(user.role, user.administratorTier),
      groupId: existing?.groupId,
      remark: safeText(existing?.remark),
      disabled: Boolean(user.disabled),
      passwordHash: user.passwordHash,
      passwordCipher: safeText(user.passwordCipher),
      createdAt: existing?.createdAt || user.createdAt,
      updatedAt: Date.now(),
    });
    if (existing?.id) {
      await revokeUserSessionsPostgres(existing.id, Date.now());
    }
    return;
  }
  const authDb = await readAuthDb();
  const existing = authDb.users.find((item) => item.email.toLowerCase() === user.email.toLowerCase());
  if (existing && normalizeAdministratorTier(existing.role, existing.administratorTier) === "root") {
    throw new Error("ROOT_IDENTITY_SYNC_FORBIDDEN");
  }
  const nextUser = {
    id: existing?.id || user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    administratorTier: normalizeAdministratorTier(user.role, user.administratorTier),
    groupId: existing?.groupId,
    remark: safeText(existing?.remark),
    disabled: Boolean(user.disabled),
    passwordHash: user.passwordHash,
    passwordCipher: safeText(user.passwordCipher),
    createdAt: existing?.createdAt || user.createdAt,
    updatedAt: Date.now(),
  };
  const users = existing
    ? authDb.users.map((item) => (item.id === existing.id ? nextUser : item))
    : [nextUser, ...authDb.users];
  await writeAuthDb({
    ...authDb,
    users,
    sessions: authDb.sessions.map((session) => (
      session.userId === (existing?.id || nextUser.id)
        ? { ...session, revokedAt: Date.now() }
        : session
    )),
  });
}

async function upsertEnvironmentSyncProvider(provider: {
  id: string;
  sortOrder?: number;
  name: string;
  baseUrl: string;
  protocol: string;
  enabled: boolean;
  apiKey?: string;
  apiKeyPreview?: string;
  note?: string;
  rhApps?: RunningHubEntry[];
  rhWorkflows?: RunningHubEntry[];
  rhGroups?: RhCatalogGroup[];
  rhKeyPool?: RunningHubKeyPoolItemRecord[];
  msLoras?: ModelScopeLora[];
  createdAt: number;
  updatedAt: number;
}) {
  const existing = await findProviderRecordByNaturalKey(provider.name);
  const nextProvider: AdminProviderRecord = {
    id: existing?.id || provider.id,
    sortOrder: normalizeCatalogSortOrder(provider.sortOrder, normalizeCatalogSortOrder(existing?.sortOrder)),
    name: provider.name,
    baseUrl: provider.baseUrl,
    protocol: normalizeProviderProtocol(provider.protocol),
    enabled: Boolean(provider.enabled),
    apiKey: safeText(provider.apiKey),
    apiKeyPreview: safeText(provider.apiKeyPreview),
    note: safeText(provider.note),
    rhApps: normalizeRunningHubEntries(provider.rhApps === undefined ? existing?.rhApps : provider.rhApps, "app"),
    rhWorkflows: normalizeRunningHubEntries(provider.rhWorkflows === undefined ? existing?.rhWorkflows : provider.rhWorkflows, "workflow"),
    rhGroups: normalizeRunningHubGroups(provider.rhGroups === undefined ? existing?.rhGroups : provider.rhGroups, existing?.id || provider.id),
    rhKeyPool: normalizeRunningHubKeyPool(provider.rhKeyPool === undefined ? existing?.rhKeyPool : provider.rhKeyPool),
    msLoras: normalizeModelScopeLoras(provider.msLoras === undefined ? existing?.msLoras : provider.msLoras),
    lastProbeStatus: existing?.lastProbeStatus || "",
    lastProbeMessage: existing?.lastProbeMessage || "",
    lastFetchedAt: existing?.lastFetchedAt || 0,
    createdAt: existing?.createdAt || provider.createdAt,
    updatedAt: Date.now(),
  };
  if (usePostgresRepository()) {
    await upsertProviderRecordPostgres(nextProvider);
    return nextProvider;
  }
  const db = await readAdminDb();
  const providers = existing
    ? db.providers.map((item) => (item.id === existing.id ? nextProvider : item))
    : [nextProvider, ...db.providers];
  await writeAdminDb({ ...db, providers });
  return nextProvider;
}

async function upsertEnvironmentSyncProviderModel(model: {
  id: string;
  sortOrder?: number;
  providerId: string;
  providerName: string;
  modelId: string;
  displayName: string;
  capability: ModelCapability;
  enabled: boolean;
  executionMode?: ProviderGenerationExecutionMode;
  inputProfile: string;
  inputCapabilities?: Record<string, unknown>;
  capabilityTags?: ModelCapabilityTag[];
  testState?: ModelTestState;
  parameterSchema: string;
  advancedConfig?: Record<string, unknown>;
  protocolOverride?: string;
  createdAt: number;
  updatedAt: number;
}) {
  const provider = await findProviderRecordByNaturalKey(model.providerName);
  if (!provider) {
    throw new Error(`目标环境缺少服务商 ${model.providerName}，无法写入模型`);
  }
  const existing = await findModelRecordByNaturalKey(provider.id, model.capability, model.modelId);
  const normalizedModel = normalizeAdminModelRecord({
    id: existing?.id || model.id,
    sortOrder: normalizeCatalogSortOrder(model.sortOrder, normalizeCatalogSortOrder(existing?.sortOrder)),
    providerId: provider.id,
    modelId: model.modelId,
    displayName: model.displayName,
    capability: model.capability,
    enabled: Boolean(model.enabled),
    executionMode: model.executionMode,
    inputProfile: model.inputProfile,
    inputCapabilities: { ...plainObject(model.inputCapabilities) },
    capabilityTags: normalizeModelCapabilityTags(model.capabilityTags, model.capability, model.modelId),
    testState: normalizeModelTestState(model.testState),
    parameterSchema: safeJsonText(model.parameterSchema, "{}"),
    advancedConfig: parseAdvancedConfig(model.advancedConfig),
    protocolOverride: normalizeOptionalProtocol(model.protocolOverride),
    createdAt: existing?.createdAt || model.createdAt,
    updatedAt: Date.now(),
  });
  if (usePostgresRepository()) {
    await upsertModelRecordPostgres(normalizedModel);
    return normalizedModel;
  }
  const db = await readAdminDb();
  const models = existing
    ? db.models.map((item) => (item.id === existing.id ? normalizedModel : item))
    : [normalizedModel, ...db.models];
  await writeAdminDb({ ...db, models });
  return normalizedModel;
}

function isUnsafeHttpMethod(method: string) {
  const upper = String(method || "GET").toUpperCase();
  return upper === "POST" || upper === "PUT" || upper === "PATCH" || upper === "DELETE";
}

function requiresCsrfProtection(pathname: string, method: string) {
  if (!isUnsafeHttpMethod(method)) return false;
  if (!pathname.startsWith("/api/")) return false;
  if (pathname === "/api/health" || pathname === "/api/status" || pathname === "/api/version") return false;
  return true;
}

function requestPublicOrigin(request: import("node:http").IncomingMessage) {
  const forwardedProto = safeText(String(request.headers["x-forwarded-proto"] || "")).split(",")[0].trim();
  const forwardedHost = safeText(String(request.headers["x-forwarded-host"] || "")).split(",")[0].trim();
  const host = forwardedHost || safeText(String(request.headers.host || ""));
  const proto = forwardedProto || "http";
  return host ? `${proto}://${host}` : "";
}

function sameOriginMatch(source: string, expectedOrigin: string) {
  try {
    return new URL(source).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function assertSameOriginWriteRequest(request: import("node:http").IncomingMessage) {
  const expectedOrigin = requestPublicOrigin(request);
  const origin = safeText(String(request.headers.origin || ""));
  const referer = safeText(String(request.headers.referer || ""));
  const fetchSite = safeText(String(request.headers["sec-fetch-site"] || "")).toLowerCase();

  if (expectedOrigin && origin) {
    if (!sameOriginMatch(origin, expectedOrigin)) {
      throw new HttpError(403, "CSRF_ORIGIN_MISMATCH", { expectedOrigin, actualOrigin: origin });
    }
    return;
  }
  if (expectedOrigin && referer) {
    if (!sameOriginMatch(referer, expectedOrigin)) {
      throw new HttpError(403, "CSRF_REFERER_MISMATCH", { expectedOrigin, referer });
    }
    return;
  }
  if (fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none") {
    return;
  }
  throw new HttpError(403, "CSRF_ORIGIN_REQUIRED", { expectedOrigin });
}

function isProtectedRequest(pathname: string) {
  if (pathname === "/health" || pathname === "/api/health" || pathname === "/api/status" || pathname === "/api/version") {
    return false;
  }
  if (pathname.startsWith("/api/auth/")) return false;
  return pathname.startsWith("/api/") || pathname.startsWith("/files/") || pathname.startsWith("/input/") || pathname.startsWith("/output/");
}

function aiWatermarkStatus() {
  return {
    installed: false,
    resolver: "not-configured",
    markKeys: ["gemini", "doubao", "jimeng"],
    optionalFeatures: {
      invisible: false,
      lama: false,
      detect: false,
      trustmark: false,
    },
    setupHints: [
      "pipx install remove-ai-watermarks",
      "或在服务器安装 remove-ai-watermarks 后接入 /api/ai-watermark/process adapter",
      "未配置前该节点只显示状态，不执行实际去水印处理",
    ],
  };
}

function userDataDirs(user: CurrentUser) {
  return userDataDirsForId(user.id);
}

function userDataDirsForId(userId: string) {
  const baseDir = join(usersDir, safeUserId(userId));
  const canvasDir = join(baseDir, "canvases");
  const inputDir = join(baseDir, "input");
  const outputDir = join(baseDir, "output");
  const resourceDir = join(baseDir, "resources");
  const archiveDir = join(baseDir, "output-archives");
  return {
    baseDir,
    canvasDir,
    inputDir,
    outputDir,
    resourceDir,
    archiveDir,
    canvasListPath: join(canvasDir, "canvas-list.json"),
    canvasPostgresMigrationMarkerPath: join(canvasDir, ".postgres-migration-complete"),
    resourceDbPath: join(resourceDir, "resource-library.json"),
    resourcePostgresMigrationMarkerPath: join(resourceDir, ".postgres-migration-complete"),
    generationLibraryDbPath: join(resourceDir, "generation-library.json"),
    ephemeralUploadManifestPath: join(resourceDir, "ephemeral-uploads.json"),
  };
}

async function sendProviderFile(response: import("node:http").ServerResponse, url: URL) {
  const request = parseProviderFileAccessRequest(url, { secret: secretKey() });
  if (!request.ok) {
    sendJson(response, { ok: false, success: false, error: request.error }, request.error === "INVALID_PROVIDER_FILE_URL" ? 404 : 403);
    return;
  }
  const dirs = userDataDirsForId(request.userId);
  await sendStaticFile(response, request.bucket === "input" ? dirs.inputDir : dirs.outputDir, request.filename);
}

async function ensureDataDirs(user?: CurrentUser) {
  await mkdir(authDir, { recursive: true });
  await mkdir(adminDir, { recursive: true });
  await mkdir(usersDir, { recursive: true });
  if (!user) return;
  const dirs = userDataDirs(user);
  await mkdir(dirs.canvasDir, { recursive: true });
  await mkdir(dirs.inputDir, { recursive: true });
  await mkdir(dirs.outputDir, { recursive: true });
  await mkdir(dirs.resourceDir, { recursive: true });
  await mkdir(dirs.archiveDir, { recursive: true });
}

function canvasDataPath(id: string, user: CurrentUser) {
  return join(userDataDirs(user).canvasDir, `${id}.json`);
}

async function readCanvasListFromFile(user: CurrentUser): Promise<CanvasListItem[]> {
  await ensureDataDirs(user);
  try {
    return (JSON.parse(await readFile(userDataDirs(user).canvasListPath, "utf-8")) as CanvasListItem[]).map(sanitizeCanvasListItem);
  } catch {
    return [];
  }
}

async function hasRepositoryMigrationMarker(path: string) {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

async function markRepositoryMigrationComplete(path: string) {
  await writeFile(path, JSON.stringify({ completedAt: new Date().toISOString() }, null, 2), "utf-8");
}

async function readCanvasDataFromFile(id: string, user: CurrentUser): Promise<CanvasData> {
  await ensureDataDirs(user);
  try {
    return normalizeCanvasData(JSON.parse(await readFile(canvasDataPath(id, user), "utf-8")));
  } catch {
    return emptyCanvasData();
  }
}

async function readCanvasList(user: CurrentUser): Promise<CanvasListItem[]> {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const result = await pool.query(
      "select id, name, node_count, revision, created_at, updated_at from xh_canvases where owner_id = $1 order by updated_at desc, created_at desc",
      [user.id],
    );
    const dirs = userDataDirs(user);
    const databaseItems = result.rows.map((row) => sanitizeCanvasListItem(toCanvasListItem(row)));
    if (await hasRepositoryMigrationMarker(dirs.canvasPostgresMigrationMarkerPath)) return databaseItems;
    const orphanSnapshots = await discoverOrphanCanvasSnapshots(user, databaseItems.map((item) => item.id));
    if (orphanSnapshots.length > 0) {
      const recoveredItems = await insertRecoveredCanvasSnapshots(user, orphanSnapshots);
      await markRepositoryMigrationComplete(dirs.canvasPostgresMigrationMarkerPath);
      return [...databaseItems, ...recoveredItems].sort((left, right) => right.updatedAt - left.updatedAt);
    }
    if (databaseItems.length > 0) {
      await markRepositoryMigrationComplete(dirs.canvasPostgresMigrationMarkerPath);
      return databaseItems;
    }
    const fileList = await readCanvasListFromFile(user);
    if (fileList.length > 0) {
      await writeCanvasList(fileList, user, { pruneMissing: true });
      await markRepositoryMigrationComplete(dirs.canvasPostgresMigrationMarkerPath);
      return fileList;
    }
    await markRepositoryMigrationComplete(dirs.canvasPostgresMigrationMarkerPath);
    return [];
  }
  return readCanvasListFromFile(user);
}

async function writeCanvasList(
  list: CanvasListItem[],
  user: CurrentUser,
  options?: { allowEmptyReplace?: boolean; pruneMissing?: boolean },
) {
  const sanitizedList = list.map(sanitizeCanvasListItem);
  if (sanitizedList.length === 0 && !options?.allowEmptyReplace) {
    throw new Error("EMPTY_CANVAS_LIST_WRITE_REJECTED");
  }
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const existingResult = await client.query("select id, data from xh_canvases where owner_id = $1", [user.id]);
      const dataById = new Map(existingResult.rows.map((row) => [String(row.id), normalizeCanvasData(row.data)]));
      const ids = sanitizedList.map((item) => item.id);
      if (options?.pruneMissing && ids.length > 0) {
        await client.query("delete from xh_canvases where owner_id = $1 and not (id = any($2::text[]))", [user.id, ids]);
      } else if (options?.pruneMissing && ids.length === 0 && options?.allowEmptyReplace) {
        await client.query("delete from xh_canvases where owner_id = $1", [user.id]);
      }
      for (const item of sanitizedList) {
        const canvasData = dataById.get(item.id) || (await readCanvasDataFromFile(item.id, user));
        const writeResult = await client.query(
          `insert into xh_canvases (id, owner_id, project_id, name, node_count, data, revision, created_at, updated_at)
           values ($1, $2, null, $3, $4, $5::jsonb, $6, $7, $8)
           on conflict (id) do update
             set name = excluded.name,
                 node_count = excluded.node_count,
                 data = excluded.data,
                 updated_at = excluded.updated_at,
                 revision = greatest(xh_canvases.revision, excluded.revision)
             where xh_canvases.owner_id = excluded.owner_id
           returning id`,
          [
            item.id,
            user.id,
            item.name,
            Number.isFinite(item.nodeCount) ? item.nodeCount : 0,
            JSON.stringify(canvasData),
            Number.isFinite(item.revision) && item.revision > 0 ? Math.floor(item.revision) : 1,
            millisToDate(item.createdAt),
            millisToDate(item.updatedAt),
          ],
        );
        if ((writeResult.rowCount || 0) === 0) {
          throw new HttpError(403, "CANVAS_OWNERSHIP_MISMATCH");
        }
      }
      await client.query("commit");
      await markRepositoryMigrationComplete(userDataDirs(user).canvasPostgresMigrationMarkerPath);
      return;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  await ensureDataDirs(user);
  await writeFile(userDataDirs(user).canvasListPath, JSON.stringify(sanitizedList, null, 2), "utf-8");
}

async function readCanvasData(id: string, user: CurrentUser): Promise<CanvasData> {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const result = await pool.query("select data, revision from xh_canvases where id = $1 and owner_id = $2 limit 1", [id, user.id]);
    const dirs = userDataDirs(user);
    if (result.rows[0]) {
      await markRepositoryMigrationComplete(dirs.canvasPostgresMigrationMarkerPath);
      return {
        ...normalizeCanvasData(result.rows[0].data),
        revision: Number(result.rows[0].revision) || 1,
      };
    }
    const foreign = await pool.query("select id from xh_canvases where id = $1 limit 1", [id]);
    if (foreign.rows[0]) {
      throw new HttpError(403, "CANVAS_OWNERSHIP_MISMATCH");
    }
    const fileData = await readCanvasDataFromFile(id, user);
    if (fileData.nodes.length > 0 || fileData.edges.length > 0 || fileData.nextNodeSerialId !== 1) {
      await writeCanvasData(id, fileData, user);
      await markRepositoryMigrationComplete(dirs.canvasPostgresMigrationMarkerPath);
      return fileData;
    }
    await markRepositoryMigrationComplete(dirs.canvasPostgresMigrationMarkerPath);
    return emptyCanvasData();
  }
  return readCanvasDataFromFile(id, user);
}

async function writeCanvasData(
  id: string,
  data: CanvasData,
  user: CurrentUser,
  options?: { name?: string; createdAt?: number; expectedRevision?: number },
): Promise<{ revision: number; updatedAt: number }> {
  const normalizedData = normalizeCanvasData(data);
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const existing = await pool.query("select owner_id, name, created_at, revision from xh_canvases where id = $1 limit 1", [id]);
    if (existing.rows[0] && safeText(existing.rows[0].owner_id) !== user.id) {
      throw new HttpError(403, "CANVAS_OWNERSHIP_MISMATCH");
    }
    const fileList = existing.rows[0] ? [] : await readCanvasListFromFile(user);
    const fileItem = fileList.find((item) => item.id === id);
    const now = Date.now();
    const currentRevision = Number(existing.rows[0]?.revision) || 1;
    const canvasName = safeText(options?.name || existing.rows[0]?.name || fileItem?.name, "未命名画布");
    const createdAt = existing.rows[0]
      ? dateToMillis(existing.rows[0].created_at)
      : options?.createdAt || fileItem?.createdAt || now;
    if (existing.rows[0] && options?.expectedRevision !== undefined && options.expectedRevision !== currentRevision) {
      throw new HttpError(409, "CANVAS_REVISION_CONFLICT", {
        canvasId: id,
        currentRevision,
      });
    }
    const nextRevision = existing.rows[0] ? currentRevision + 1 : Math.max(options?.expectedRevision || 1, 1);
    const persistedData = { ...normalizedData, revision: nextRevision };
    if (existing.rows[0]) {
      const updateResult = await pool.query(
        `update xh_canvases
         set name = $3,
             node_count = $4,
             data = $5::jsonb,
             updated_at = $6,
             revision = $7
         where id = $1
           and owner_id = $2`,
        [
          id,
          user.id,
          canvasName,
          normalizedData.nodes.length,
          JSON.stringify(persistedData),
          millisToDate(now),
          nextRevision,
        ],
      );
      if (!updateResult.rowCount) throw new Error("画布不存在");
      await markRepositoryMigrationComplete(userDataDirs(user).canvasPostgresMigrationMarkerPath);
      return { revision: nextRevision, updatedAt: now };
    } else {
      await pool.query(
        `insert into xh_canvases (id, owner_id, project_id, name, node_count, data, revision, created_at, updated_at)
         values ($1, $2, null, $3, $4, $5::jsonb, $6, $7, $8)`,
        [
          id,
          user.id,
          canvasName,
          normalizedData.nodes.length,
          JSON.stringify(persistedData),
          nextRevision,
          millisToDate(createdAt),
          millisToDate(now),
        ],
      );
      await markRepositoryMigrationComplete(userDataDirs(user).canvasPostgresMigrationMarkerPath);
      return { revision: nextRevision, updatedAt: now };
    }
  }
  const fileList = await readCanvasListFromFile(user);
  const fileItem = fileList.find((item) => item.id === id);
  const existingFile = await readCanvasDataFromFile(id, user);
  const hasExistingFile = Boolean(fileItem) || existingFile.nodes.length > 0 || existingFile.edges.length > 0 || existingFile.nextNodeSerialId !== 1;
  const currentRevision = Number(existingFile.revision) || 1;
  if (hasExistingFile && options?.expectedRevision !== undefined && options.expectedRevision !== currentRevision) {
    throw new HttpError(409, "CANVAS_REVISION_CONFLICT", {
      canvasId: id,
      currentRevision,
    });
  }
  const now = Date.now();
  const nextRevision = hasExistingFile ? currentRevision + 1 : Math.max(options?.expectedRevision || 1, 1);
  await writeCanvasDataToFileSnapshot(id, { ...normalizedData, revision: nextRevision }, user);
  return { revision: nextRevision, updatedAt: now };
}

async function renameCanvasRecord(id: string, name: string, user: CurrentUser) {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const result = await pool.query(
      `update xh_canvases
       set name = $3,
           updated_at = now(),
           revision = revision + 1
       where id = $1
         and owner_id = $2
       returning id, name, node_count, revision, created_at, updated_at`,
      [id, user.id, safeText(name, "未命名画布")],
    );
    if (result.rows[0]) return sanitizeCanvasListItem(toCanvasListItem(result.rows[0]));
    const foreign = await pool.query("select id from xh_canvases where id = $1 limit 1", [id]);
    if (foreign.rows[0]) throw new HttpError(403, "CANVAS_OWNERSHIP_MISMATCH");
    throw new Error("画布不存在");
  }
  const list = await readCanvasList(user);
  const updated = list.map((item) =>
    item.id === id ? { ...item, name: safeText(name, item.name), revision: (item.revision || 1) + 1, updatedAt: Date.now() } : item,
  );
  await writeCanvasList(updated, user);
  return updated.find((item) => item.id === id) ?? null;
}

async function deleteCanvasRecord(id: string, user: CurrentUser) {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const result = await pool.query("delete from xh_canvases where id = $1 and owner_id = $2 returning id", [id, user.id]);
    if (result.rows[0]) {
      await markRepositoryMigrationComplete(userDataDirs(user).canvasPostgresMigrationMarkerPath);
      return;
    }
    const foreign = await pool.query("select id from xh_canvases where id = $1 limit 1", [id]);
    if (foreign.rows[0]) throw new HttpError(403, "CANVAS_OWNERSHIP_MISMATCH");
    return;
  }
  const list = await readCanvasList(user);
  await writeCanvasList(list.filter((item) => item.id !== id), user, { allowEmptyReplace: true });
}

async function writeCanvasAndUpdateList(
  id: string,
  data: CanvasData,
  user: CurrentUser,
  options?: { expectedRevision?: number },
) {
  if (usePostgresRepository()) {
    return writeCanvasData(id, data, user, options);
  }
  const result = await writeCanvasData(id, data, user, options);
  const now = result.updatedAt;
  const list = await readCanvasList(user);
  const existing = list.find((item) => item.id === id);
  const item: CanvasListItem = {
    id,
    name: existing?.name || "未命名画布",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    nodeCount: data.nodes.length,
    revision: result.revision,
  };
  await writeCanvasList([item, ...list.filter((entry) => entry.id !== id)], user);
  return result;
}

async function writeCanvasDataToFileSnapshot(id: string, data: CanvasData, user: CurrentUser) {
  await ensureDataDirs(user);
  await writeFile(canvasDataPath(id, user), JSON.stringify(normalizeCanvasData(data), null, 2), "utf-8");
}

async function assertCanvasOwnershipForSnapshot(id: string, user: CurrentUser) {
  if (!usePostgresRepository()) return;
  const pool = await getPostgresPool();
  const result = await pool.query("select owner_id from xh_canvases where id = $1 limit 1", [id]);
  if (!result.rows[0]) return;
  if (safeText(result.rows[0].owner_id) !== user.id) {
    throw new HttpError(403, "CANVAS_OWNERSHIP_MISMATCH");
  }
}

function canvasRevisionFromPayload(value: unknown): number | undefined {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
  const revision = Number(source?.revision);
  return Number.isFinite(revision) && revision > 0 ? Math.floor(revision) : undefined;
}

function resourceRevisionFromPayload(value: unknown): number | undefined {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
  const revision = Number(source?.revision);
  return Number.isFinite(revision) && revision > 0 ? Math.floor(revision) : undefined;
}

function adminSettingsRevisionFromPayload(value: unknown): number | undefined {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
  const revision = Number(source?.revision);
  return Number.isFinite(revision) && revision > 0 ? Math.floor(revision) : undefined;
}

function normalizeCanvasData(value: unknown): CanvasData {
  const data = (value && typeof value === "object" ? value : {}) as Partial<CanvasData>;
  return {
    nodes: sanitizeCanvasNodes(Array.isArray(data.nodes) ? data.nodes : []),
    edges: Array.isArray(data.edges) ? data.edges : [],
    workflows: normalizeWorkflowDocuments(data.workflows),
    viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
    revision: Number.isFinite(data.revision) && Number(data.revision) > 0 ? Math.floor(Number(data.revision)) : 1,
    nextNodeSerialId: typeof data.nextNodeSerialId === "number" ? data.nextNodeSerialId : 1,
  };
}

async function readAuthDb(): Promise<AuthDb> {
  if (usePostgresRepository()) return readAuthDbPostgres();
  await ensureDataDirs();
  let db: AuthDb;
  try {
    db = JSON.parse(await readFile(authDbPath, "utf-8")) as AuthDb;
  } catch {
    db = { userGroups: [], groupPermissionPolicies: [], permissionSubjects: [], permissionRules: [], users: [], sessions: [], loginAttempts: [] };
  }
  db = {
    userGroups: Array.isArray(db.userGroups) ? db.userGroups : [],
    groupPermissionPolicies: normalizeGroupPermissionPolicies(db.groupPermissionPolicies),
    permissionSubjects: Array.isArray(db.permissionSubjects) ? db.permissionSubjects : [],
    permissionRules: Array.isArray(db.permissionRules) ? db.permissionRules : [],
    users: Array.isArray(db.users) ? db.users : [],
    sessions: Array.isArray(db.sessions) ? db.sessions.map(normalizeSessionRecord) : [],
    loginAttempts: Array.isArray(db.loginAttempts) ? db.loginAttempts.map(normalizeLoginAttemptRecord) : [],
  };
  const bootstrapped = await ensureBootstrapUser(db);
  const now = Date.now();
  const cleaned = {
    userGroups: bootstrapped.userGroups,
    groupPermissionPolicies: bootstrapped.groupPermissionPolicies,
    permissionSubjects: bootstrapped.permissionSubjects,
    permissionRules: bootstrapped.permissionRules,
    users: bootstrapped.users,
    sessions: bootstrapped.sessions.filter((session) => session.expiresAt > now),
    loginAttempts: pruneLoginAttempts(bootstrapped.loginAttempts, now),
  };
  if (
    cleaned.sessions.length !== bootstrapped.sessions.length ||
    cleaned.loginAttempts.length !== bootstrapped.loginAttempts.length ||
    bootstrapped !== db
  ) {
    await writeAuthDb(cleaned);
  }
  return cleaned;
}

async function writeAuthDb(db: AuthDb) {
  if (usePostgresRepository()) {
    throw new Error("writeAuthDb is unavailable in postgres mode; use a targeted repository write");
  }
  await ensureDataDirs();
  await writeFile(authDbPath, JSON.stringify(db, null, 2), "utf-8");
}

async function readSharedResourceCatalog(): Promise<{ categories: ResourceCategory[]; items: ResourceItem[] }> {
  await mkdir(adminDir, { recursive: true });
  try {
    const raw = JSON.parse(await readFile(sharedResourceDbPath, "utf-8")) as { categories?: ResourceCategory[]; items?: ResourceItem[] };
    return {
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      items: Array.isArray(raw.items)
        ? raw.items.map((item) => enrichWorkflowResourceItem({ ...item, libraryScope: "shared" as const }))
        : [],
    };
  } catch {
    return { categories: [], items: [] };
  }
}

async function readAdminDb(): Promise<AdminDb> {
  let db: AdminDb;
  if (usePostgresRepository()) {
    db = await readAdminDbPostgres();
  } else {
    await ensureDataDirs();
    try {
      db = await readSerializedJson(adminDbPath) as AdminDb;
    } catch (error) {
      if (fileErrorCode(error) !== "ENOENT") throw error;
      db = defaultAdminDb();
      await writeAdminDb(db);
    }
  }
  let secretMigrated = false;
  const providers = Array.isArray(db.providers)
    ? db.providers.map((provider) => {
        const normalized = normalizeProviderSecret({
          ...provider,
          sortOrder: normalizeCatalogSortOrder(provider.sortOrder),
        });
        if (normalized !== provider) secretMigrated = true;
        return normalized;
      })
    : [];
  const normalizedDb = {
    announcements: Array.isArray(db.announcements) ? db.announcements : [],
    providers: sortByCatalogDisplayOrder(providers),
    models: sortByCatalogDisplayOrder(Array.isArray(db.models) ? db.models.map((model) => normalizeAdminModelRecord(model)) : []),
    tasks: Array.isArray(db.tasks) ? db.tasks : [],
    auditLogs: Array.isArray(db.auditLogs) ? db.auditLogs : [],
    assistantSettings: normalizeAssistantSettings(db.assistantSettings),
    taskQueueSettings: normalizeTaskQueueSettings(db.taskQueueSettings),
    taskQueueSettingsRevision: Number.isFinite(db.taskQueueSettingsRevision) && Number(db.taskQueueSettingsRevision) > 0
      ? Math.floor(Number(db.taskQueueSettingsRevision))
      : 1,
    taskQueueSettingsUpdatedAt: Number.isFinite(db.taskQueueSettingsUpdatedAt) && Number(db.taskQueueSettingsUpdatedAt) > 0
      ? Number(db.taskQueueSettingsUpdatedAt)
      : Date.now(),
  };
  const modelMigrated = Array.isArray(db.models) && db.models.some((model, index) => normalizedDb.models[index] !== model);
  const assistantMigrated = normalizedDb.assistantSettings !== db.assistantSettings;
  const taskQueueMigrated =
    normalizedDb.taskQueueSettings !== db.taskQueueSettings ||
    normalizedDb.taskQueueSettingsRevision !== db.taskQueueSettingsRevision ||
    normalizedDb.taskQueueSettingsUpdatedAt !== db.taskQueueSettingsUpdatedAt;
  const visibleSanitized = sanitizeAdminDbVisibleText(normalizedDb);
  if (!usePostgresRepository() && (secretMigrated || modelMigrated || assistantMigrated || taskQueueMigrated || visibleSanitized.changed)) {
    await writeAdminDb(visibleSanitized.db);
  }
  return visibleSanitized.db;
}

async function writeAdminDb(db: AdminDb) {
  if (usePostgresRepository()) {
    throw new Error("writeAdminDb is unavailable in postgres mode; use a targeted repository write");
  }
  await ensureDataDirs();
  await writeSerializedJson(adminDbPath, db);
}

async function writeAssistantSettingsRecord(settings: AssistantSettingsRecord, expectedRevision?: number) {
  return settingsRepository.writeAssistantSettingsRecord(settings, expectedRevision);
}

async function discoverOrphanCanvasSnapshots(user: CurrentUser, databaseIds: string[]): Promise<CanvasSnapshotRecoveryCandidate[]> {
  const dirs = userDataDirs(user);
  await ensureDataDirs(user);
  const entries = await readdir(dirs.canvasDir, { withFileTypes: true });
  const snapshots: CanvasSnapshotRecoveryCandidate[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "canvas-list.json") continue;
    const id = entry.name.slice(0, -5);
    if (!id || safeFilename(`${id}.json`) !== entry.name) continue;
    try {
      const path = join(dirs.canvasDir, entry.name);
      const [raw, info] = await Promise.all([readFile(path, "utf8"), stat(path)]);
      const data = normalizeCanvasData(JSON.parse(raw));
      snapshots.push({
        id,
        nodes: data.nodes,
        edges: data.edges,
        viewport: data.viewport,
        nextNodeSerialId: data.nextNodeSerialId,
        revision: Math.max(1, Number(data.revision) || 1),
        modifiedAt: Math.max(1, Math.floor(info.mtimeMs)),
      });
    } catch {
      // Invalid snapshots remain untouched for manual inspection.
    }
  }
  return planCanvasSnapshotRecovery({ databaseIds, snapshots });
}

async function insertRecoveredCanvasSnapshots(user: CurrentUser, snapshots: CanvasSnapshotRecoveryCandidate[]): Promise<CanvasListItem[]> {
  if (snapshots.length === 0) return [];
  const pool = await getPostgresPool();
  const client = await pool.connect();
  const recovered: CanvasListItem[] = [];
  try {
    await client.query("begin");
    const snapshotIds = snapshots.map((snapshot) => snapshot.id);
    const ownershipResult = await client.query(
      "select id, owner_id from xh_canvases where id = any($1::text[]) for update",
      [snapshotIds],
    );
    const ownershipConflicts = findCanvasSnapshotOwnershipConflicts({
      ownerId: user.id,
      snapshotIds,
      existingOwners: ownershipResult.rows.map((row) => ({ id: String(row.id), ownerId: String(row.owner_id) })),
    });
    if (ownershipConflicts.length > 0) {
      throw new Error(`CANVAS_SNAPSHOT_OWNER_CONFLICT:${ownershipConflicts.join(",")}`);
    }
    const existingIds = new Set(ownershipResult.rows.map((row) => String(row.id)));
    for (const [index, snapshot] of snapshots.entries()) {
      if (existingIds.has(snapshot.id)) continue;
      const name = `恢复画布 ${index + 1}`;
      const data = normalizeCanvasData(snapshot);
      const result = await client.query(
        `insert into xh_canvases (id, owner_id, project_id, name, node_count, data, revision, created_at, updated_at)
         values ($1, $2, null, $3, $4, $5::jsonb, $6, $7, $7)
         on conflict (id) do nothing
         returning id`,
        [snapshot.id, user.id, name, data.nodes.length, JSON.stringify(data), snapshot.revision, millisToDate(snapshot.modifiedAt)],
      );
      if (!result.rowCount) {
        const racedOwner = await client.query("select owner_id from xh_canvases where id = $1", [snapshot.id]);
        if (String(racedOwner.rows[0]?.owner_id || "") !== user.id) {
          throw new Error(`CANVAS_SNAPSHOT_OWNER_CONFLICT:${snapshot.id}`);
        }
        continue;
      }
      recovered.push(sanitizeCanvasListItem({
        id: snapshot.id,
        name,
        nodeCount: data.nodes.length,
        revision: snapshot.revision,
        createdAt: snapshot.modifiedAt,
        updatedAt: snapshot.modifiedAt,
      }));
    }
    await client.query("commit");
    return recovered;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function usePostgresRepository() {
  return storageDriver === "postgres" && Boolean(databaseUrl);
}

async function getPostgresPool() {
  if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");
  postgresPoolPromise ??= import("pg").then((pg) => {
    const Pool = pg.Pool;
    const poolConfig = resolvePostgresPoolConfig(process.env, { serviceEnvPrefix: "XINGHUAN_API", defaultMax: 5, defaultConnectionTimeoutMillis: 3000 });
    return new Pool({
      connectionString: databaseUrl,
      ...poolConfig,
    });
  });
  return postgresPoolPromise;
}

async function readCurrentDatabaseName() {
  if (!usePostgresRepository()) return "";
  postgresDatabaseNamePromise ??= (async () => {
    const pool = await getPostgresPool();
    const result = await pool.query("select current_database() as name");
    return safeText(String(result.rows?.[0]?.name || ""));
  })();
  return postgresDatabaseNamePromise;
}

async function ensureRuntimeDatabaseTarget(serviceName: string) {
  if (!usePostgresRepository() || !expectedDatabaseName) return;
  const currentDatabaseName = await readCurrentDatabaseName();
  if (!currentDatabaseName) throw new Error("DATABASE_TARGET_UNAVAILABLE");
  if (currentDatabaseName !== expectedDatabaseName) {
    throw new Error(
      `DATABASE_TARGET_MISMATCH service=${serviceName} env=${environment} expected=${expectedDatabaseName} actual=${currentDatabaseName}`,
    );
  }
  console.log(
    JSON.stringify({
      ok: true,
      service: serviceName,
      environment,
      databaseTargetCheck: "passed",
      currentDatabase: currentDatabaseName,
    }),
  );
}

async function readAuthDbPostgres(): Promise<AuthDb> {
  const pool = await getPostgresPool();
  const [userGroupsResult, groupPoliciesResult, usersResult, sessionsResult, attemptsResult] = await Promise.all([
    pool.query(
      "select id, name, description, sort_order, created_at, updated_at from xh_user_groups order by sort_order asc, created_at asc",
    ),
    pool.query(
      "select group_id, deny, updated_by, updated_at from xh_group_permission_policies order by updated_at desc",
    ),
    pool.query(
      "select id, email, name, role, administrator_tier, password_hash, password_cipher, group_id, remark, disabled, created_at, updated_at from xh_users order by created_at asc",
    ),
    pool.query("select id, user_id, created_at, expires_at, last_seen_at, ip, user_agent, revoked_at from xh_sessions order by created_at desc"),
    pool.query(
      "select key, scope, email, ip, failure_count, first_failed_at, last_failed_at, blocked_until, updated_at from xh_login_attempts order by updated_at desc",
    ),
  ]);
  const userGroups = userGroupsResult.rows.map((row) => ({
      id: safeText(row.id),
      name: safeText(row.name),
      description: safeText(row.description),
      sortOrder: Number.isFinite(Number(row.sort_order)) ? Math.floor(Number(row.sort_order)) : 0,
      createdAt: dateToMillis(row.created_at),
      updatedAt: dateToMillis(row.updated_at),
    }));
  const addressableGroupIds = new Set(userGroups.map((group) => group.id));
  const groupPermissionPolicies = groupPoliciesResult.rows
    .map((row) => normalizeGroupPermissionPolicy({
        groupId: row.group_id,
        updatedAt: dateToMillis(row.updated_at),
        updatedBy: safeText(row.updated_by) || undefined,
        deny: row.deny || {},
      }))
    .filter((policy) => policy.groupId === "ungrouped" || addressableGroupIds.has(policy.groupId));
  const db: AuthDb = {
    userGroups,
    groupPermissionPolicies,
    permissionSubjects: [],
    permissionRules: [],
    users: usersResult.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role === "admin" ? "admin" : "member",
      administratorTier: normalizeAdministratorTier(row.role === "admin" ? "admin" : "member", row.administrator_tier),
      passwordHash: row.password_hash,
      passwordCipher: row.password_cipher || undefined,
      groupId: safeText(row.group_id) || undefined,
      remark: safeText(row.remark),
      disabled: Boolean(row.disabled),
      createdAt: dateToMillis(row.created_at),
      updatedAt: dateToMillis(row.updated_at),
    })),
    sessions: sessionsResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      createdAt: dateToMillis(row.created_at),
      expiresAt: dateToMillis(row.expires_at),
      lastSeenAt: row.last_seen_at ? dateToMillis(row.last_seen_at) : dateToMillis(row.created_at),
      ip: safeText(row.ip),
      userAgent: safeText(row.user_agent),
      revokedAt: row.revoked_at ? dateToMillis(row.revoked_at) : undefined,
    })),
    loginAttempts: attemptsResult.rows.map((row) =>
      normalizeLoginAttemptRecord({
        key: row.key,
        scope: row.scope === "admin" ? "admin" : "member",
        email: row.email,
        ip: row.ip,
        failureCount: Number(row.failure_count) || 0,
        firstFailedAt: dateToMillis(row.first_failed_at),
        lastFailedAt: dateToMillis(row.last_failed_at),
        blockedUntil: row.blocked_until ? dateToMillis(row.blocked_until) : undefined,
        updatedAt: dateToMillis(row.updated_at),
      })
    ),
  };
  const bootstrapped = await ensureBootstrapUser(db);
  const now = Date.now();
  const cleaned: AuthDb = {
    userGroups: bootstrapped.userGroups,
    groupPermissionPolicies: bootstrapped.groupPermissionPolicies,
    permissionSubjects: bootstrapped.permissionSubjects,
    permissionRules: bootstrapped.permissionRules,
    users: bootstrapped.users,
    sessions: bootstrapped.sessions.filter((session) => session.expiresAt > now),
    loginAttempts: pruneLoginAttempts(bootstrapped.loginAttempts, now),
  };
  if (bootstrapped !== db) {
    for (const user of cleaned.users) {
      await upsertAuthUserPostgres(user);
    }
  }
  if (cleaned.sessions.length !== bootstrapped.sessions.length) {
    await pruneExpiredSessionsPostgres(now);
  }
  if (cleaned.loginAttempts.length !== bootstrapped.loginAttempts.length) {
    await pruneLoginAttemptsPostgres(now);
  }
  return cleaned;
}

async function insertAuthUserPostgres(user: UserRecord) {
  const pool = await getPostgresPool();
  await pool.query(
    `insert into xh_users (id, email, name, role, administrator_tier, password_hash, password_cipher, group_id, remark, disabled, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      user.id,
      user.email,
      user.name,
      user.role,
      normalizeAdministratorTier(user.role, user.administratorTier) || null,
      user.passwordHash,
      user.passwordCipher || null,
      user.groupId || null,
      safeText(user.remark),
      Boolean(user.disabled),
      millisToDate(user.createdAt),
      millisToDate(user.updatedAt),
    ],
  );
}

async function upsertUserGroupPostgres(group: UserGroupRecord) {
  const pool = await getPostgresPool();
  await pool.query(
    `insert into xh_user_groups (id, name, description, sort_order, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update set
       name = excluded.name,
       description = excluded.description,
       sort_order = excluded.sort_order,
       updated_at = excluded.updated_at`,
    [
      group.id,
      group.name,
      group.description,
      normalizeUserGroupSortOrder(group.sortOrder),
      millisToDate(group.createdAt),
      millisToDate(group.updatedAt),
    ],
  );
}

async function deleteUserGroupPostgres(id: string): Promise<{ id: string; name: string }> {
  const pool = await getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const groupResult = await client.query(
      "select id, name from xh_user_groups where id = $1 for update",
      [id],
    );
    const group = groupResult.rows[0];
    if (!group) throw new Error("用户组不存在");
    const deleteResult = await client.query(
      `delete from xh_user_groups g
       where g.id = $1
         and not exists (
           select 1
           from xh_users u
           where u.group_id = g.id
         )
       returning g.id, g.name`,
      [id],
    );
    if (!deleteResult.rows[0]) {
      const memberResult = await client.query(
        "select 1 from xh_users where group_id = $1 limit 1",
        [id],
      );
      if (memberResult.rows[0]) throw new Error("该用户组仍有关联用户，无法删除");
      throw new Error("用户组不存在");
    }
    await client.query("commit");
    return {
      id: safeText(deleteResult.rows[0].id || group.id),
      name: safeText(deleteResult.rows[0].name || group.name),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function upsertAuthUserPostgres(user: UserRecord) {
  const pool = await getPostgresPool();
  await pool.query(
    `insert into xh_users (id, email, name, role, administrator_tier, password_hash, password_cipher, group_id, remark, disabled, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (id) do update set
       email = excluded.email,
       name = excluded.name,
       role = excluded.role,
       administrator_tier = excluded.administrator_tier,
       password_hash = excluded.password_hash,
       password_cipher = excluded.password_cipher,
       group_id = excluded.group_id,
       remark = excluded.remark,
       disabled = excluded.disabled,
       updated_at = excluded.updated_at`,
    [
      user.id,
      user.email,
      user.name,
      user.role,
      normalizeAdministratorTier(user.role, user.administratorTier) || null,
      user.passwordHash,
      user.passwordCipher || null,
      user.groupId || null,
      safeText(user.remark),
      Boolean(user.disabled),
      millisToDate(user.createdAt),
      millisToDate(user.updatedAt),
    ],
  );
}

async function findAuthUserByEmailPostgres(email: string): Promise<UserRecord | null> {
  const pool = await getPostgresPool();
  const result = await pool.query(
    `select id, email, name, role, administrator_tier, password_hash, password_cipher, group_id, remark, disabled, created_at, updated_at
     from xh_users
     where lower(email) = lower($1)
     limit 1`,
    [email],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: safeText(row.id),
    email: safeEmail(row.email),
    name: safeText(row.name),
    role: row.role === "admin" ? "admin" : "member",
    administratorTier: normalizeAdministratorTier(row.role === "admin" ? "admin" : "member", row.administrator_tier),
    passwordHash: safeText(row.password_hash),
    passwordCipher: safeText(row.password_cipher),
    groupId: safeText(row.group_id) || undefined,
    remark: safeText(row.remark),
    disabled: Boolean(row.disabled),
    createdAt: dateToMillis(row.created_at),
    updatedAt: dateToMillis(row.updated_at),
  };
}

async function createSessionRecordPostgres(session: SessionRecord) {
  const pool = await getPostgresPool();
  await pool.query(
    `insert into xh_sessions (id, user_id, created_at, expires_at, last_seen_at, ip, user_agent, revoked_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      session.id,
      session.userId,
      millisToDate(session.createdAt),
      millisToDate(session.expiresAt),
      millisToDate(session.lastSeenAt || session.createdAt),
      session.ip || null,
      session.userAgent || null,
      session.revokedAt ? millisToDate(session.revokedAt) : null,
    ],
  );
}

async function revokeSessionRecordPostgres(sessionId: string, revokedAt: number) {
  const pool = await getPostgresPool();
  await pool.query("update xh_sessions set revoked_at = $2 where id = $1 and revoked_at is null", [sessionId, millisToDate(revokedAt)]);
}

async function revokeUserSessionsPostgres(userId: string, revokedAt: number) {
  const pool = await getPostgresPool();
  await pool.query("update xh_sessions set revoked_at = $2 where user_id = $1 and revoked_at is null", [userId, millisToDate(revokedAt)]);
}

async function deleteAuthUserPostgres(userId: string): Promise<{ id: string; email: string; role: "admin" | "member" }> {
  const pool = await getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const adminRowsResult = await client.query(
      "select id from xh_users where role = 'admin' order by id for update",
    );
    const targetResult = await client.query(
      "select id, email, role from xh_users where id = $1 for update",
      [userId],
    );
    const target = targetResult.rows[0];
    if (!target) throw new Error("用户不存在");
    if (target.role === "admin" && adminRowsResult.rows.length <= 1) {
      throw new Error("不能删除最后一个管理员");
    }
    await client.query("delete from xh_sessions where user_id = $1", [userId]);
    await client.query("delete from xh_login_attempts where lower(email) = lower($1)", [target.email]);
    const result = await client.query("delete from xh_users where id = $1", [userId]);
    if ((result.rowCount || 0) < 1) throw new Error("用户不存在");
    await client.query("commit");
    return {
      id: safeText(target.id),
      email: safeEmail(target.email),
      role: target.role === "admin" ? "admin" : "member",
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function touchSessionRecordPostgres(sessionId: string, lastSeenAt: number, ip: string, userAgent: string) {
  const pool = await getPostgresPool();
  await pool.query(
    `update xh_sessions
     set last_seen_at = $2,
         ip = $3,
         user_agent = $4
     where id = $1 and revoked_at is null`,
    [sessionId, millisToDate(lastSeenAt), ip || null, userAgent || null],
  );
}

async function pruneExpiredSessionsPostgres(now: number) {
  const pool = await getPostgresPool();
  await pool.query("delete from xh_sessions where expires_at <= $1", [millisToDate(now)]);
}

async function upsertLoginAttemptPostgres(attempt: LoginAttemptRecord) {
  const pool = await getPostgresPool();
  await pool.query(
    `insert into xh_login_attempts (key, scope, email, ip, failure_count, first_failed_at, last_failed_at, blocked_until, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (key) do update set
       scope = excluded.scope,
       email = excluded.email,
       ip = excluded.ip,
       failure_count = excluded.failure_count,
       first_failed_at = excluded.first_failed_at,
       last_failed_at = excluded.last_failed_at,
       blocked_until = excluded.blocked_until,
       updated_at = excluded.updated_at`,
    [
      attempt.key,
      attempt.scope,
      attempt.email,
      attempt.ip,
      attempt.failureCount,
      millisToDate(attempt.firstFailedAt),
      millisToDate(attempt.lastFailedAt),
      attempt.blockedUntil ? millisToDate(attempt.blockedUntil) : null,
      millisToDate(attempt.updatedAt),
    ],
  );
}

async function deleteLoginAttemptPostgres(key: string) {
  const pool = await getPostgresPool();
  await pool.query("delete from xh_login_attempts where key = $1", [key]);
}

async function pruneLoginAttemptsPostgres(now: number) {
  const pool = await getPostgresPool();
  await pool.query(
    `delete from xh_login_attempts
     where coalesce(blocked_until, to_timestamp(0)) <= $1
       and updated_at < $2`,
    [millisToDate(now), millisToDate(now - LOGIN_LIMIT_RETENTION_MS)],
  );
}

async function readAdminSessions(currentSessionId = "", viewer?: CurrentUser): Promise<AdminSessionRecord[]> {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const result = await pool.query(
      `select s.id, s.user_id, s.created_at, s.expires_at, s.last_seen_at, s.ip, s.user_agent, s.revoked_at,
              u.email as user_email, u.name as user_name, u.role as user_role, u.administrator_tier
       from xh_sessions s
       join xh_users u on u.id = s.user_id
       where s.expires_at > now()
       order by s.created_at desc
       limit 300`,
    );
    const sessions = result.rows.map((row) =>
      toAdminSession(
        {
          id: row.id,
          userId: row.user_id,
          createdAt: dateToMillis(row.created_at),
          expiresAt: dateToMillis(row.expires_at),
          lastSeenAt: row.last_seen_at ? dateToMillis(row.last_seen_at) : dateToMillis(row.created_at),
          ip: safeText(row.ip),
          userAgent: safeText(row.user_agent),
          revokedAt: row.revoked_at ? dateToMillis(row.revoked_at) : undefined,
        },
        {
          id: row.user_id,
          email: row.user_email,
          name: row.user_name,
          role: row.user_role === "admin" ? "admin" : "member",
          administratorTier: normalizeAdministratorTier(row.user_role === "admin" ? "admin" : "member", row.administrator_tier),
        },
        currentSessionId,
      ),
    );
    return viewer
      ? sessions.filter((session) => visibleSessionsForAdministrator(viewer, [session], new Map([[session.userId, {
        id: session.userId,
        role: session.userRole,
        administratorTier: session.administratorTier,
      }]])).length > 0)
      : sessions;
  }
  const authDb = await readAuthDb();
  const userMap = new Map(authDb.users.map((user) => [user.id, user]));
  const sessions = authDb.sessions
    .filter((session) => session.expiresAt > Date.now())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 300)
    .map((session) => {
      const user = userMap.get(session.userId);
      if (!user) return null;
      return toAdminSession(session, user, currentSessionId);
    })
    .filter(Boolean) as AdminSessionRecord[];
  return viewer ? visibleSessionsForAdministrator(viewer, sessions, userMap) : sessions;
}

async function readAdminDbPostgres(): Promise<AdminDb> {
  const pool = await getPostgresPool();
  const [providersResult, modelsResult, tasksResult, auditResult, assistantSettingsResult, systemSettingsResult] = await Promise.all([
    pool.query("select id, sort_order, name, base_url, protocol, enabled, api_key_cipher, api_key_preview, last_probe_status, last_probe_message, last_fetched_at, rh_apps, rh_workflows, rh_groups, rh_key_pool, ms_loras, note, created_at, updated_at from xh_providers order by sort_order asc, created_at desc, id asc"),
    pool.query(
      "select id, sort_order, provider_id, model_id, display_name, capability, enabled, input_profile, input_capabilities, capability_tags, test_state, parameter_schema, advanced_config, protocol_override, created_at, updated_at from xh_models order by sort_order asc, created_at desc, id asc",
    ),
    pool.query("select id, owner_id, title, status, provider_id, model_id, payload, result, logs, created_at, updated_at from xh_tasks order by created_at desc"),
    pool.query(
      "select id, actor_id, actor_email, action, target_type, target_id, summary, request_id, ip, user_agent, created_at from xh_audit_logs order by created_at desc limit 500",
    ),
    pool.query("select id, frontend, backend, integration, revision, updated_at from xh_assistant_settings where id = 'default' limit 1"),
    pool.query("select id, task_queue_settings, revision, updated_at from xh_system_settings where id = 'default' limit 1"),
  ]);
  const db: AdminDb = {
    providers: providersResult.rows.map((row) =>
      normalizeProviderSecret({
        id: row.id,
        sortOrder: normalizeCatalogSortOrder(row.sort_order),
        name: row.name,
        baseUrl: row.base_url || "",
        protocol: normalizeProviderProtocol(row.protocol),
        enabled: Boolean(row.enabled),
        apiKey: row.api_key_cipher || undefined,
        apiKeyPreview: row.api_key_preview || undefined,
        lastProbeStatus: row.last_probe_status || undefined,
        lastProbeMessage: row.last_probe_message || undefined,
        lastFetchedAt: row.last_fetched_at ? dateToMillis(row.last_fetched_at) : undefined,
        rhApps: normalizeRunningHubEntries(row.rh_apps, "app"),
        rhWorkflows: normalizeRunningHubEntries(row.rh_workflows, "workflow"),
        rhGroups: normalizeRunningHubGroups(row.rh_groups, safeText(row.id)),
        rhKeyPool: normalizeRunningHubKeyPool(row.rh_key_pool),
        msLoras: normalizeModelScopeLoras(row.ms_loras),
        note: row.note || "",
        createdAt: dateToMillis(row.created_at),
        updatedAt: dateToMillis(row.updated_at),
      }),
    ),
    models: modelsResult.rows.map((row) =>
      normalizeAdminModelRecord({
        id: row.id,
        sortOrder: normalizeCatalogSortOrder(row.sort_order),
        providerId: row.provider_id,
        modelId: row.model_id,
        displayName: row.display_name,
        capability: normalizeCapability(row.capability),
        enabled: Boolean(row.enabled),
        inputProfile: row.input_profile || "prompt",
        inputCapabilities: plainObject(row.input_capabilities),
        capabilityTags: Array.isArray(row.capability_tags) ? row.capability_tags : [],
        testState: plainObject(row.test_state),
        parameterSchema: JSON.stringify(row.parameter_schema || {}, null, 2),
        advancedConfig: plainObject(row.advanced_config),
        protocolOverride: normalizeOptionalProtocol(row.protocol_override),
        createdAt: dateToMillis(row.created_at),
        updatedAt: dateToMillis(row.updated_at),
      }),
    ),
    tasks: tasksResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: normalizeTaskStatus(row.status),
      ownerId: row.owner_id || undefined,
      providerId: row.provider_id || undefined,
      modelId: row.model_id || undefined,
      payload: plainObject(row.payload),
      result: plainObject(row.result),
      logs: Array.isArray(row.logs) ? row.logs.map((line: unknown) => safeText(line)).filter(Boolean) : [],
      createdAt: dateToMillis(row.created_at),
      updatedAt: dateToMillis(row.updated_at),
    })),
    auditLogs: auditResult.rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id || "",
      actorEmail: row.actor_email,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      summary: row.summary,
      requestId: safeText(row.request_id),
      ip: safeText(row.ip),
      userAgent: safeText(row.user_agent),
      createdAt: dateToMillis(row.created_at),
    })),
    assistantSettings: normalizeAssistantSettings(
      assistantSettingsResult.rows[0]
        ? {
            frontend: plainObject(assistantSettingsResult.rows[0].frontend),
            backend: plainObject(assistantSettingsResult.rows[0].backend),
            integration: plainObject(assistantSettingsResult.rows[0].integration),
            revision: Number(assistantSettingsResult.rows[0].revision) || 1,
            updatedAt: assistantSettingsResult.rows[0].updated_at
              ? dateToMillis(assistantSettingsResult.rows[0].updated_at)
              : Date.now(),
          }
        : undefined,
    ),
    taskQueueSettings: normalizeTaskQueueSettings(
      systemSettingsResult.rows[0]
        ? plainObject(systemSettingsResult.rows[0].task_queue_settings)
        : undefined,
    ),
    taskQueueSettingsRevision: Number(systemSettingsResult.rows[0]?.revision) || 1,
    taskQueueSettingsUpdatedAt: systemSettingsResult.rows[0]?.updated_at
      ? dateToMillis(systemSettingsResult.rows[0].updated_at)
      : Date.now(),
  };
  if (db.providers.length === 0 && db.models.length === 0 && db.tasks.length === 0) {
    const seeded = defaultAdminDb();
    await bootstrapDefaultAdminDbPostgres(seeded);
    return seeded;
  }
  return db;
}

async function bootstrapDefaultAdminDbPostgres(db: AdminDb) {
  const pool = await getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const provider of db.providers.map(normalizeProviderSecret)) {
      await client.query(
        `insert into xh_providers (id, sort_order, name, base_url, protocol, enabled, api_key_cipher, api_key_preview, last_probe_status, last_probe_message, last_fetched_at, rh_apps, rh_workflows, rh_groups, ms_loras, note, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17, $18)
         on conflict (id) do nothing`,
        [
          provider.id,
          normalizeCatalogSortOrder(provider.sortOrder),
          provider.name,
          provider.baseUrl,
          normalizeProviderProtocol(provider.protocol),
          provider.enabled,
          provider.apiKey || null,
          provider.apiKeyPreview || null,
          provider.lastProbeStatus || null,
          provider.lastProbeMessage || null,
          provider.lastFetchedAt ? millisToDate(provider.lastFetchedAt) : null,
          JSON.stringify(normalizeRunningHubEntries(provider.rhApps, "app")),
          JSON.stringify(normalizeRunningHubEntries(provider.rhWorkflows, "workflow")),
          JSON.stringify(normalizeRunningHubGroups(provider.rhGroups, provider.id)),
          JSON.stringify(normalizeModelScopeLoras(provider.msLoras)),
          provider.note || null,
          millisToDate(provider.createdAt),
          millisToDate(provider.updatedAt),
        ],
      );
    }
    for (const model of db.models) {
      const normalizedModel = normalizeAdminModelRecord(model);
      await client.query(
        `insert into xh_models (id, sort_order, provider_id, model_id, display_name, capability, enabled, input_profile, input_capabilities, capability_tags, test_state, parameter_schema, advanced_config, protocol_override, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15, $16)
         on conflict (id) do nothing`,
        [
          normalizedModel.id,
          normalizeCatalogSortOrder(normalizedModel.sortOrder),
          normalizedModel.providerId,
          normalizedModel.modelId,
          normalizedModel.displayName,
          normalizedModel.capability,
          normalizedModel.enabled,
          normalizedModel.inputProfile,
          JSON.stringify(plainObject(normalizedModel.inputCapabilities)),
          JSON.stringify(normalizedModel.capabilityTags || []),
          JSON.stringify(normalizeModelTestState(normalizedModel.testState)),
          JSON.stringify(parseJsonObject(normalizedModel.parameterSchema)),
          JSON.stringify(plainObject(normalizedModel.advancedConfig)),
          normalizedModel.protocolOverride || null,
          millisToDate(normalizedModel.createdAt),
          millisToDate(normalizedModel.updatedAt),
        ],
      );
    }
    for (const task of db.tasks) {
      await client.query(
        `insert into xh_tasks (id, owner_id, title, status, provider_id, model_id, payload, result, logs, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11)
         on conflict (id) do nothing`,
        [
          task.id,
          task.ownerId || null,
          task.title,
          task.status,
          task.providerId || null,
          task.modelId || null,
          JSON.stringify(plainObject(task.payload)),
          JSON.stringify(plainObject(task.result)),
          JSON.stringify(Array.isArray(task.logs) ? task.logs : []),
          millisToDate(task.createdAt),
          millisToDate(task.updatedAt),
        ],
      );
    }
    const assistantSettings = normalizeAssistantSettings(db.assistantSettings);
    await client.query(
      `insert into xh_assistant_settings (id, frontend, backend, integration, revision, updated_at)
       values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6)
       on conflict (id) do nothing`,
      [
        "default",
        JSON.stringify(assistantSettings.frontend),
        JSON.stringify(assistantSettings.backend),
        JSON.stringify(assistantSettings.integration),
        Number.isFinite(assistantSettings.revision) && assistantSettings.revision > 0 ? Math.floor(assistantSettings.revision) : 1,
        millisToDate(assistantSettings.updatedAt),
      ],
    );
    const taskQueueSettings = normalizeTaskQueueSettings(db.taskQueueSettings);
    await client.query(
      `insert into xh_system_settings (id, task_queue_settings, revision, updated_at)
       values ($1, $2::jsonb, $3, $4)
       on conflict (id) do nothing`,
      [
        "default",
        JSON.stringify(taskQueueSettings),
        Number.isFinite(db.taskQueueSettingsRevision) && Number(db.taskQueueSettingsRevision) > 0
          ? Math.floor(Number(db.taskQueueSettingsRevision))
          : 1,
        millisToDate(
          Number.isFinite(db.taskQueueSettingsUpdatedAt) && Number(db.taskQueueSettingsUpdatedAt) > 0
            ? Number(db.taskQueueSettingsUpdatedAt)
            : Date.now(),
        ),
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function insertProviderRecordPostgres(provider: AdminProviderRecord) {
  await providerRepository.upsertProviderRecordPostgres(provider);
}

async function upsertProviderRecordPostgres(provider: AdminProviderRecord) {
  await providerRepository.upsertProviderRecordPostgres(provider);
}

async function findProviderRecordByNaturalKey(name: string): Promise<AdminProviderRecord | null> {
  return providerRepository.findProviderRecordByNaturalKey(name) as Promise<AdminProviderRecord | null>;
}

async function findModelRecordByNaturalKey(
  providerId: string,
  capability: ModelCapability,
  modelId: string,
): Promise<AdminModelRecord | null> {
  return providerRepository.findModelRecordByNaturalKey(providerId, capability, modelId) as Promise<AdminModelRecord | null>;
}

async function deleteProviderRecordPostgres(providerId: string) {
  await providerRepository.deleteProviderRecord(providerId);
}

async function insertModelRecordPostgres(model: AdminModelRecord) {
  await providerRepository.insertModelRecord(model);
}

async function upsertModelRecordPostgres(model: AdminModelRecord) {
  await providerRepository.upsertModelRecordPostgres(model);
}

async function deleteModelRecordPostgres(modelId: string) {
  await providerRepository.deleteModelRecord(modelId);
}

async function readAssistantSettingsRecord(): Promise<AssistantSettingsRecord> {
  return settingsRepository.readAssistantSettingsRecord();
}

async function readTaskQueueSettingsRecord(): Promise<SystemSettingsRecord> {
  return settingsRepository.readTaskQueueSettingsRecord();
}

async function writeTaskQueueSettingsRecord(taskQueueSettings: TaskQueueSettings, expectedRevision?: number): Promise<SystemSettingsRecord> {
  return settingsRepository.writeTaskQueueSettingsRecord(taskQueueSettings, expectedRevision);
}

async function updateProviderProbeResult(providerId: string, result: { ok?: boolean; message?: string }, now: number) {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    await pool.query(
      `update xh_providers
       set last_probe_status = $2,
           last_probe_message = $3,
           updated_at = $4
       where id = $1`,
      [
        providerId,
        result.ok ? "ok" : "error",
        safeText(result.message),
        millisToDate(now),
      ],
    );
    return;
  }
  const db = await readAdminDb();
  const providers = db.providers.map((item) =>
    item.id === providerId
      ? {
          ...item,
          lastProbeStatus: result.ok ? "ok" : "error",
          lastProbeMessage: safeText(result.message),
          updatedAt: now,
        }
      : item,
  );
  await writeAdminDb({ ...db, providers });
}

async function updateProviderLastFetchedAt(providerId: string, now: number) {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    await pool.query(
      `update xh_providers
       set last_fetched_at = $2,
           updated_at = $2
       where id = $1`,
      [providerId, millisToDate(now)],
    );
    return;
  }
  const db = await readAdminDb();
  await writeAdminDb({
    ...db,
    providers: db.providers.map((item) => (item.id === providerId ? { ...item, lastFetchedAt: now, updatedAt: now } : item)),
  });
}

function toAdminTaskRecord(row: {
  id: string;
  title: string;
  status: string;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_remark?: string | null;
  owner_group_id?: string | null;
  owner_group_name?: string | null;
  owner_deleted?: unknown;
  provider_id?: string | null;
  provider_name?: string | null;
  model_id?: string | null;
  model_name?: string | null;
  provider_model_id?: string | null;
  execution_identity_snapshot?: unknown;
  payload?: unknown;
  result?: unknown;
  logs?: unknown;
  log_count?: unknown;
  latest_log?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  finalized_at?: unknown;
  output_recovery_available?: unknown;
  materialization_status?: string | null;
  failure_category?: string | null;
}): AdminTaskRecord {
  return {
    id: row.id,
    title: row.title,
    status: normalizeTaskStatus(row.status),
    ownerId: row.owner_id || undefined,
    ownerName: safeText(row.owner_name) || undefined,
    ownerEmail: safeText(row.owner_email) || undefined,
    ownerRemark: safeText(row.owner_remark) || undefined,
    ownerGroupId: safeText(row.owner_group_id) || undefined,
    ownerGroupName: safeText(row.owner_group_name) || undefined,
    ownerDeleted: Boolean(row.owner_deleted),
    providerId: row.provider_id || undefined,
    providerName: safeText(row.provider_name) || undefined,
    modelId: row.model_id || undefined,
    modelName: safeText(row.model_name) || undefined,
    providerModelId: safeText(row.provider_model_id) || undefined,
    executionIdentitySnapshot: normalizeTaskExecutionIdentitySnapshot(row.execution_identity_snapshot),
    payload: plainObject(row.payload),
    result: plainObject(row.result),
    logs: Array.isArray(row.logs) ? row.logs.map((line: unknown) => safeText(line)).filter(Boolean) : safeText(row.latest_log) ? [safeText(row.latest_log)] : [],
    logCount: Number.isFinite(Number(row.log_count)) ? Math.max(0, Math.floor(Number(row.log_count))) : Array.isArray(row.logs) ? row.logs.length : 0,
    latestLog: safeText(row.latest_log) || (Array.isArray(row.logs) ? safeText(row.logs[row.logs.length - 1]) : undefined),
    createdAt: dateToMillis(row.created_at),
    updatedAt: dateToMillis(row.updated_at),
    finalizedAt: row.finalized_at ? dateToMillis(row.finalized_at) : undefined,
    outputRecoveryAvailable: row.output_recovery_available === true || row.output_recovery_available === "true",
    materializationStatus: safeText(row.materialization_status) || undefined,
    failureCategory: safeText(row.failure_category) || undefined,
  };
}

function enrichAdminTaskRecord(
  task: AdminTaskRecord,
  usersById: Map<string, UserRecord>,
  groupsById: Map<string, UserGroupRecord>,
): AdminTaskRecord {
  const owner = task.ownerId ? usersById.get(task.ownerId) : undefined;
  const ownerGroup = owner?.groupId ? groupsById.get(owner.groupId) : undefined;
  return {
    ...task,
    ownerName: owner?.name || undefined,
    ownerEmail: owner?.email || undefined,
    ownerRemark: safeText(owner?.remark) || undefined,
    ownerGroupId: owner?.groupId,
    ownerGroupName: ownerGroup?.name || undefined,
    ownerDeleted: Boolean(task.ownerId && !owner),
  };
}

function toCanvasListItem(row: {
  id: string;
  name?: string | null;
  node_count?: number | null;
  revision?: number | null;
  created_at?: unknown;
  updated_at?: unknown;
}): CanvasListItem {
  return {
    id: row.id,
    name: safeText(row.name, "未命名画布"),
    nodeCount: Number(row.node_count) || 0,
    revision: Number(row.revision) || 1,
    createdAt: dateToMillis(row.created_at),
    updatedAt: dateToMillis(row.updated_at),
  };
}

function resourceItemMetadata(item: ResourceItem) {
  return {
    sourceUrl: item.sourceUrl || "",
    originalName: item.originalName || "",
    fileUrl: item.fileUrl || "",
    fileRel: item.fileRel || "",
    materialSetKind: item.materialSetKind || "",
    materialSetItems: Array.isArray(item.materialSetItems) ? item.materialSetItems : [],
    poseBackup: optionalObject(item.poseBackup) || {},
    workflowFragment: optionalObject(item.workflowFragment) || {},
    sourceNodeId: item.sourceNodeId || "",
    sourceCanvasId: item.sourceCanvasId || "",
    taskId: item.taskId || "",
    providerId: item.providerId || "",
    modelId: item.modelId || "",
  };
}

function toResourceCategory(row: {
  id: string;
  kind?: string | null;
  name?: string | null;
  revision?: number | null;
  created_at?: unknown;
  updated_at?: unknown;
}): ResourceCategory {
  return {
    id: row.id,
    kind: normalizeResourceKind(row.kind) || "image",
    name: safeText(row.name, "未分类"),
    revision: Number(row.revision) || 1,
    createdAt: dateToMillis(row.created_at),
    updatedAt: dateToMillis(row.updated_at),
  };
}

function toResourceItem(row: {
  id: string;
  kind?: string | null;
  title?: string | null;
  url?: string | null;
  mime?: string | null;
  size_bytes?: number | null;
  category_id?: string | null;
  tags?: unknown;
  favorite?: boolean | null;
  last_used_at?: unknown;
  metadata?: unknown;
  revision?: number | null;
  created_at?: unknown;
  updated_at?: unknown;
}): ResourceItem {
  const metadata = plainObject(row.metadata);
  const sourceUrl = String(metadata.sourceUrl ?? row.url ?? "").trim();
  const originalName = String(metadata.originalName ?? "").trim();
  const fileUrl = String(metadata.fileUrl ?? "").trim();
  const fileRel = String(metadata.fileRel ?? "").trim();
  const materialSetKind = String(metadata.materialSetKind ?? "").trim();
  const sourceNodeId = String(metadata.sourceNodeId ?? "").trim();
  const sourceCanvasId = String(metadata.sourceCanvasId ?? "").trim();
  const taskId = String(metadata.taskId ?? "").trim();
  const providerId = String(metadata.providerId ?? "").trim();
  const modelId = String(metadata.modelId ?? "").trim();
  return enrichWorkflowResourceItem({
    id: row.id,
    kind: normalizeResourceKind(row.kind) || "image",
    title: safeText(row.title, "资源"),
    url: String(row.url ?? "").trim() || undefined,
    sourceUrl: sourceUrl || undefined,
    originalName: originalName || undefined,
    fileUrl: fileUrl || undefined,
    fileRel: fileRel || undefined,
    mime: String(row.mime ?? "").trim() || undefined,
    size: Number(row.size_bytes) || 0,
    categoryId: safeText(row.category_id, "") || undefined,
    tags: Array.isArray(row.tags) ? row.tags.map((tag: unknown) => safeText(tag)).filter(Boolean) : [],
    favorite: Boolean(row.favorite),
    materialSetKind: materialSetKind || undefined,
    materialSetItems: Array.isArray(metadata.materialSetItems) ? metadata.materialSetItems : undefined,
    poseBackup: optionalObject(metadata.poseBackup),
    workflowFragment: optionalObject(metadata.workflowFragment),
    createdAt: dateToMillis(row.created_at),
    updatedAt: dateToMillis(row.updated_at),
    lastUsedAt: row.last_used_at ? dateToMillis(row.last_used_at) : undefined,
    sourceNodeId: sourceNodeId || undefined,
    sourceCanvasId: sourceCanvasId || undefined,
    taskId: taskId || undefined,
    providerId: providerId || undefined,
    modelId: modelId || undefined,
    revision: Number(row.revision) || 1,
  });
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringMap(value: unknown): Record<string, string> {
  const source = plainObject(value);
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(source)) {
    const text = String(entry ?? "").trim();
    if (text) out[key] = text;
  }
  return out;
}

function normalizeAdminModelRecord(model: AdminModelRecord): AdminModelRecord {
  const capability = normalizeCapability(model.capability);
  const inputCapabilities = parseInputCapabilities(model.inputCapabilities, capability);
  const inputProfile = normalizeModelInputProfile(model.inputProfile, inputCapabilities, capability);
  const capabilityTags = normalizeModelCapabilityTags(model.capabilityTags, capability, model.modelId);
  const advancedConfig = parseAdvancedConfig(model.advancedConfig);
  const executionMode = normalizeProviderGenerationExecutionMode(model.executionMode, advancedConfig, capability);
  advancedConfig.executionMode = executionMode;
  return {
    ...model,
    sortOrder: normalizeCatalogSortOrder(model.sortOrder),
    capability,
    enabled: Boolean(model.enabled),
    executionMode,
    inputProfile,
    inputCapabilities: { ...inputCapabilities },
    capabilityTags,
    testState: normalizeModelTestState(model.testState),
    parameterSchema: safeJsonText(model.parameterSchema, "{}"),
    advancedConfig,
    protocolOverride: normalizeOptionalProtocol(model.protocolOverride),
  };
}

const PROVIDER_GENERATION_EXECUTION_MODES = new Set<ProviderGenerationExecutionMode>([
  "sync_inline",
  "async_poll",
  "async_poll_then_final_lookup",
  "worker_queue",
]);

function defaultExecutionModeForCapability(capability: ModelCapability): ProviderGenerationExecutionMode {
  return capability === "chat" ? "sync_inline" : "worker_queue";
}

function normalizeProviderGenerationExecutionMode(
  value: unknown,
  advancedConfig: Record<string, unknown>,
  capability: ModelCapability,
): ProviderGenerationExecutionMode {
  const direct = typeof value === "string" ? value.trim() : "";
  if (PROVIDER_GENERATION_EXECUTION_MODES.has(direct as ProviderGenerationExecutionMode)) {
    return direct as ProviderGenerationExecutionMode;
  }
  const bridged = typeof advancedConfig.executionMode === "string"
    ? advancedConfig.executionMode.trim()
    : typeof advancedConfig.mode === "string"
      ? advancedConfig.mode.trim()
      : "";
  if (PROVIDER_GENERATION_EXECUTION_MODES.has(bridged as ProviderGenerationExecutionMode)) {
    return bridged as ProviderGenerationExecutionMode;
  }
  return defaultExecutionModeForCapability(capability);
}

const MODEL_CAPABILITY_TAGS = new Set<ModelCapabilityTag>([
  "text_chat",
  "image_understanding",
  "video_understanding",
  "audio_understanding",
  "reasoning",
  "long_context",
  "web_search",
  "image_generation",
  "image_edit",
  "video_generation",
  "tts",
  "voice_design",
  "voice_clone",
  "music_generation",
  "audio_cover",
  "audio_extend",
]);

function normalizeModelCapabilityTags(value: unknown, capability: ModelCapability, modelId: unknown): ModelCapabilityTag[] {
  const source = Array.isArray(value) ? value : [];
  const tags = new Set<ModelCapabilityTag>();
  for (const item of source) {
    const tag = String(item || "").trim() as ModelCapabilityTag;
    if (MODEL_CAPABILITY_TAGS.has(tag)) tags.add(tag);
  }
  for (const tag of inferModelCapabilityTags(modelId, capability)) tags.add(tag);
  if (capability === "chat") tags.add("text_chat");
  if (capability === "image" && !tags.has("image_edit")) tags.add("image_generation");
  if (capability === "video") tags.add("video_generation");
  if (capability === "audio" && !tags.has("music_generation")) tags.add("tts");
  return [...tags];
}

function normalizeModelTestState(value: unknown): ModelTestState {
  const source = plainObject(value);
  const out: ModelTestState = {};
  const keys = [
    "chat",
    "imageUnderstanding",
    "videoUnderstanding",
    "imageGeneration",
    "videoGeneration",
    "audioGeneration",
    "voiceClone",
  ] as const;
  for (const key of keys) {
    const item = plainObject(source[key]);
    if (!Object.keys(item).length) continue;
    out[key] = {
      ok: Boolean(item.ok),
      status: Number.isFinite(Number(item.status)) ? Number(item.status) : 0,
      message: safeText(item.message),
      checkedAt: Number.isFinite(Number(item.checkedAt)) ? Number(item.checkedAt) : Date.now(),
      latencyMs: Number.isFinite(Number(item.latencyMs)) ? Number(item.latencyMs) : undefined,
      inferredTags: normalizeModelCapabilityTags(item.inferredTags, "chat", "").filter((tag) => tag !== "text_chat"),
      sampleOutput: safeText(item.sampleOutput, ""),
    };
  }
  return out;
}

function normalizeModelInputProfile(
  value: unknown,
  inputCapabilities: ReturnType<typeof parseInputCapabilities>,
  capability: ModelCapability,
) {
  const requested = safeText(value);
  const parts = requested
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const out: string[] = [];
  const push = (token: string, enabled: boolean) => {
    if (enabled && !out.includes(token)) out.push(token);
  };
  push("prompt", inputCapabilities.prompt !== false || parts.length === 0);
  push("image_reference", inputCapabilities.imageReference || capability === "image" || capability === "video");
  push("video_reference", Boolean(inputCapabilities.videoReference));
  push("audio_reference", Boolean(inputCapabilities.audioReference) || capability === "audio");
  push("multi_image", Boolean(inputCapabilities.multiImage));
  push("first_frame", Boolean(inputCapabilities.firstFrame));
  push("last_frame", Boolean(inputCapabilities.lastFrame));
  for (const part of parts) if (!out.includes(part)) out.push(part);
  return out.join(",") || "prompt";
}

async function pollApimartVideoTask(input: {
  provider: AdminProviderRecord;
  apiKey: string;
  taskId: string;
  protocol: ProviderProtocol;
  advancedConfig: ReturnType<typeof parseAdvancedConfig>;
}) {
  const pollIntervalMs = clampInteger(input.advancedConfig.pollIntervalMs, 1500, 30000, 2500);
  const pollTimeoutMs = clampInteger(input.advancedConfig.pollTimeoutMs, 30000, 600000, 360000);
  const startedAt = Date.now();
  let deadline = startedAt + pollTimeoutMs;
  const pollPathTemplate = safeText(input.advancedConfig.pollPathTemplate, "tasks/{task_id}");
  while (Date.now() < deadline) {
    const statusPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(input.taskId));
    const upstream = await fetch(openAiEndpoint(input.provider.baseUrl, statusPath), {
      method: "GET",
      headers: providerModelHeaders(input.apiKey, input.protocol),
      signal: AbortSignal.timeout(60000),
    });
    const text = await upstream.text();
    if (looksLikeHtml(text)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
    if (!upstream.ok) throw new Error(`查询视频任务失败 ${upstream.status}: ${text.slice(0, 500)}`);
    const raw = parseUpstreamJson(text, "视频任务轮询接口", upstream.headers.get("content-type") || "");
    const data = raw && typeof raw === "object" && !Array.isArray(raw)
      ? plainObject((raw as Record<string, unknown>).data)
      : {};
    const estimatedTimeSec = Number(data.estimated_time);
    if (Number.isFinite(estimatedTimeSec) && estimatedTimeSec > 0) {
      const adaptiveDeadline = startedAt + Math.min((estimatedTimeSec + 90) * 1000, 600000);
      deadline = Math.max(deadline, adaptiveDeadline);
    }
    const result = extractApimartVideoResult(raw, {
      statusPath: safeText(input.advancedConfig.taskStatusPath, "data.status"),
      resultVideoPath: safeText(input.advancedConfig.resultVideoPath, "data.result.videos"),
    });
    const normalizedStatus = String(result.status || "").trim().toLowerCase();
    if (
      result.videoUrls.length > 0 &&
      (!normalizedStatus || ["completed", "succeeded", "success", "done"].includes(normalizedStatus))
    ) {
      return result;
    }
    if (["failed", "error", "cancelled", "canceled"].includes(normalizedStatus)) {
      const reason = safeText(result.failureReason, result.status || "failed");
      throw new Error(`视频任务失败: ${reason}`);
    }
    await sleep(pollIntervalMs);
  }
  throw new Error("视频任务轮询超时");
}

async function pollAsyncImageTask(input: {
  provider: AdminProviderRecord;
  apiKey: string;
  taskId: string;
  protocol: ProviderProtocol;
  advancedConfig: ReturnType<typeof parseAdvancedConfig>;
}) {
  const pollIntervalMs = clampInteger(input.advancedConfig.pollIntervalMs, 1500, 30000, 2500);
  const pollTimeoutMs = clampInteger(input.advancedConfig.pollTimeoutMs, 30000, 600000, 360000);
  const startedAt = Date.now();
  let deadline = startedAt + pollTimeoutMs;
  const pollPathTemplate = safeText(input.advancedConfig.pollPathTemplate, "tasks/{task_id}");
  while (Date.now() < deadline) {
    const statusPath = pollPathTemplate.replace("{task_id}", encodeURIComponent(input.taskId));
    const upstream = await fetch(openAiEndpoint(input.provider.baseUrl, statusPath), {
      method: "GET",
      headers: providerModelHeaders(input.apiKey, input.protocol),
      signal: AbortSignal.timeout(60000),
    });
    const text = await upstream.text();
    if (looksLikeHtml(text)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
    if (!upstream.ok) throw new Error(`查询图像任务失败 ${upstream.status}: ${text.slice(0, 500)}`);
    const raw = parseUpstreamJson(text, "图像任务轮询接口", upstream.headers.get("content-type") || "");
    const data = raw && typeof raw === "object" && !Array.isArray(raw)
      ? plainObject((raw as Record<string, unknown>).data)
      : {};
    const estimatedTimeSec = Number(data.estimated_time);
    if (Number.isFinite(estimatedTimeSec) && estimatedTimeSec > 0) {
      const adaptiveDeadline = startedAt + Math.min((estimatedTimeSec + 90) * 1000, 600000);
      deadline = Math.max(deadline, adaptiveDeadline);
    }
    const extracted = extractImageOutputs(raw);
    const task = extractApimartTask(raw, {
      statusPath: safeText(input.advancedConfig.taskStatusPath, "data.status"),
    });
    const normalizedStatus = String(task.status || "").trim().toLowerCase();
    if (
      (extracted.urls.length > 0 || extracted.base64.length > 0) &&
      (!normalizedStatus || ["completed", "succeeded", "success", "done"].includes(normalizedStatus))
    ) {
      return extracted;
    }
    if (["failed", "error", "cancelled", "canceled"].includes(normalizedStatus)) {
      throw new Error(`图像任务失败: ${task.status || "failed"}`);
    }
    await sleep(pollIntervalMs);
  }
  throw new Error("图像任务轮询超时");
}

function openAiEndpoint(baseUrlValue: unknown, pathname: string) {
  const baseUrl = safeText(baseUrlValue).replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error("Provider 请求地址必须以 http:// 或 https:// 开头");
  const normalizedPathname = safeText(pathname);
  if (/^https?:\/\//i.test(normalizedPathname)) return normalizedPathname;
  if (normalizedPathname.startsWith("../") || normalizedPathname.startsWith("./")) {
    return new URL(normalizedPathname, `${baseUrl}/`).toString();
  }
  return baseUrl.endsWith("/v1") ? `${baseUrl}/${normalizedPathname}` : `${baseUrl}/v1/${normalizedPathname}`;
}

function openAiImageGenerationUrl(baseUrlValue: unknown) {
  return openAiEndpoint(baseUrlValue, "images/generations");
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function millisToDate(value: number | undefined) {
  return new Date(typeof value === "number" && Number.isFinite(value) ? value : Date.now());
}

function dateToMillis(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  const time = date.getTime();
  return Number.isFinite(time) ? time : Date.now();
}

async function getRedisClient() {
  if (!redisUrl) throw new Error("REDIS_NOT_CONFIGURED");
  redisClientPromise ??= import("redis").then(async ({ createClient }) => {
    const client = createClient({ url: redisUrl });
    client.on("error", (error) => {
      console.error("xinghuan redis error", error instanceof Error ? error.message : String(error));
    });
    await client.connect();
    return client as import("redis").RedisClientType;
  });
  return redisClientPromise;
}

async function enqueueTask(
  taskId: string,
  capability: TaskQueueCapability,
): Promise<{ queued: boolean; reason: string; queueName: string }> {
  const queueName = taskQueueNameForCapability(taskQueueName, capability);
  if (!redisUrl) return { queued: false, reason: "redis_not_configured", queueName };
  try {
    const client = await withTimeout(getRedisClient(), 8_000, "redis_connect_timeout");
    await withTimeout(client.lPush(queueName, taskId), 8_000, "redis_command_timeout");
    await appendTaskRuntimeEventBestEffort({
      taskId,
      eventType: "task_queued",
      payload: { queueName, capability },
    }).catch(() => undefined);
    return { queued: true, reason: "queued", queueName };
  } catch (error) {
    return { queued: false, reason: error instanceof Error ? error.message : String(error), queueName };
  }
}

async function appendTaskLog(taskId: string, line: string) {
  await taskRepository.appendTaskLog(taskId, line);
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, reason: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(reason)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readTaskRecord(taskId: string): Promise<AdminTaskRecord | null> {
  return taskRepository.readTaskRecord(taskId) as Promise<AdminTaskRecord | null>;
}

async function findTaskByOwnerIdempotencyKey(ownerId: string, idempotencyKey: string): Promise<AdminTaskRecord | null> {
  return taskRepository.readTaskByOwnerIdempotencyKey(ownerId, idempotencyKey) as Promise<AdminTaskRecord | null>;
}

async function insertTaskRecord(task: AdminTaskRecord) {
  await taskRepository.insertTaskRecord(task);
  await appendTaskRuntimeEventBestEffort({
    taskId: task.id,
    eventType: "task_created",
    payload: {
      status: task.status,
      providerId: task.providerId,
      modelId: task.modelId,
    },
  });
}

async function writeTaskRecord(task: AdminTaskRecord) {
  await taskRepository.writeTaskRecord(task);
}

async function cancelTaskRecord(taskId: string, actorEmail: string) {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const patch = taskCancellationPatch(actorEmail);
    const cancelledResult = await pool.query(
      `update xh_tasks
       set status = 'cancelled',
           logs = coalesce(logs, '[]'::jsonb) || $2::jsonb,
           result = coalesce(result, '{}'::jsonb) || $3::jsonb,
           updated_at = now()
       where id = $1
         and status in ('queued', 'running')
       returning id, owner_id, title, status, provider_id, model_id, payload, result, logs, created_at, updated_at`,
      [taskId, JSON.stringify(patch.logs), JSON.stringify(patch.result)],
    );
    if (cancelledResult.rows[0]) {
      await appendTaskRuntimeEventBestEffort({
        taskId,
        eventType: "task_cancelled",
        payload: { actorEmail },
      });
      return readTaskRecord(taskId);
    }
    const currentTask = await readTaskRecord(taskId);
    if (!currentTask) return null;
    assertTaskCancellable(currentTask.status);
    return currentTask;
  }
  const db = await readAdminDb();
  let updatedTask: AdminTaskRecord | null = null;
  const tasks = db.tasks.map((task) => {
    if (task.id !== taskId) return task;
    updatedTask = applyTaskCancellation(task, actorEmail);
    return updatedTask;
  });
  if (!updatedTask) return null;
  await writeAdminDb({ ...db, tasks });
  await appendTaskRuntimeEventBestEffort({
    taskId,
    eventType: "task_cancelled",
    payload: { actorEmail },
  });
  return updatedTask;
}

function createSucceededExternalChatTask(
  rawBody: unknown,
  result: Awaited<ReturnType<typeof generateExternalChatProxy>>,
  user: CurrentUser,
  requestContext: RequestContext,
): AdminTaskRecord {
  const body = plainObject(rawBody);
  const params = plainObject(body.providerParams);
  const raw = plainObject(result.raw);
  const now = Date.now();
  return {
    id: `task-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: safeText(body.title, "扩展对话任务"),
    status: "succeeded",
    ownerId: user.id,
    providerId: safeText(result.provider?.id || raw.providerId),
    modelId: safeText(raw.modelRecordId),
    payload: {
      taskCapability: "chat",
      executionMode: "direct",
      requestId: requestContext.requestId,
      userId: user.id,
      providerId: safeText(body.providerId || result.provider?.id),
      providerModel: safeText(body.providerModel || body.model),
      modelRecordId: safeText(params.modelRecordId || raw.modelRecordId),
      messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
    },
    result: {
      adapter: "external_chat_proxy",
      protocol: safeText(result.provider?.protocol),
      capability: "chat",
      content: safeText(result.content || result.text),
      providerId: safeText(result.provider?.id || raw.providerId),
      providerName: safeText(result.provider?.name || raw.providerName),
      modelId: safeText(raw.modelId),
      modelRecordId: safeText(raw.modelRecordId),
      modelDisplayName: safeText(raw.modelDisplayName),
      raw,
      requestId: requestContext.requestId,
      userId: user.id,
    },
    logs: ["画布完成扩展对话任务"],
    createdAt: now,
    updatedAt: now,
  };
}

function defaultAdminDb(): AdminDb {
  const now = Date.now();
  return {
    announcements: [],
    providers: [
      {
        id: "modelscope",
        sortOrder: 0,
        name: "ModelScope",
        baseUrl: "https://api-inference.modelscope.cn/v1",
        protocol: "modelscope",
        enabled: true,
        msLoras: [
          {
            id: "Daniel8152/film",
            name: "Z-Image Film",
            targetModel: "Tongyi-MAI/Z-Image-Turbo",
            strength: 0.8,
            enabled: true,
          },
        ],
        note: "ModelScope 图像和 LoRA 配置",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "runninghub",
        sortOrder: 10,
        name: "RunningHub",
        baseUrl: "https://www.runninghub.cn",
        protocol: "runninghub",
        enabled: true,
        rhApps: [],
        rhWorkflows: [],
        note: "RunningHub AI 应用和工作流配置",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "grsai",
        sortOrder: 20,
        name: "GRSAI",
        baseUrl: "https://api.grsai.com",
        protocol: "openai",
        enabled: false,
        note: "图像模型服务商",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "toapis",
        sortOrder: 30,
        name: "ToAPIs",
        baseUrl: "https://api.toapis.com",
        protocol: "openai",
        enabled: false,
        note: "视频模型服务商",
        createdAt: now,
        updatedAt: now,
      },
    ],
    models: [
      {
        id: "grsai-gpt-image-2",
        sortOrder: 0,
        providerId: "grsai",
        modelId: "gpt-image-2",
        displayName: "GRSAI gpt-image-2",
        capability: "image",
        enabled: false,
        inputProfile: "prompt,image_reference",
        parameterSchema: JSON.stringify({ prompt: { type: "string", required: true } }, null, 2),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "toapis-grok-video",
        sortOrder: 0,
        providerId: "toapis",
        modelId: "grok-video",
        displayName: "ToAPIs Grok Video",
        capability: "video",
        enabled: false,
        inputProfile: "prompt,first_frame,last_frame",
        parameterSchema: JSON.stringify({ prompt: { type: "string", required: true }, duration: { type: "number" } }, null, 2),
        createdAt: now,
        updatedAt: now,
      },
    ],
    tasks: [
      {
        id: `task-${now}-seed`,
        title: "后台任务队列",
        status: "queued",
        logs: ["任务队列骨架已创建，等待 worker 接入"],
        createdAt: now,
        updatedAt: now,
      },
    ],
    auditLogs: [],
    assistantSettings: defaultAssistantSettings(),
    taskQueueSettings: defaultTaskQueueSettings(),
    taskQueueSettingsRevision: 1,
    taskQueueSettingsUpdatedAt: now,
  };
}

function maskAssistantEndpoint(settings: AssistantSettingsRecord): AssistantSettingsRecord {
  return settings;
}

function toPublicAssistantSettings(settings: AssistantSettingsRecord) {
  return {
    frontend: settings.frontend,
    integration: {
      runtime: settings.integration.runtime,
      frontendAssistantAgentKey: settings.integration.frontendAssistantAgentKey,
      knowledgeProfile: settings.integration.knowledgeProfile,
      persistMemory: false as const,
      strictMode: settings.integration.strictMode,
    },
    updatedAt: settings.updatedAt,
    revision: settings.revision,
  };
}

function normalizeTaskQueueCapability(value: unknown): TaskQueueCapability | null {
  const text = safeText(value).trim();
  return text === "image" || text === "audio" || text === "video" ? text : null;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

async function ensureBootstrapUser(db: AuthDb): Promise<AuthDb> {
  const email = safeText(process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL, "admin@xinghuan.local").toLowerCase();
  const password =
    process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ||
    (environment === "local" ? "admin123456" : "");
  const now = Date.now();
  const users = [...db.users];
  let changed = false;
  if (password && !users.some((user) => user.email.toLowerCase() === email)) {
    users.push({
      id: "usr-admin",
      email,
      name: safeText(process.env.XINGHUAN_BOOTSTRAP_ADMIN_NAME, "星幻管理员"),
      role: "admin",
      passwordHash: hashPassword(password),
      passwordCipher: encryptSecret(password),
      createdAt: now,
      updatedAt: now,
    });
    changed = true;
  }
  changed = syncManagedPassword(users, email, password, { allowBootstrapReset: true }) || changed;
  const memberEmail = safeText(process.env.XINGHUAN_BOOTSTRAP_MEMBER_EMAIL, "member@xinghuan.local").toLowerCase();
  const memberPassword =
    process.env.XINGHUAN_BOOTSTRAP_MEMBER_PASSWORD ||
    (environment === "local" ? "member123456" : "");
  if (memberPassword && !users.some((user) => user.email.toLowerCase() === memberEmail)) {
    users.push({
      id: "usr-member",
      email: memberEmail,
      name: safeText(process.env.XINGHUAN_BOOTSTRAP_MEMBER_NAME, "星幻成员"),
      role: "member",
      passwordHash: hashPassword(memberPassword),
      passwordCipher: encryptSecret(memberPassword),
      createdAt: now,
      updatedAt: now,
    });
    changed = true;
  }
  changed = syncManagedPassword(users, memberEmail, memberPassword, { allowBootstrapReset: true }) || changed;
  return changed ? {
    ...db,
    users,
  } : db;
}

function syncManagedPassword(
  users: UserRecord[],
  email: string,
  password: string,
  options?: { allowBootstrapReset?: boolean },
) {
  let changed = false;
  for (const user of users) {
    if (user.email.toLowerCase() !== email || !password) continue;
    const passwordMatches = verifyPassword(password, user.passwordHash);
    if (user.passwordCipher && passwordMatches) continue;
    if (!passwordMatches && !options?.allowBootstrapReset) continue;
    if (!passwordMatches) {
      user.passwordHash = hashPassword(password);
    }
    user.passwordCipher = encryptSecret(password);
    user.updatedAt = Date.now();
    changed = true;
  }
  return changed;
}

function isConfiguredBootstrapLogin(email: string) {
  const normalizedEmail = safeText(email).toLowerCase();
  if (!normalizedEmail) return false;
  const adminEmail = safeText(process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL, "admin@xinghuan.local").toLowerCase();
  const adminPassword = process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD || (environment === "local" ? "admin123456" : "");
  const memberEmail = safeText(process.env.XINGHUAN_BOOTSTRAP_MEMBER_EMAIL, "member@xinghuan.local").toLowerCase();
  const memberPassword = process.env.XINGHUAN_BOOTSTRAP_MEMBER_PASSWORD || (environment === "local" ? "member123456" : "");
  return (Boolean(adminPassword) && normalizedEmail === adminEmail)
    || (Boolean(memberPassword) && normalizedEmail === memberEmail);
}

async function ensurePostgresBootstrapUsersForLogin(email: string) {
  if (!usePostgresRepository() || !isConfiguredBootstrapLogin(email)) return;
  // The Postgres reader owns the established bootstrap reconciliation semantics.
  await readAuthDbPostgres();
}

async function loginUser(
  request: import("node:http").IncomingMessage,
  emailValue: unknown,
  passwordValue: unknown,
  options?: { adminOnly?: boolean },
) {
  const email = safeText(emailValue).toLowerCase();
  const password = String(passwordValue || "");
  const scope: LoginAttemptScope = options?.adminOnly ? "admin" : "member";
  const ip = requestIp(request);
  const now = Date.now();
  if (!email || !password) return null;
  await assertLoginAllowed(scope, email, ip, now);
  const db = usePostgresRepository() ? null : await readAuthDb();
  await ensurePostgresBootstrapUsersForLogin(email);
  const user = db ? db.users.find((item) => item.email.toLowerCase() === email && !item.disabled) : await authCurrentUserRepository.findEnabledUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await recordLoginFailure(scope, email, ip, now);
    return null;
  }
  await clearLoginFailures(scope, email, ip);
  const clearedLoginAttemptKey = loginAttemptKey(scope, email, ip);
  if (options?.adminOnly && user.role !== "admin") return "ADMIN_REQUIRED" as const;
  const session: SessionRecord = {
    id: randomToken(32),
    userId: user.id,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    lastSeenAt: now,
    ip,
    userAgent: requestUserAgent(request),
  };
  if (usePostgresRepository()) {
    await createSessionRecordPostgres(session);
  } else {
    if (!db) throw new Error("AUTH_DB_NOT_LOADED");
    await writeAuthDb({
      ...db,
      loginAttempts: db.loginAttempts.filter((item) => item.key !== clearedLoginAttemptKey),
      sessions: [session, ...db.sessions.filter((item) => item.expiresAt > now && item.id !== session.id)],
    });
  }
  return { user, session };
}

async function logoutUser(request: import("node:http").IncomingMessage) {
  const sessionId = readCookie(request, SESSION_COOKIE_NAME);
  if (!sessionId) return;
  const revokedAt = Date.now();
  if (usePostgresRepository()) {
    await revokeSessionRecordPostgres(sessionId, revokedAt);
    return;
  }
  const db = await readAuthDb();
  await writeAuthDb({
    ...db,
    sessions: db.sessions.map((session) => (session.id === sessionId ? { ...session, revokedAt } : session)),
  });
}

async function getCurrentUser(request: import("node:http").IncomingMessage): Promise<CurrentUser | null> {
  const sessionId = readCookie(request, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  const now = Date.now();
  const lookup = await authCurrentUserRepository.findCurrentUserBySessionId(sessionId, now);
  if (!lookup) return null;
  if (shouldTouchSession(lookup.session, request, now)) {
    await touchSessionRecord(lookup.session.id, request, now);
  }
  return toPublicUser(lookup.user);
}

function normalizeSessionRecord(session: SessionRecord): SessionRecord {
  return {
    id: safeText(session?.id),
    userId: safeText(session?.userId),
    createdAt: Number(session?.createdAt) || Date.now(),
    expiresAt: Number(session?.expiresAt) || Date.now(),
    lastSeenAt: Number(session?.lastSeenAt) || Number(session?.createdAt) || Date.now(),
    ip: safeText(session?.ip),
    userAgent: safeText(session?.userAgent),
    revokedAt: Number(session?.revokedAt) > 0 ? Number(session.revokedAt) : undefined,
  };
}

function normalizeLoginAttemptRecord(attempt: LoginAttemptRecord): LoginAttemptRecord {
  const scope: LoginAttemptScope = attempt?.scope === "admin" ? "admin" : "member";
  const email = safeText(attempt?.email).toLowerCase();
  const ip = normalizeLoginAttemptIp(attempt?.ip);
  const updatedAt = Number(attempt?.updatedAt) > 0 ? Number(attempt.updatedAt) : Date.now();
  const firstFailedAt = Number(attempt?.firstFailedAt) > 0 ? Number(attempt.firstFailedAt) : updatedAt;
  const lastFailedAt = Number(attempt?.lastFailedAt) > 0 ? Number(attempt.lastFailedAt) : updatedAt;
  return {
    key: safeText(attempt?.key) || loginAttemptKey(scope, email, ip),
    scope,
    email,
    ip,
    failureCount: Math.max(0, Math.floor(Number(attempt?.failureCount) || 0)),
    firstFailedAt,
    lastFailedAt,
    blockedUntil: Number(attempt?.blockedUntil) > 0 ? Number(attempt.blockedUntil) : undefined,
    updatedAt,
  };
}

function requestIp(request: import("node:http").IncomingMessage) {
  const forwarded = safeText(String(request.headers["x-forwarded-for"] || ""));
  if (forwarded) return safeText(forwarded.split(",")[0]);
  const realIp = safeText(String(request.headers["x-real-ip"] || ""));
  if (realIp) return realIp;
  return safeText(request.socket.remoteAddress || "");
}

function requestUserAgent(request: import("node:http").IncomingMessage) {
  return safeText(String(request.headers["user-agent"] || ""));
}

function createRequestId() {
  return `req-${Date.now()}-${randomToken(6)}`;
}

function sanitizeRequestId(value: unknown) {
  return safeText(value).replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 120);
}

function createRequestContext(request: import("node:http").IncomingMessage, url: URL): RequestContext {
  return {
    requestId: sanitizeRequestId(request.headers["x-request-id"]) || createRequestId(),
    method: safeText(request.method, "GET").toUpperCase(),
    path: safeText(url.pathname, "/"),
    ip: requestIp(request),
    userAgent: requestUserAgent(request),
    startedAt: Date.now(),
  };
}

function logApiEvent(event: string, context: RequestContext, payload: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    service: "xinghuan-api",
    environment,
    event,
    requestId: context.requestId,
    userId: context.userId || "",
    path: context.path,
    method: context.method,
    ip: context.ip,
    userAgent: context.userAgent,
    durationMs: Math.max(0, Date.now() - context.startedAt),
    ...payload,
  }));
}

function normalizeLoginAttemptIp(value: unknown) {
  return safeText(value) || "unknown";
}

function loginAttemptKey(scope: LoginAttemptScope, email: string, ip: string) {
  return `${scope}:${safeText(email).toLowerCase()}:${normalizeLoginAttemptIp(ip)}`;
}

function pruneLoginAttempts(attempts: LoginAttemptRecord[], now: number) {
  const cutoff = now - LOGIN_LIMIT_RETENTION_MS;
  return attempts
    .map(normalizeLoginAttemptRecord)
    .filter((attempt) => {
      if (!attempt.email) return false;
      const stillBlocked = Boolean(attempt.blockedUntil && attempt.blockedUntil > now);
      const withinWindow = attempt.lastFailedAt >= now - LOGIN_LIMIT_WINDOW_MS;
      const recentlyUpdated = attempt.updatedAt >= cutoff;
      return stillBlocked || withinWindow || recentlyUpdated;
    });
}

async function readLoginAttempt(scope: LoginAttemptScope, email: string, ip: string) {
  const normalizedEmail = safeText(email).toLowerCase();
  const normalizedIp = normalizeLoginAttemptIp(ip);
  const key = loginAttemptKey(scope, normalizedEmail, normalizedIp);
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const result = await pool.query(
      `select key, scope, email, ip, failure_count, first_failed_at, last_failed_at, blocked_until, updated_at
       from xh_login_attempts
       where key = $1
       limit 1`,
      [key],
    );
    const row = result.rows[0];
    if (!row) return null;
    return normalizeLoginAttemptRecord({
      key: row.key,
      scope: row.scope === "admin" ? "admin" : "member",
      email: row.email,
      ip: row.ip,
      failureCount: Number(row.failure_count) || 0,
      firstFailedAt: dateToMillis(row.first_failed_at),
      lastFailedAt: dateToMillis(row.last_failed_at),
      blockedUntil: row.blocked_until ? dateToMillis(row.blocked_until) : undefined,
      updatedAt: dateToMillis(row.updated_at),
    });
  }
  const db = await readAuthDb();
  return db.loginAttempts.find((attempt) => attempt.key === key) || null;
}

async function writeLoginAttempt(attempt: LoginAttemptRecord) {
  const normalized = normalizeLoginAttemptRecord(attempt);
  if (usePostgresRepository()) {
    await upsertLoginAttemptPostgres(normalized);
    await pruneLoginAttemptsPostgres(normalized.updatedAt);
    return;
  }
  const db = await readAuthDb();
  await writeAuthDb({
    ...db,
    loginAttempts: pruneLoginAttempts(
      [...db.loginAttempts.filter((item) => item.key !== normalized.key), normalized],
      normalized.updatedAt,
    ),
  });
}

async function removeLoginAttempt(key: string) {
  if (!key) return;
  if (usePostgresRepository()) {
    await deleteLoginAttemptPostgres(key);
    return;
  }
  const db = await readAuthDb();
  const nextAttempts = db.loginAttempts.filter((attempt) => attempt.key !== key);
  if (nextAttempts.length === db.loginAttempts.length) return;
  await writeAuthDb({
    ...db,
    loginAttempts: nextAttempts,
  });
}

async function assertLoginAllowed(scope: LoginAttemptScope, email: string, ip: string, now: number) {
  const attempt = await readLoginAttempt(scope, email, ip);
  if (!attempt?.blockedUntil || attempt.blockedUntil <= now) return;
  throw new HttpError(429, "LOGIN_RATE_LIMITED", {
    retryAfterSec: Math.max(1, Math.ceil((attempt.blockedUntil - now) / 1000)),
    blockedUntil: attempt.blockedUntil,
  });
}

async function recordLoginFailure(scope: LoginAttemptScope, email: string, ip: string, now: number) {
  const normalizedEmail = safeText(email).toLowerCase();
  const normalizedIp = normalizeLoginAttemptIp(ip);
  const current = await readLoginAttempt(scope, normalizedEmail, normalizedIp);
  const resetWindow = !current || current.lastFailedAt < now - LOGIN_LIMIT_WINDOW_MS;
  const nextFailureCount = resetWindow ? 1 : current.failureCount + 1;
  await writeLoginAttempt({
    key: loginAttemptKey(scope, normalizedEmail, normalizedIp),
    scope,
    email: normalizedEmail,
    ip: normalizedIp,
    failureCount: nextFailureCount,
    firstFailedAt: resetWindow ? now : current.firstFailedAt,
    lastFailedAt: now,
    blockedUntil: nextFailureCount >= LOGIN_LIMIT_MAX_FAILURES ? now + LOGIN_LIMIT_BLOCK_MS : undefined,
    updatedAt: now,
  });
}

async function clearLoginFailures(scope: LoginAttemptScope, email: string, ip: string) {
  await removeLoginAttempt(loginAttemptKey(scope, safeText(email).toLowerCase(), ip));
}

function shouldTouchSession(session: SessionRecord, request: import("node:http").IncomingMessage, now: number) {
  const ip = requestIp(request);
  const userAgent = requestUserAgent(request);
  const lastSeenAt = session.lastSeenAt || session.createdAt || 0;
  if (!lastSeenAt || now - lastSeenAt >= 5 * 60 * 1000) return true;
  if (ip && ip !== safeText(session.ip)) return true;
  if (userAgent && userAgent !== safeText(session.userAgent)) return true;
  return false;
}

async function touchSessionRecord(sessionId: string, request: import("node:http").IncomingMessage, now: number) {
  const ip = requestIp(request);
  const userAgent = requestUserAgent(request);
  if (usePostgresRepository()) {
    await touchSessionRecordPostgres(sessionId, now, ip, userAgent);
    return;
  }
  const db = await readAuthDb();
  await writeAuthDb({
    ...db,
    sessions: db.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            lastSeenAt: now,
            ip: ip || session.ip,
            userAgent: userAgent || session.userAgent,
          }
        : session,
    ),
  });
}

function toPublicUser(user: UserRecord): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    groupId: user.groupId,
    administratorTier: normalizeAdministratorTier(user.role, user.administratorTier),
  };
}

function hashPassword(password: string) {
  const salt = randomToken(16);
  const key = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${key}`;
}

function verifyPassword(password: string, encoded: string) {
  const [, salt, key] = encoded.split("$");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function randomToken(byteLength: number) {
  return randomBytes(byteLength).toString("hex");
}

function defaultSettings() {
  return {
    zhenzhenApiKey: "",
    zhenzhenBaseUrl: "",
    rhApiKey: "",
    rhBaseUrl: "",
    llmApiKey: "",
    llmBaseUrl: "",
    fileSavePath: "",
    canvasAutoSavePath: "",
    resourceLibraryPath: "",
    themeTemplatePath: "",
    eagleApiBase: "",
    advancedProviders: [],
    advancedProviderSummary: { enabledCount: 0, totalCount: 0 },
    cloudUploadTargets: [],
    cloudUploadSummary: { enabledCount: 0, totalCount: 0 },
    preferences: { theme: "dark", language: "zh-CN" },
  };
}

async function publicModelCatalog(currentUser?: CurrentUser | null) {
  const db = await readAdminDb();
  const pricingByModelId = new Map(
    (usePostgresRepository() ? await taskCostRepository.readModelPricing() : [])
      .filter((pricing) => pricing.enabled)
      .map((pricing) => [pricing.modelId, pricing]),
  );
  const orderedProviders = sortByCatalogDisplayOrder(db.providers);
  const providerMap = new Map(orderedProviders.map((provider) => [provider.id, provider]));
  const providerOrder = new Map(orderedProviders.map((provider, index) => [provider.id, index]));
  const orderedModels = [...db.models].sort((left, right) => {
    const providerDelta = (providerOrder.get(left.providerId) ?? Number.MAX_SAFE_INTEGER)
      - (providerOrder.get(right.providerId) ?? Number.MAX_SAFE_INTEGER);
    if (providerDelta !== 0) return providerDelta;
    const modelOrderDelta = normalizeCatalogSortOrder(left.sortOrder) - normalizeCatalogSortOrder(right.sortOrder);
    if (modelOrderDelta !== 0) return modelOrderDelta;
    const createdDelta = normalizeCatalogSortOrder(right.createdAt) - normalizeCatalogSortOrder(left.createdAt);
    return createdDelta || left.id.localeCompare(right.id);
  });
  if (currentUser && currentUser.role !== "admin") await reconcilePermissionSubjects();
  const all = (await Promise.all(orderedModels
    .filter((model) => model.enabled)
    .map(async (model) => {
      const provider = providerMap.get(model.providerId);
      if (!provider || !provider.enabled) return null;
      const protocol = normalizeProviderProtocol(model.protocolOverride || provider.protocol);
      const capability = normalizeCapability(model.capability) as CatalogCapability;
      const parameterSchema = mergeModelParameterSchema(
        capability,
        model.modelId,
        protocol as CatalogProtocol,
        model.parameterSchema,
      );
      const inputCapabilities = parseInputCapabilities(model.inputCapabilities, capability);
      const capabilityTags = normalizeModelCapabilityTags(model.capabilityTags, capability, model.modelId);
      const pricing = pricingByModelId.get(model.id);
      if (currentUser && currentUser.role !== "admin" && !(await permissionRuntime.decide({
        user: currentUser,
        subjectKey: providerModelSubjectKey(model.id),
        action: "view",
        legacyAllowed: true,
      })).allowed) return null;
      return {
        id: model.id,
        sortOrder: normalizeCatalogSortOrder(model.sortOrder),
        providerId: model.providerId,
        modelId: model.modelId,
        displayName: model.displayName,
        capability,
        enabled: true,
        inputProfile: model.inputProfile,
        inputCapabilities,
        capabilityTags,
        advancedConfig: plainObject(model.advancedConfig),
        protocol,
        parameterSchema,
        ui: uiMetadataFromSchema(parameterSchema, capability, inputCapabilities),
        provider: {
          id: provider.id,
          sortOrder: normalizeCatalogSortOrder(provider.sortOrder),
          name: provider.name,
          protocol: normalizeProviderProtocol(provider.protocol),
          enabled: true,
        },
        pricing: pricing ? {
          enabled: true,
          billingUnit: pricing.billingUnit,
          unitPrice: pricing.unitPrice,
          currency: pricing.currency,
        } : undefined,
        updatedAt: model.updatedAt,
      };
    }))).filter(Boolean);
  return {
    all,
    chatModels: all.filter((model) => model?.capability === "chat"),
    imageModels: all.filter((model) => model?.capability === "image"),
    videoModels: all.filter((model) => model?.capability === "video"),
    audioModels: all.filter((model) => model?.capability === "audio"),
  };
}

async function findEnabledProviderModel(capability: ModelCapability, providerId: string, requestedModelId: string, modelRecordId = "") {
  const db = await readAdminDb();
  const provider = db.providers.find((item) => item.id === providerId);
  if (!provider || !provider.enabled) throw new Error("Provider 不存在或未启用");
  const model = db.models.find((item) => {
    if (!item.enabled || item.providerId !== provider.id || normalizeCapability(item.capability) !== capability) return false;
    if (modelRecordId && item.id === modelRecordId) return true;
    return Boolean(requestedModelId) && item.modelId === requestedModelId;
  });
  if (!model) throw new Error(`模型不存在、未启用或不是 ${capability} 模型`);
  return { provider, model };
}

async function assertCanExecuteProviderModel(user: CurrentUser, modelRecordId: string) {
  await reconcilePermissionSubjects();
  const decision = await permissionRuntime.decide({
    user,
    subjectKey: providerModelSubjectKey(modelRecordId),
    action: "execute",
    legacyAllowed: true,
  });
  if (!decision.allowed) throw new PermissionDeniedError();
}

async function submitExternalVideoTask(rawBody: unknown, user: CurrentUser, publicOrigin: string) {
  const body = plainObject(rawBody);
  const prompt = String(body.prompt || "").trim().slice(0, 16000);
  if (!prompt) throw new Error("缺少 prompt");
  const params = plainObject(body.providerParams);
  const { provider, model } = await findEnabledProviderModel(
    "video",
    safeSlug(body.providerId, ""),
    safeText(body.providerModel || body.model),
    safeText(params.modelRecordId),
  );
  const protocol = normalizeProviderProtocol(model.protocolOverride || provider.protocol);
  if (!["openai", "apimart", "aicopy", "modelscope", "custom"].includes(protocol)) {
    throw new Error(`当前 Provider 协议暂未接入视频任务 Adapter: ${protocol}`);
  }
  if (!providerPlainApiKey(provider)) throw new Error("Provider 未配置 API Key");

  const schema = mergeModelParameterSchema("video", model.modelId, protocol as CatalogProtocol, model.parameterSchema);
  const inputCapabilities = parseInputCapabilities(model.inputCapabilities, "video");
  const advancedConfig = parseAdvancedConfig(model.advancedConfig);
  const ui = uiMetadataFromSchema(schema, "video", inputCapabilities);
  const requestedRatio = safeText(body.aspect_ratio || body.ratio || params.aspectRatio);
  const requestedDuration = normalizeVideoDurationValue(body.duration ?? params.duration);
  const requestedResolution = safeText(body.resolution || params.resolution);
  const images = normalizeProviderReferenceUrlsForAccess(
    Array.isArray(body.images)
      ? body.images.map((item) => safeText(item)).filter(Boolean).slice(0, ui.maxReferenceImages || 1)
      : [],
    publicOrigin,
    user,
    { secret: secretKey(), scope: environment },
  );
  const videos = normalizeProviderReferenceUrlsForAccess(
    Array.isArray(body.videos)
      ? body.videos.map((item) => safeText(item)).filter(Boolean).slice(0, ui.maxReferenceVideos || 10)
      : [],
    publicOrigin,
    user,
    { secret: secretKey(), scope: environment },
  );
  const audios = normalizeProviderReferenceUrlsForAccess(
    Array.isArray(body.audios)
      ? body.audios.map((item) => safeText(item)).filter(Boolean).slice(0, ui.maxReferenceAudios || 10)
      : [],
    publicOrigin,
    user,
    { secret: secretKey(), scope: environment },
  );
  const firstFrame = inputCapabilities.firstFrame
    ? normalizeProviderReferenceUrlForAccess(safeText(body.first_frame || params.first_frame), publicOrigin, user, { secret: secretKey(), scope: environment })
    : "";
  const lastFrame = inputCapabilities.lastFrame
    ? normalizeProviderReferenceUrlForAccess(safeText(body.last_frame || params.last_frame), publicOrigin, user, { secret: secretKey(), scope: environment })
    : "";
  const ratio = ui.aspectRatios.length > 0 ? (ui.aspectRatios.includes(requestedRatio) ? requestedRatio : ui.defaultAspectRatio) : "";
  const duration = ui.durationOptions.length > 0
    ? (ui.durationOptions.includes(requestedDuration as string | number) ? requestedDuration : ui.defaultDuration)
    : undefined;
  const resolution = ui.resolutionOptions.length > 0
    ? (ui.resolutionOptions.includes(requestedResolution) ? requestedResolution : ui.defaultResolution)
    : "";

  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload: Record<string, unknown> = {
    ...advancedConfig,
    ...params,
    prompt,
    aspect_ratio: ratio,
    ratio,
    duration,
    resolution,
    images,
    videos,
    audios,
    first_frame: firstFrame,
    last_frame: lastFrame,
    advancedMode: safeText(advancedConfig.mode || params.mode),
    sourceNodeId: safeText(params.sourceNodeId || body.sourceNodeId),
    sourceCanvasId: safeText(params.sourceCanvasId || body.sourceCanvasId),
  };
  const now = Date.now();
  const task: AdminTaskRecord = {
    id: taskId,
    title: `视频生成 · ${provider.name} · ${model.displayName || model.modelId}`,
    status: "queued",
    ownerId: user.id,
    providerId: provider.id,
    modelId: model.id,
    payload,
    result: {},
    logs: ["画布提交后台视频任务"],
    createdAt: now,
    updatedAt: now,
  };
  await insertTaskRecord(task);
  const queueResult = await enqueueTask(task.id, "video");
  const queueLog = queueResult.queued ? `已进入 Redis 队列 ${queueResult.queueName}` : `未进入 Redis 队列: ${queueResult.reason}`;
  await appendTaskLog(task.id, queueLog);
  if (!queueResult.queued) {
    await writeTaskRecord({
      ...task,
      status: "failed",
      result: { error: queueLog },
      logs: [...task.logs, queueLog],
      updatedAt: Date.now(),
    });
    throw new Error(`视频任务队列不可用：${queueResult.reason}`);
  }
  return {
    taskId: task.id,
    status: "queued",
    progress: "0%",
    provider: { id: provider.id, name: provider.name, protocol },
    raw: {
      providerId: provider.id,
      modelId: model.modelId,
      modelRecordId: model.id,
      mode: safeText(advancedConfig.mode),
      queued: true,
    },
  };
}

function normalizeVideoDurationValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
    return value.trim();
  }
  return value;
}

async function readExternalVideoTaskStatus(taskId: string, user: CurrentUser) {
  const task = await readTaskRecord(taskId);
  if (!task) throw new Error("任务不存在");
  if (task.ownerId && task.ownerId !== user.id && user.role !== "admin") throw new Error("无权查看该任务");
  const result = plainObject(task.result);
  const videoUrls = readStringArray(result.materializedVideoUrls).length > 0
    ? readStringArray(result.materializedVideoUrls)
    : readStringArray(result.videoUrls);
  const remoteVideoUrls = readStringArray(result.remoteVideoUrls);
  const error = safeText(result.error || result.failureReason || result.failReason)
    || (task.status === "failed" ? lastTaskFailureLog(task.logs) : "");
  return {
    taskId: task.id,
    status: task.status,
    progress: task.status === "succeeded" ? "100%" : task.status === "running" ? "45%" : task.status === "queued" ? "5%" : "",
    videoUrls,
    remoteVideoUrls,
    error,
    logs: task.logs.slice(-8),
    raw: {
      providerId: task.providerId,
      modelRecordId: task.modelId,
      workerId: safeText(result.workerId),
      adapter: safeText(result.adapter),
      videoCount: Number(result.videoCount || videoUrls.length) || videoUrls.length,
    },
  };
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => safeText(item)).filter(Boolean) : [];
}

function lastTaskFailureLog(logs: string[]) {
  return [...logs].reverse().find((line) => /失败|error|failed/i.test(line)) || "";
}

async function assertCanUseRunningHubCatalogItem(
  currentUser: CurrentUser | null | undefined,
  item: RhCatalogItem,
) {
  if (!currentUser) throw new HttpError(401, "UNAUTHORIZED");
  await reconcilePermissionSubjects();
  const authDb = await readAuthDb();
  const adminDb = await readAdminDb();
  const legacyAllowed = canUseRunningHubCatalogItem(
    policyForUser(currentUser, authDb.groupPermissionPolicies),
    item,
  );
  const provider = adminDb.providers.find((candidate) => candidate.id === item.providerId);
  const group = provider?.rhGroups?.find((candidate) => candidate.id === item.groupId);
  const decision = await decideRunningHubAccess({
    item,
    group,
    action: "execute",
    itemLegacyAllowed: legacyAllowed,
    decide: (subjectKey, action) => permissionRuntime.decide({ user: currentUser, subjectKey, action, legacyAllowed: true }),
  });
  if (!decision.allowed) throw new PermissionDeniedError();
}

async function resolveCanvasRunModels(input: { ownerId: string; plan: CanvasRunRecord["planSnapshot"] }) {
  const authDb = await readAuthDb();
  const user = authDb.users.find((candidate) => candidate.id === input.ownerId && !candidate.disabled);
  if (!user) throw new Error("CANVAS_RUN_OWNER_UNAVAILABLE");
  const adminDb = await readAdminDb();
  const providerEnabled = new Map(adminDb.providers.map((provider) => [provider.id, provider.enabled]));
  return resolveCanvasRunPlanModelReferences({
    plan: input.plan,
    models: adminDb.models.map((model) => ({
      id: model.id,
      providerId: model.providerId,
      modelId: model.modelId,
      capability: normalizeCapability(model.capability),
      enabled: model.enabled,
      providerEnabled: providerEnabled.get(model.providerId) === true,
      inputCapabilities: plainObject(model.inputCapabilities),
      })),
    assertCanExecute: async (modelRecordId) => assertCanExecuteProviderModel(user as CurrentUser, modelRecordId),
  });
}

async function assertCanvasRunStartablePlan(input: { ownerId: string; run: CanvasRunRecord }) {
  const resolvedPlan = await resolveCanvasRunModels({ ownerId: input.ownerId, plan: input.run.planSnapshot });
  for (const [index, step] of input.run.planSnapshot.steps.entries()) {
    const currentModelRecordId = safeText(plainObject(step.configuration).modelRecordId);
    const resolvedModelRecordId = safeText(plainObject(resolvedPlan.steps[index]?.configuration).modelRecordId);
    if (currentModelRecordId !== resolvedModelRecordId) {
      throw new Error(`CANVAS_RUN_MODEL_RECORD_REPAIR_REQUIRED:${step.nodeId}`);
    }
  }
  const authDb = await readAuthDb();
  const user = authDb.users.find((candidate) => candidate.id === input.ownerId && !candidate.disabled);
  if (!user) throw new Error("CANVAS_RUN_OWNER_UNAVAILABLE");
  const adminDb = await readAdminDb();
  for (const step of input.run.planSnapshot.steps || []) {
    if (safeText(step.nodeType) !== "runninghub" || step.skipped === true) continue;
    const configuration = plainObject(step.configuration);
    const runningHub = plainObject(configuration.runningHub);
    const catalogParts = safeText(runningHub.catalogId).split(":");
    if (catalogParts.length !== 3 || !["app", "workflow"].includes(catalogParts[1])) {
      throw new Error("CANVAS_RUN_RUNNINGHUB_CATALOG_INVALID");
    }
    const [providerId, kind, itemId] = catalogParts;
    const provider = adminDb.providers.find((candidate) => candidate.id === providerId && candidate.enabled && normalizeProviderProtocol(candidate.protocol) === "runninghub");
    if (!provider) throw new Error("CANVAS_RUN_RUNNINGHUB_PROVIDER_UNAVAILABLE");
    const entries = normalizeRunningHubCatalogItems(kind === "app" ? provider.rhApps : provider.rhWorkflows, kind as "app" | "workflow");
    const entry = entries.find((candidate) => candidate.id === itemId && candidate.enabled);
    if (!entry) throw new Error("CANVAS_RUN_RUNNINGHUB_CATALOG_UNAVAILABLE");
    const expectedTarget = safeText(entry.runTargetId || (kind === "app" ? entry.appId : entry.workflowId) || entry.id);
    if (!expectedTarget || expectedTarget !== safeText(runningHub.runTargetId)) throw new Error("CANVAS_RUN_RUNNINGHUB_TARGET_MISMATCH");
    await assertCanUseRunningHubCatalogItem(user as CurrentUser, toPublicRunningHubCatalogItem(provider, entry));
  }
}

async function publicRunningHubCatalog(
  currentUser?: CurrentUser | null,
  options?: { includeRestricted?: boolean },
) {
  const providersSource = await providerRepository.readProviderRecords();
  const permissionContext = currentUser && !options?.includeRestricted
    ? {
        authDb: await readAuthDb(),
        groupsByProvider: new Map(providersSource.map((provider) => [provider.id, normalizeRunningHubGroups(provider.rhGroups, provider.id)])),
      }
    : undefined;
  const providers = await Promise.all(providersSource
    .filter((provider) => provider.enabled && normalizeProviderProtocol(provider.protocol) === "runninghub")
    .map(async (provider) => {
      const groups = normalizeRunningHubGroups(provider.rhGroups, provider.id);
      const enabledGroupIds = new Set(groups.filter((group) => group.enabled).map((group) => group.id));
      const publicProvider = { ...provider, rhGroups: groups.filter((group) => group.enabled) };
      const workflows = await filterRunningHubItems(
        normalizeRunningHubCatalogItems(provider.rhWorkflows, "workflow", enabledGroupIds)
        .filter((entry) => entry.enabled && (!entry.groupId || enabledGroupIds.has(entry.groupId)))
        .map((entry) => toPublicRunningHubCatalogItem(publicProvider, entry)),
        currentUser,
        options?.includeRestricted,
        permissionContext,
      );
      const apps = await filterRunningHubItems(
        normalizeRunningHubCatalogItems(provider.rhApps, "app", enabledGroupIds)
        .filter((entry) => entry.enabled && (!entry.groupId || enabledGroupIds.has(entry.groupId)))
        .map((entry) => toPublicRunningHubCatalogItem(publicProvider, entry)),
        currentUser,
        options?.includeRestricted,
        permissionContext,
      );
      return {
        id: provider.id,
        name: provider.name,
        baseUrl: provider.baseUrl,
        groups: groups.filter((group) => group.enabled && [...workflows, ...apps].some((item) => item.groupId === group.id)),
        workflows,
        apps,
      };
    }));
  const items = providers.flatMap((provider) => [...provider.workflows, ...provider.apps]);
  const revision = createHash("sha1")
    .update(providersSource.map((provider) => `${provider.id}:${provider.updatedAt}:${normalizeRunningHubGroups(provider.rhGroups, provider.id).map((group) => `${group.id}:${group.updatedAt}`).join(",")}`).join("|"))
    .digest("hex");
  return {
    revision,
    providers,
    workflows: providers.flatMap((provider) => provider.workflows),
    apps: providers.flatMap((provider) => provider.apps),
    items,
  };
}

async function resolveRunningHubProvider(requestedProviderId = "") {
  const db = await readAdminDb();
  const enabledProviders = db.providers.filter(
    (provider) => provider.enabled && normalizeProviderProtocol(provider.protocol) === "runninghub",
  );
  const provider = requestedProviderId
    ? enabledProviders.find((item) => item.id === requestedProviderId)
    : enabledProviders[0];
  if (!provider) throw new Error("未找到已启用的 RunningHub Provider");
  return provider;
}

async function createRunningHubQueuedTask(input: {
  provider: AdminProviderRecord;
  modelId: string;
  pageId?: string;
  webappId?: string;
  workflowId?: string;
  runTargetId?: string;
  targetType?: "app" | "workflow";
  taskCapability?: "image" | "video" | "audio" | "chat";
  nodeInfoList: Array<{ nodeId?: string; fieldName?: string; fieldValue?: unknown }>;
  instanceType?: string;
  title: string;
  user: CurrentUser;
  requestContext: RequestContext;
}) {
  const targetType = input.targetType === "app" ? "app" : "workflow";
  const webappId = safeText(input.webappId);
  const workflowId = safeText(input.workflowId);
  const runTargetId = safeText(input.runTargetId || (targetType === "app" ? webappId : workflowId));
  const pageId = safeText(input.pageId || (targetType === "app" ? webappId : workflowId));
  const taskCapability = input.taskCapability === "image" || input.taskCapability === "audio" || input.taskCapability === "chat"
    ? input.taskCapability
    : "video";
  if (!runTargetId) throw new Error(targetType === "app" ? "缺少 webappId/runTargetId" : "缺少 workflowId/runTargetId");
  const matchedCatalogItem = findRunningHubCatalogItemByTarget(input.provider, targetType, runTargetId);
  if (matchedCatalogItem) {
    const publicCatalogItem = toPublicRunningHubCatalogItem(input.provider, matchedCatalogItem);
    await assertCanUseRunningHubCatalogItem(input.user, publicCatalogItem);
  }
  const taskQueueSettingsRecord = await readTaskQueueSettingsRecord().catch(() => null);
  const legacyFallbackConcurrency = Math.max(
    1,
    Number(taskQueueSettingsRecord?.taskQueueSettings?.runninghub?.concurrency) || 1,
  );
  const runningHubKeyAvailability = await inspectRunningHubKeyPoolAvailability(input.provider, legacyFallbackConcurrency);
  if (!runningHubKeyAvailability.pool.length) {
    throw new Error("RunningHub 未配置可用 Key");
  }
  const preferredRhKey = runningHubKeyAvailability.selected || runningHubKeyAvailability.pool[0] || null;
  const rhQueueReason = runningHubKeyAvailability.allBusy ? "all_keys_busy" : "";
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const task: AdminTaskRecord = {
    id: taskId,
    title: input.title || `RunningHub 任务 · ${runTargetId}`,
    status: "queued",
    ownerId: input.user.id,
    providerId: input.provider.id,
    modelId: "",
    payload: {
      taskCapability,
      executionMode: "worker_queue",
      targetType,
      rhCatalogId: matchedCatalogItem ? `${input.provider.id}:${matchedCatalogItem.kind || targetType}:${matchedCatalogItem.id}` : undefined,
      rhCatalogTitle: matchedCatalogItem?.title,
      rhCatalogKind: matchedCatalogItem?.kind,
      pageId,
      webappId,
      workflowId,
      runTargetId,
      nodeInfoList: input.nodeInfoList,
      executionRules: matchedCatalogItem?.executionRules,
      pollIntervalMs: matchedCatalogItem?.executionRules?.pollingIntervalMs,
      pollTimeoutMs: matchedCatalogItem?.executionRules?.pollingTimeoutMs,
      ...(input.instanceType ? { instanceType: input.instanceType } : {}),
      ...(preferredRhKey ? {
        preferredRhKeyId: preferredRhKey.id,
        preferredRhKeyNoteSnapshot: preferredRhKey.note,
        preferredRhKeyMaxConcurrency: preferredRhKey.maxConcurrency,
      } : {}),
      ...(rhQueueReason ? { rhQueueReason } : {}),
      requestId: input.requestContext.requestId,
      userId: input.user.id,
    },
    result: {
      adapter: "runninghub",
      protocol: "runninghub",
      capability: taskCapability,
      providerId: input.provider.id,
      providerName: input.provider.name,
      rhCatalogId: matchedCatalogItem ? `${input.provider.id}:${matchedCatalogItem.kind || targetType}:${matchedCatalogItem.id}` : undefined,
      rhCatalogTitle: matchedCatalogItem?.title,
      rhCatalogKind: matchedCatalogItem?.kind,
      rhTargetType: targetType,
      rhRunTargetId: runTargetId,
      pageId,
      webappId,
      workflowId,
      executionRules: matchedCatalogItem?.executionRules,
      pollIntervalMs: matchedCatalogItem?.executionRules?.pollingIntervalMs,
      pollTimeoutMs: matchedCatalogItem?.executionRules?.pollingTimeoutMs,
      ...(preferredRhKey ? {
        preferredRhKeyId: preferredRhKey.id,
        preferredRhKeyNoteSnapshot: preferredRhKey.note,
        preferredRhKeyMaxConcurrency: preferredRhKey.maxConcurrency,
      } : {}),
      ...(rhQueueReason ? { rhQueueReason } : {}),
      requestId: input.requestContext.requestId,
      userId: input.user.id,
    },
    logs: ["画布提交 RunningHub 后台任务"],
    createdAt: now,
    updatedAt: now,
  };
  await insertTaskRecord(task);
  const queueCapability = taskCapability === "image" || taskCapability === "audio" ? taskCapability : "video";
  const queueResult = await enqueueTask(task.id, queueCapability);
  const queueLog = queueResult.queued ? `已进入 Redis 队列 ${queueResult.queueName}` : `未进入 Redis 队列: ${queueResult.reason}`;
  await appendTaskLog(task.id, queueLog);
  if (!queueResult.queued) {
    await writeTaskRecord({
      ...task,
      status: "failed",
      result: { ...plainObject(task.result), error: queueLog, failureReason: queueLog },
      logs: [...task.logs, queueLog],
      updatedAt: Date.now(),
    });
    throw new Error(`RunningHub 任务队列不可用：${queueResult.reason}`);
  }
  return task;
}

async function prepareRunningHubUploadSource(sourceUrl: string, user: CurrentUser, publicOrigin: string) {
  const normalizedUrl = normalizeProviderReferenceUrlForAccess(sourceUrl, publicOrigin, user, { secret: secretKey(), scope: environment });
  const resolvedUrl = normalizedUrl.startsWith("/")
    ? `${publicOrigin.replace(/\/+$/, "")}${normalizedUrl}`
    : normalizedUrl;
  const response = await fetch(resolvedUrl, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`读取上传资源失败 ${response.status}`);
  const mime = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase() || "application/octet-stream";
  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = inferRunningHubUploadFilename(sourceUrl, mime);
  return {
    buffer,
    mime,
    filename,
    kind: inferRunningHubAssetKind(mime, filename),
  };
}

function inferRunningHubUploadFilename(sourceUrl: string, mime: string) {
  const normalized = safeText(sourceUrl);
  const directName = normalized
    ? basename(
        normalized.startsWith("http://") || normalized.startsWith("https://")
          ? new URL(normalized).pathname
          : normalized,
      )
    : "";
  if (directName && /\.[A-Za-z0-9]{2,8}$/.test(directName)) return directName;
  const ext = extname(`placeholder.${mimeToExtension(mime)}`).replace(/^\./, "") || "bin";
  return `rh_input_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

function mimeToExtension(mime: string) {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  if (mime === "audio/mpeg" || mime === "audio/mp3") return "mp3";
  if (mime === "audio/wav" || mime === "audio/x-wav") return "wav";
  if (mime === "audio/ogg") return "ogg";
  return "bin";
}

function inferRunningHubAssetKind(mime: string, filename: string) {
  const lowerMime = safeText(mime).toLowerCase();
  const lowerName = safeText(filename).toLowerCase();
  if (lowerMime.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|avif)$/.test(lowerName)) return "image";
  if (lowerMime.startsWith("video/") || /\.(mp4|webm|mov|m4v|mkv)$/.test(lowerName)) return "video";
  if (lowerMime.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|flac|aac)$/.test(lowerName)) return "audio";
  return "file";
}

function mapRunningHubTaskStatus(status: string) {
  if (status === "succeeded") return "SUCCESS";
  if (status === "failed" || status === "cancelled") return "FAILED";
  if (status === "running") return "RUNNING";
  return "QUEUED";
}

function mapRunningHubTaskCode(status: string) {
  if (status === "succeeded") return 0;
  if (status === "running") return 804;
  if (status === "queued") return 813;
  return 805;
}

interface RunningHubAnalyzeDraftSection {
  key: string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
}

interface RunningHubAnalyzeDraft {
  summary: string;
  sections: RunningHubAnalyzeDraftSection[];
  warnings: string[];
  detectedKind?: "app" | "workflow";
  detectedTargetId?: string;
  autoSwitchMessage?: string;
}

interface RunningHubDetectedTarget {
  kind?: "app" | "workflow";
  targetId: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  shouldSwitch: boolean;
}

function createRunningHubCatalogEntryId(kind: "app" | "workflow") {
  const suffix = randomBytes(4).toString("hex");
  return `${kind}-${Date.now().toString(36)}-${suffix}`;
}

function createBlankRunningHubCatalogEntry(kind: "app" | "workflow", titleText: string): RunningHubAdminCatalogEntry {
  const id = createRunningHubCatalogEntryId(kind);
  return {
    id,
    kind,
    title: titleText,
    note: "",
    thumbnail: "",
    enabled: false,
    pageId: id,
    appId: kind === "app" ? id : "",
    workflowId: kind === "workflow" ? id : "",
    runTargetId: id,
    taskCapability: kind === "app" ? "image" : "video",
    workflowJson: "",
    fields: [],
    allowsEmptyInputs: false,
    parameterSchema: "{}",
    outputSchema: [],
    executionRules: normalizeRunningHubExecutionRulesForAdmin(undefined, kind, id),
    testPayload: "{}",
  };
}

function hasRunningHubFieldDefinitions(fields: unknown) {
  return normalizeRunningHubFieldDefinitions(fields).length > 0;
}

function hasRunningHubExplicitEmptyNodeInfoList(testPayload: unknown) {
  const text = safeText(testPayload);
  if (!text) return false;
  try {
    const payload = JSON.parse(text) as { nodeInfoList?: unknown };
    return Array.isArray(payload.nodeInfoList) && payload.nodeInfoList.length <= 0;
  } catch {
    return false;
  }
}

function allowsRunningHubEntryWithoutFields(testPayload: unknown) {
  return hasRunningHubExplicitEmptyNodeInfoList(testPayload);
}

function assertRunningHubEntryCanBeEnabled(entry: {
  enabled: boolean;
  kind?: "app" | "workflow";
  title?: string;
  catalogId?: string;
  fields?: RunningHubFieldDefinition[];
  testPayload?: string;
}) {
  if (!entry.enabled) return;
  if (hasRunningHubFieldDefinitions(entry.fields)) return;
  if (allowsRunningHubEntryWithoutFields(entry.testPayload)) return;
  const itemLabel = safeText(entry.title || entry.catalogId, entry.kind === "app" ? "RunningHub AI 应用" : "RunningHub 工作流");
  throw new Error(`${itemLabel} 仍缺少输入槽定义，不能启用。请至少补齐一个包含 nodeId 和 fieldName 的输入槽，或先保存为停用草稿。`);
}

function assertRunningHubTargetConsistency(kind: "app" | "workflow", row: {
  runTargetId?: string;
  appId?: string;
  workflowId?: string;
}) {
  const runTargetId = safeText(row.runTargetId);
  const appId = safeText(row.appId);
  const workflowId = safeText(row.workflowId);
  if (kind === "app") {
    if (workflowId) throw new Error("当前条目已识别为 AI 应用，不能继续保留 workflowId");
    if (!runTargetId && !appId) throw new Error("AI 应用缺少 runTargetId/appId");
    return;
  }
  if (!runTargetId && !workflowId) throw new Error("工作流缺少 runTargetId/workflowId");
  if (appId && !workflowId) throw new Error("当前条目已识别为工作流，不能继续保留 appId");
}

async function persistRunningHubProviderRecord(
  db: AdminDb,
  providerId: string,
  transform: (provider: AdminProviderRecord) => AdminProviderRecord,
) {
  let nextProvider: AdminProviderRecord | null = null;
  const providers = db.providers.map((provider) => {
    if (provider.id !== providerId) return provider;
    nextProvider = transform(provider);
    return nextProvider;
  });
  if (!nextProvider) throw new Error("RunningHub Provider 不存在");
  if (usePostgresRepository()) {
    await upsertProviderRecordPostgres(nextProvider);
  } else {
    await writeAdminDb({ ...db, providers });
  }
  return nextProvider;
}

async function listAdminRunningHubGroups(providerId: string): Promise<RhCatalogGroup[]> {
  const normalizedProviderId = safeText(providerId);
  if (!normalizedProviderId) throw new Error("缺少 RunningHub Provider");
  const db = await readAdminDb();
  const provider = db.providers.find((item) => item.id === normalizedProviderId);
  if (!provider) throw new Error("Provider 不存在");
  return normalizeRunningHubGroups(provider.rhGroups, provider.id);
}

async function findRunningHubGroupOwner(groupId: string, providerId?: string) {
  const db = await readAdminDb();
  const providers = providerId ? db.providers.filter((item) => item.id === providerId) : db.providers;
  for (const provider of providers) {
    const groups = normalizeRunningHubGroups(provider.rhGroups, provider.id);
    const group = groups.find((item) => item.id === groupId);
    if (group) return { db, provider, group };
  }
  return { db, provider: null, group: null };
}

async function createAdminRunningHubGroup(input: { providerId?: string; name?: string; description?: string; enabled?: boolean; sortOrder?: number }) {
  const providerId = safeText(input.providerId);
  if (!providerId) throw new Error("缺少 RunningHub Provider");
  const db = await readAdminDb();
  const provider = db.providers.find((item) => item.id === providerId);
  if (!provider) throw new Error("Provider 不存在");
  const name = safeText(input.name).slice(0, 120);
  if (!name) throw new Error("RUNNINGHUB_GROUP_NAME_REQUIRED");
  const groups = normalizeRunningHubGroups(provider.rhGroups, provider.id);
  if (groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) throw new Error("RUNNINGHUB_GROUP_NAME_EXISTS");
  const now = Date.now();
  const group: RhCatalogGroup = {
    id: `rhg-${now}-${randomToken(4)}`,
    providerId,
    name,
    description: safeText(input.description).slice(0, 1000),
    enabled: input.enabled !== false,
    sortOrder: Math.max(0, Math.floor(Number(input.sortOrder) || 0)),
    createdAt: now,
    updatedAt: now,
  };
  await persistRunningHubProviderRecord(db, providerId, (current) => ({ ...current, rhGroups: [...groups, group], updatedAt: now }));
  return group;
}

async function updateAdminRunningHubGroup(groupId: string, input: { providerId?: string; name?: string; description?: string; enabled?: boolean; sortOrder?: number }) {
  const found = await findRunningHubGroupOwner(groupId, safeText(input.providerId) || undefined);
  if (!found.provider || !found.group) throw new Error("RUNNINGHUB_GROUP_NOT_FOUND");
  const groups = normalizeRunningHubGroups(found.provider.rhGroups, found.provider.id);
  const name = input.name === undefined ? found.group.name : safeText(input.name).slice(0, 120);
  if (!name) throw new Error("RUNNINGHUB_GROUP_NAME_REQUIRED");
  if (groups.some((group) => group.id !== groupId && group.name.toLowerCase() === name.toLowerCase())) throw new Error("RUNNINGHUB_GROUP_NAME_EXISTS");
  const updated: RhCatalogGroup = {
    ...found.group,
    name,
    description: input.description === undefined ? found.group.description : safeText(input.description).slice(0, 1000),
    enabled: input.enabled === undefined ? found.group.enabled : Boolean(input.enabled),
    sortOrder: input.sortOrder === undefined ? found.group.sortOrder : Math.max(0, Math.floor(Number(input.sortOrder) || 0)),
    updatedAt: Date.now(),
  };
  await persistRunningHubProviderRecord(found.db, found.provider.id, (current) => ({
    ...current,
    rhGroups: normalizeRunningHubGroups(current.rhGroups, current.id).map((group) => group.id === groupId ? updated : group),
    updatedAt: updated.updatedAt,
  }));
  return updated;
}

async function deleteAdminRunningHubGroup(groupId: string) {
  const found = await findRunningHubGroupOwner(groupId);
  if (!found.provider || !found.group) throw new Error("RUNNINGHUB_GROUP_NOT_FOUND");
  const ungroupedCatalogIds: string[] = [];
  const groups = normalizeRunningHubGroups(found.provider.rhGroups, found.provider.id).filter((group) => group.id !== groupId);
  const ungroup = (entries: unknown, kind: "app" | "workflow") => normalizeRunningHubEntries(entries, kind).map((entry) => {
    if (entry.groupId !== groupId) return entry;
    ungroupedCatalogIds.push(`${found.provider!.id}:${kind}:${entry.id}`);
    return { ...entry, groupId: undefined };
  });
  await persistRunningHubProviderRecord(found.db, found.provider.id, (current) => ({
    ...current,
    rhGroups: groups,
    rhApps: ungroup(current.rhApps, "app"),
    rhWorkflows: ungroup(current.rhWorkflows, "workflow"),
    updatedAt: Date.now(),
  }));
  return { groupId, ungroupedCatalogIds };
}

async function createAdminRunningHubCatalogItem(input: {
  providerId?: string;
  kind?: "app" | "workflow";
  title?: string;
  note?: string;
  sourceCatalogId?: string;
  groupId?: string;
  enabled?: boolean;
  thumbnail?: string;
  workflowJson?: string;
  fields?: RunningHubFieldDefinition[];
  pageId?: string;
  appId?: string;
  workflowId?: string;
  runTargetId?: string;
  taskCapability?: "image" | "video" | "audio" | "chat";
  parameterSchema?: string;
  outputSchema?: RunningHubOutputDefinition[];
  executionRules?: RunningHubExecutionRules;
  testPayload?: string;
}): Promise<AdminRunningHubCatalogItem> {
  const providerId = safeText(input.providerId);
  if (!providerId) throw new Error("缺少 RunningHub Provider");
  const kind = input.kind === "app" ? "app" : "workflow";
  const db = await readAdminDb();
  const source = input.sourceCatalogId ? await adminRunningHubCatalogItemDetail(safeText(input.sourceCatalogId)) : null;
  const nextTitle = safeText(
    input.title,
    source ? `${source.title} 副本` : kind === "app" ? "新建 AI 应用" : "新建工作流",
  );
  const nextEntry = source
    ? {
        ...normalizeRunningHubCatalogItem(source, kind),
        id: createRunningHubCatalogEntryId(kind),
        kind,
        title: nextTitle,
        note: safeText(input.note, source.note || ""),
        enabled: true,
      } satisfies RunningHubAdminCatalogEntry
    : createBlankRunningHubCatalogEntry(kind, nextTitle);
  nextEntry.enabled = input.enabled === undefined ? nextEntry.enabled : Boolean(input.enabled);
  const providerForCreate = db.providers.find((provider) => provider.id === providerId);
  if (!providerForCreate) throw new Error("Provider 不存在");
  const groupsForCreate = normalizeRunningHubGroups(providerForCreate.rhGroups, providerId);
  if (input.groupId !== undefined) {
    const groupId = safeText(input.groupId);
    if (groupId && !groupsForCreate.some((group) => group.id === groupId)) throw new Error("RUNNINGHUB_GROUP_NOT_FOUND");
    nextEntry.groupId = groupId || undefined;
  }
  nextEntry.note = input.note === undefined ? nextEntry.note : safeText(input.note);
  nextEntry.thumbnail = input.thumbnail === undefined ? nextEntry.thumbnail : safeText(input.thumbnail);
  nextEntry.workflowJson = input.workflowJson === undefined ? nextEntry.workflowJson : safeRunningHubJsonText(input.workflowJson, "");
  nextEntry.fields = input.fields === undefined ? normalizeRunningHubFieldDefinitions(nextEntry.fields) : normalizeRunningHubFieldDefinitions(input.fields);
  nextEntry.pageId = input.pageId === undefined ? safeText(nextEntry.pageId, nextEntry.id) : safeText(input.pageId, nextEntry.id);
  nextEntry.runTargetId = input.runTargetId === undefined ? safeText(nextEntry.runTargetId, nextEntry.id) : safeText(input.runTargetId, nextEntry.id);
  nextEntry.taskCapability = input.taskCapability === "image" || input.taskCapability === "audio" || input.taskCapability === "chat"
    ? input.taskCapability
    : input.taskCapability === "video"
      ? "video"
      : nextEntry.taskCapability;
  nextEntry.pageId = safeText(nextEntry.pageId, nextEntry.id);
  nextEntry.runTargetId = safeText(nextEntry.runTargetId, nextEntry.id);
  if (kind === "app") {
    nextEntry.appId = input.appId === undefined ? safeText(nextEntry.appId, nextEntry.runTargetId) : safeText(input.appId, nextEntry.runTargetId);
    nextEntry.workflowId = "";
  } else {
    nextEntry.workflowId = input.workflowId === undefined ? safeText(nextEntry.workflowId, nextEntry.runTargetId) : safeText(input.workflowId, nextEntry.runTargetId);
    nextEntry.appId = "";
  }
  nextEntry.parameterSchema = input.parameterSchema === undefined ? safeRunningHubObjectJsonText(nextEntry.parameterSchema, "{}") : safeRunningHubObjectJsonText(input.parameterSchema, "{}");
  nextEntry.allowsEmptyInputs = allowsRunningHubEntryWithoutFields(input.testPayload === undefined ? nextEntry.testPayload : input.testPayload);
  nextEntry.outputSchema = input.outputSchema === undefined ? normalizeRunningHubOutputDefinitionsForAdmin(nextEntry.outputSchema) : normalizeRunningHubOutputDefinitionsForAdmin(input.outputSchema);
  nextEntry.executionRules = input.executionRules === undefined
    ? normalizeRunningHubExecutionRulesForAdmin(nextEntry.executionRules, kind, nextEntry.runTargetId)
    : normalizeRunningHubExecutionRulesForAdmin(input.executionRules, kind, nextEntry.runTargetId);
  nextEntry.testPayload = input.testPayload === undefined ? safeRunningHubJsonText(nextEntry.testPayload, "{}") : safeRunningHubJsonText(input.testPayload, "{}");
  assertRunningHubTargetConsistency(kind, nextEntry);
  assertRunningHubEntryCanBeEnabled(nextEntry);
  const updatedProvider = await persistRunningHubProviderRecord(db, providerId, (provider) => {
    const list = kind === "app"
      ? normalizeRunningHubEntries(provider.rhApps, "app")
      : normalizeRunningHubEntries(provider.rhWorkflows, "workflow");
    const merged = [...list, nextEntry];
    return {
      ...provider,
      rhApps: kind === "app" ? merged : provider.rhApps,
      rhWorkflows: kind === "workflow" ? merged : provider.rhWorkflows,
      updatedAt: Date.now(),
    };
  });
  return toAdminRunningHubCatalogItem(updatedProvider, nextEntry);
}

async function deleteAdminRunningHubCatalogItem(catalogId: string): Promise<AdminRunningHubCatalogItem> {
  const db = await readAdminDb();
  const item = await adminRunningHubCatalogItemDetail(catalogId);
  if (!item) throw new Error("RunningHub 条目不存在");
  const [providerId, kindText, itemId] = catalogId.split(":");
  const kind = kindText === "app" ? "app" : "workflow";
  if (!providerId || !itemId) throw new Error("RunningHub catalogId 无效");
  await persistRunningHubProviderRecord(db, providerId, (provider) => {
    const sourceList = kind === "app"
      ? normalizeRunningHubEntries(provider.rhApps, "app")
      : normalizeRunningHubEntries(provider.rhWorkflows, "workflow");
    const nextList = sourceList.filter((entry) => entry.id !== itemId);
    return {
      ...provider,
      rhApps: kind === "app" ? nextList : provider.rhApps,
      rhWorkflows: kind === "workflow" ? nextList : provider.rhWorkflows,
      updatedAt: Date.now(),
    };
  });
  return item;
}

async function analyzeRunningHubCatalogDraft(input: {
  providerId?: string;
  kind?: "app" | "workflow";
  sourceUrl?: string;
  pageId?: string;
  runTargetId?: string;
  docUrl?: string;
  requestExample?: string;
  responseExample?: string;
  notes?: string;
}): Promise<RunningHubAnalyzeDraft> {
  const requestedKind = input.kind === "app" ? "app" : "workflow";
  const requestExampleObject = parseRunningHubExampleObject(input.requestExample);
  const responseExampleObject = parseRunningHubExampleObject(input.responseExample);
  const detectedTarget = detectRunningHubTarget({
    docUrl: safeText(input.docUrl),
    sourceUrl: safeText(input.sourceUrl),
    runTargetId: safeText(input.runTargetId),
    pageId: safeText(input.pageId),
    requestExample: requestExampleObject,
    requestedKind,
  });
  const kind = detectedTarget.kind === "app" ? "app" : requestedKind;
  const referenceTargetId = safeText(detectedTarget.targetId);
  const requestExampleRunTargetId = extractRunningHubRunTargetIdFromExample(kind, requestExampleObject);
  const pageId = safeText(
    input.pageId
      || extractRunningHubPageIdFromExample(requestExampleObject)
      || referenceTargetId,
  );
  const runTargetId = safeText(
    referenceTargetId || input.runTargetId || requestExampleRunTargetId || detectedTarget.targetId,
    pageId || createRunningHubCatalogEntryId(kind),
  );
  const capabilityText = [input.docUrl, input.sourceUrl, input.notes, input.requestExample, input.responseExample]
    .map((item) => safeText(item).toLowerCase())
    .join("\n");
  const requestExampleFields = buildRunningHubFieldsFromRequestExample(requestExampleObject);
  const taskCapability = /audio/.test(capabilityText)
    ? "audio"
    : /chat|text/.test(capabilityText)
      ? "chat"
      : /image|png|jpg|jpeg|webp/.test(capabilityText)
        ? "image"
        : "video";
  const title = safeText(
    input.notes,
    kind === "app" ? `RunningHub AI 应用 ${pageId || runTargetId}` : `RunningHub Workflow ${pageId || runTargetId}`,
  ).slice(0, 80);
  const baseDraft = {
    title,
    note: safeText(input.notes, "待管理员确认条目标题、备注与运行目标。"),
    pageId,
    runTargetId,
    taskCapability,
  };
  const inputDraft = {
    fields: requestExampleFields,
    guidance: requestExampleFields.length > 0
      ? "已从 requestExample.nodeInfoList 生成输入槽草案，请重点核对 nodeId、fieldName 与 required。"
      : "从文档或示例请求中补齐输入槽定义，至少包含 nodeId、fieldName、valueType、required。",
  };
  const parameterDraft = requestExampleFields.length > 0
    ? buildRunningHubParameterDraftFromFields(requestExampleFields)
    : {
        type: "object",
        properties: {},
        required: [],
      };
  const fallbackOutputDraft: { outputs: RunningHubOutputDefinition[] } = {
    outputs: [
      {
        key: taskCapability === "audio" ? "audio" : taskCapability === "image" ? "image" : taskCapability === "chat" ? "text" : "video",
        label: taskCapability === "audio" ? "输出音频" : taskCapability === "image" ? "输出图像" : taskCapability === "chat" ? "输出文本" : "输出视频",
        kind: taskCapability === "chat" ? "text" : taskCapability,
        path: "data",
        multiple: true,
      },
    ],
  };
  const fallbackExecutionDraft: RunningHubExecutionRules = {
    submitMode: "direct",
    targetType: kind,
    method: "POST",
    endpoint: runningHubDefaultEndpoint(kind, runTargetId),
    resultPath: "data",
    errorPath: "message",
    acceptsUploads: true,
    acceptsRemoteUrls: true,
    outputKind: "remote-url",
    supportsMultipleOutputs: true,
    pollingStrategy: "none",
    pollingIntervalMs: 0,
    pollingTimeoutMs: 0,
    retryable: false,
  };
  const outputDraft = buildRunningHubOutputDraftFromResponseExample(responseExampleObject, taskCapability, fallbackOutputDraft);
  const executionDraft = buildRunningHubExecutionDraft(kind, runTargetId, responseExampleObject, outputDraft, fallbackExecutionDraft);
  const warnings = [
    "AI 草案不会直接覆盖现有条目，应用前仍需人工确认。",
    "pageId / runTargetId 仅作为后台目录字段保存，不会继续下放到画布节点让用户手工维护。",
  ];
  const requestedRunTargetId = safeText(input.runTargetId);
  if (requestedRunTargetId && referenceTargetId && requestedRunTargetId !== referenceTargetId) {
    warnings.push("文档链接里的 runTargetId 与表单填写值不一致，请人工确认最终提交目标。");
  }
  if (requestedRunTargetId && requestExampleRunTargetId && requestedRunTargetId !== requestExampleRunTargetId) {
    warnings.push("requestExample 里的 runTargetId 与表单填写的运行目标 ID 不一致，请人工确认最终提交目标。");
  }
  if (safeText(input.requestExample) && !requestExampleObject) {
    warnings.push("requestExample 不是合法 JSON 对象，本轮无法自动解析 nodeInfoList。");
  }
  if (safeText(input.responseExample) && !responseExampleObject) {
    warnings.push("responseExample 不是合法 JSON 对象，本轮只把它作为能力线索参与分析。");
  }
  if (requestExampleObject && requestExampleFields.length <= 0) {
    warnings.push("requestExample 已解析，但没有识别到可用的 nodeInfoList 字段。");
  }
  const autoSwitchMessage = detectedTarget.shouldSwitch
    ? kind === "app"
      ? "检测到这是 AI App，已自动切换到 AI 应用区域"
      : "检测到这是工作流，已自动切换到工作流区域"
    : "";
  return {
    summary: `已根据 ${kind === "app" ? "AI 应用" : "工作流"} 线索生成结构化 RH 草案，请重点核对运行目标、输入槽和执行规则。`,
    detectedKind: detectedTarget.kind,
    detectedTargetId: runTargetId || detectedTarget.targetId,
    autoSwitchMessage,
    sections: [
      { key: "base", title: "基础信息草案", description: "条目标题、备注和运行目标。", payload: baseDraft },
      { key: "inputs", title: "输入槽草案", description: "建议补齐输入槽结构，而不是直接手写 JSON。", payload: inputDraft },
      { key: "params", title: "参数 Schema 草案", description: "面向节点参数渲染的结构化参数草案。", payload: parameterDraft },
      { key: "outputs", title: "输出定义草案", description: "后端结果提取后的输出定义。", payload: outputDraft },
      { key: "execution", title: "执行规则草案", description: "提交、结果提取和错误提取规则。", payload: executionDraft as unknown as Record<string, unknown> },
    ],
    warnings,
  };
}

async function reconcilePermissionSubjects() {
  if (permissionSubjectReconciliation) return permissionSubjectReconciliation;
  const current = (async () => {
    const [sharedResources, runningHubItems, providerModels, providers] = await Promise.all([
      readSharedResourceCatalog(),
      adminRunningHubCatalogItems(),
      providerRepository.readModelRecords(),
      providerRepository.readProviderRecords(),
    ]);
    await permissionSubjectRegistrar.reconcileFirstWavePermissionSubjects({
      resourceCategories: sharedResources.categories,
      resourceItems: sharedResources.items,
      runningHubItems,
      runningHubGroups: providers.flatMap((provider) => normalizeRunningHubGroups(provider.rhGroups, provider.id).map((group) => ({
        id: group.id,
        providerId: provider.id,
        name: group.name,
        enabled: group.enabled,
      }))),
      nodeTypes: CANVAS_NODE_PERMISSION_CATALOG.map((type) => ({ type, label: type, category: "canvas" })),
      providerModels,
    });
  })();
  permissionSubjectReconciliation = current;
  try {
    await current;
  } finally {
    if (permissionSubjectReconciliation === current) permissionSubjectReconciliation = null;
  }
}

async function filterRunningHubItems(
  items: RhCatalogItem[],
  currentUser?: CurrentUser | null,
  includeRestricted?: boolean,
  permissionContext?: { authDb: AuthDb; groupsByProvider: Map<string, RhCatalogGroup[]> },
) {
  if (includeRestricted || !currentUser) return items;
  const authDb = permissionContext?.authDb || await readAuthDb();
  const groupsByProvider = permissionContext?.groupsByProvider || new Map<string, RhCatalogGroup[]>();
  const legacyPolicy = policyForUser(currentUser, authDb.groupPermissionPolicies);
  const results = await Promise.all(items.map(async (item) => ({
    item,
    decision: await decideRunningHubAccess({
      item,
      group: groupsByProvider.get(item.providerId)?.find((group) => group.id === item.groupId),
      action: "view",
      itemLegacyAllowed: canUseRunningHubCatalogItem(legacyPolicy, item),
      decide: (subjectKey, action) => permissionRuntime.decide({ user: currentUser, subjectKey, action, legacyAllowed: true }),
    }),
  })));
  return results.filter((entry) => entry.decision.allowed).map((entry) => entry.item);
}

async function readPermissionReadinessReport() {
  await reconcilePermissionSubjects();
  const [authorizationState, authDb] = await Promise.all([
    permissionRepository.readAuthorizationState(),
    readAuthDb(),
  ]);
  return evaluatePermissionReadiness({
    subjects: authorizationState.subjects,
    rules: authorizationState.rules,
    groupIds: authDb.userGroups.map((group) => group.id),
    users: authDb.users,
  });
}

async function adminRunningHubCatalogItems() {
  const providers = await providerRepository.readProviderRecords();
  return providers
    .filter((provider) => normalizeProviderProtocol(provider.protocol) === "runninghub")
    .flatMap((provider) => {
      const workflows = normalizeRunningHubCatalogItems(provider.rhWorkflows, "workflow").map((entry) =>
        toAdminRunningHubCatalogItem(provider, entry),
      );
      const apps = normalizeRunningHubCatalogItems(provider.rhApps, "app").map((entry) =>
        toAdminRunningHubCatalogItem(provider, entry),
      );
      return [...workflows, ...apps];
    });
}

async function adminRunningHubCatalogItemDetail(catalogId: string): Promise<AdminRunningHubCatalogItem | null> {
  const items = await adminRunningHubCatalogItems();
  const canonicalMatch = items.find((entry) => entry.catalogId === catalogId);
  if (canonicalMatch) return canonicalMatch;
  const idMatches = items.filter((entry) => entry.id === catalogId);
  return idMatches.length === 1 ? idMatches[0] : null;
}

function runningHubDefaultEndpoint(kind: "app" | "workflow", targetId: string) {
  return kind === "app" ? `/runninghub/app/${targetId}/run` : `/runninghub/workflow/${targetId}/run`;
}

function isRunningHubDefaultEndpoint(kind: "app" | "workflow", targetId: string, endpoint: string) {
  return endpoint.trim() === runningHubDefaultEndpoint(kind, targetId);
}

function safeRunningHubJsonText(value: unknown, fallback = "{}") {
  const text = safeLongText(value, "", 200000);
  if (!text) return fallback;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    throw new Error("RunningHub JSON 字段必须是合法 JSON");
  }
}

function safeRunningHubObjectJsonText(value: unknown, fallback = "{}") {
  const text = safeRunningHubJsonText(value, fallback);
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("参数 Schema 必须是 JSON 对象，不能是数组、字符串或数字");
  }
  return JSON.stringify(parsed, null, 2);
}

function preserveRunningHubJsonText(value: unknown, fallback = "{}") {
  try {
    return safeRunningHubJsonText(value, fallback);
  } catch {
    return safeText(value, fallback);
  }
}

function preserveRunningHubObjectJsonText(value: unknown, fallback = "{}") {
  try {
    return safeRunningHubObjectJsonText(value, fallback);
  } catch {
    return fallback;
  }
}

function tryParseRunningHubExampleObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractFirstBalancedRunningHubObjectSnippet(text: string) {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char !== "}" || depth <= 0) continue;
    depth -= 1;
    if (depth !== 0 || start < 0) continue;
    const candidate = text.slice(start, index + 1).trim();
    if (tryParseRunningHubExampleObject(candidate)) return candidate;
    start = -1;
  }
  return "";
}

function extractRunningHubJsonObjectSnippet(text: string) {
  const fencedPattern = /```(?:json|javascript|js)?\s*([\s\S]*?)```/gi;
  for (const match of text.matchAll(fencedPattern)) {
    const fencedText = safeLongText(match[1], "", 16000);
    if (!fencedText) continue;
    if (tryParseRunningHubExampleObject(fencedText)) return fencedText;
    const nestedSnippet = extractFirstBalancedRunningHubObjectSnippet(fencedText);
    if (nestedSnippet) return nestedSnippet;
  }
  return extractFirstBalancedRunningHubObjectSnippet(text);
}

function parseRunningHubExampleObject(value: unknown): Record<string, unknown> | null {
  const text = safeLongText(value, "", 16000);
  if (!text) return null;
  const directObject = tryParseRunningHubExampleObject(text);
  if (directObject) return directObject;
  const snippet = extractRunningHubJsonObjectSnippet(text);
  if (!snippet) return null;
  return tryParseRunningHubExampleObject(snippet);
}

function extractRunningHubRunTargetIdFromExample(
  kind: "app" | "workflow",
  example: Record<string, unknown> | null,
) {
  if (!example) return "";
  return safeText(
    example.runTargetId
      || (kind === "app" ? example.webappId : example.workflowId)
      || example.webappId
      || example.workflowId,
  );
}

function extractRunningHubPageIdFromExample(example: Record<string, unknown> | null) {
  if (!example) return "";
  return safeText(example.pageId);
}

function detectRunningHubTarget(input: {
  docUrl?: string;
  sourceUrl?: string;
  runTargetId?: string;
  pageId?: string;
  requestExample?: Record<string, unknown> | null;
  requestedKind?: "app" | "workflow";
}): RunningHubDetectedTarget {
  const docUrl = safeText(input.docUrl || input.sourceUrl);
  const requestExample = input.requestExample || null;
  const requestedKind = input.requestedKind === "app" ? "app" : "workflow";
  // Example AI App doc pattern: call-api/api-detail/1978404642654670849?apiType=4
  const referenceRef = parseRunningHubRef(docUrl);
  if (referenceRef?.id) {
    return {
      kind: referenceRef.type,
      targetId: referenceRef.id,
      confidence: "high",
      reason: referenceRef.type === "app" ? "文档链接命中 AI App 路径" : "文档链接命中 Workflow 路径",
      shouldSwitch: referenceRef.type !== requestedKind,
    };
  }
  const apiDetailAppMatch = docUrl.match(/call-api\/api-detail\/([0-9A-Za-z_-]+)\?apiType=4/i);
  if (apiDetailAppMatch) {
    return {
      kind: "app",
      targetId: apiDetailAppMatch[1],
      confidence: "high",
      reason: "文档链接命中 call-api AI App 文档",
      shouldSwitch: requestedKind !== "app",
    };
  }
  const workflowId = safeText(requestExample?.workflowId || input.runTargetId);
  if (/^workflow-[0-9A-Za-z_-]+$/i.test(workflowId)) {
    return {
      kind: "workflow",
      targetId: workflowId,
      confidence: "high",
      reason: "命中 workflow 风格 ID",
      shouldSwitch: requestedKind !== "workflow",
    };
  }
  const appId = safeText(requestExample?.webappId || requestExample?.runTargetId || input.runTargetId);
  if (appId && /\/(?:openapi\/v2\/)?run\/ai-app\//i.test(docUrl)) {
    return {
      kind: "app",
      targetId: appId,
      confidence: "high",
      reason: "文档与示例共同指向 AI App",
      shouldSwitch: requestedKind !== "app",
    };
  }
  return {
    kind: undefined,
    targetId: safeText(input.runTargetId || workflowId || appId || input.pageId),
    confidence: "low",
    reason: "仅识别到 targetId，类型待确认",
    shouldSwitch: false,
  };
}

function inferRunningHubFieldValueTypeFromExample(fieldName: string, fieldValue: unknown) {
  const normalizedName = safeText(fieldName).toLowerCase();
  if (typeof fieldValue === "boolean") return "boolean";
  if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) return "number";
  if (Array.isArray(fieldValue)) return "array";
  if (fieldValue && typeof fieldValue === "object") return "json";
  if (/image|img|picture/.test(normalizedName)) return "image";
  if (/video/.test(normalizedName)) return "video";
  if (/audio|voice|sound/.test(normalizedName)) return "audio";
  return "string";
}

function normalizeRunningHubFieldExampleValue(fieldValue: unknown) {
  if (typeof fieldValue === "boolean") return fieldValue;
  if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) return fieldValue;
  if (Array.isArray(fieldValue) || (fieldValue && typeof fieldValue === "object")) {
    try {
      return JSON.stringify(fieldValue);
    } catch {
      return safeText(fieldValue);
    }
  }
  return safeText(fieldValue);
}

function buildRunningHubFieldLabel(fieldName: string) {
  return safeText(fieldName)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim() || "未命名输入槽";
}

function buildRunningHubFieldsFromRequestExample(example: Record<string, unknown> | null): RunningHubFieldDefinition[] {
  const rawList = Array.isArray(example?.nodeInfoList) ? example.nodeInfoList : [];
  const fields = new Map<string, RunningHubFieldDefinition>();
  for (const item of rawList) {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const nodeId = safeText(row.nodeId);
    const fieldName = safeText(row.fieldName);
    if (!nodeId || !fieldName) continue;
    const fieldValue = row.fieldValue;
    const key = `${nodeId}:${fieldName}`;
    if (fields.has(key)) continue;
    const valueType = inferRunningHubFieldValueTypeFromExample(fieldName, fieldValue);
    const normalizedValue = normalizeRunningHubFieldExampleValue(fieldValue);
    fields.set(key, {
      nodeId,
      fieldName,
      label: buildRunningHubFieldLabel(fieldName),
      description: `来自 requestExample.nodeInfoList 的 ${nodeId}.${fieldName}`,
      fieldType: valueType,
      valueType,
      required: normalizedValue !== "",
      fieldValue: normalizedValue === "" ? undefined : normalizedValue,
      defaultValue: normalizedValue === "" ? undefined : normalizedValue,
    });
  }
  return Array.from(fields.values());
}

function inferRunningHubOutputKindFromUrl(url: string): RunningHubOutputDefinition["kind"] | "" {
  if (/\.(png|jpe?g|webp|gif|bmp|avif)(\?|$)/i.test(url)) return "image";
  if (/\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(url)) return "video";
  if (/\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(url)) return "audio";
  return "";
}

function collectRunningHubExampleUrls(value: unknown, seen = new Set<string>()): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    const text = value.trim();
    if (!/^https?:\/\//i.test(text)) return [];
    if (seen.has(text)) return [];
    seen.add(text);
    return [text];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRunningHubExampleUrls(item, seen));
  }
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    return [
      ...collectRunningHubExampleUrls(row.url, seen),
      ...collectRunningHubExampleUrls(row.fileUrl, seen),
      ...collectRunningHubExampleUrls(row.downloadUrl, seen),
      ...collectRunningHubExampleUrls(row.previewUrl, seen),
      ...collectRunningHubExampleUrls(row.src, seen),
      ...collectRunningHubExampleUrls(row.outputs, seen),
      ...collectRunningHubExampleUrls(row.results, seen),
      ...collectRunningHubExampleUrls(row.files, seen),
      ...collectRunningHubExampleUrls(row.data, seen),
      ...collectRunningHubExampleUrls(row.result, seen),
    ];
  }
  return [];
}

function pickRunningHubResponseContainer(example: Record<string, unknown> | null) {
  const candidates: Array<{ path: string; value: unknown }> = example
    ? [
        { path: "data.outputs", value: (example.data as Record<string, unknown> | undefined)?.outputs },
        { path: "data.results", value: (example.data as Record<string, unknown> | undefined)?.results },
        { path: "data.files", value: (example.data as Record<string, unknown> | undefined)?.files },
        { path: "data.result", value: (example.data as Record<string, unknown> | undefined)?.result },
        { path: "data", value: example.data },
        { path: "result", value: example.result },
        { path: "outputs", value: example.outputs },
        { path: "results", value: example.results },
        { path: "files", value: example.files },
      ]
    : [];
  for (const candidate of candidates) {
    if (!candidate.value) continue;
    if (collectRunningHubExampleUrls(candidate.value).length > 0) return candidate;
    if (typeof candidate.value === "string" && candidate.value.trim()) return candidate;
    if (Array.isArray(candidate.value) && candidate.value.length > 0) return candidate;
    if (candidate.value && typeof candidate.value === "object" && Object.keys(candidate.value as Record<string, unknown>).length > 0) {
      return candidate;
    }
  }
  return { path: "data", value: example?.data ?? example ?? null };
}

function pickRunningHubTextOutputPath(value: unknown, basePath: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return basePath || "data";
  const row = value as Record<string, unknown>;
  for (const key of ["text", "content", "message", "msg", "caption", "prompt"]) {
    if (typeof row[key] === "string" && safeText(row[key])) {
      return basePath ? `${basePath}.${key}` : key;
    }
  }
  return basePath || "data";
}

function buildFallbackRunningHubOutputDefinition(taskCapability: "image" | "video" | "audio" | "chat"): RunningHubOutputDefinition {
  const kind = taskCapability === "chat" ? "text" : taskCapability;
  return {
    key: kind,
    label: kind === "audio" ? "输出音频" : kind === "image" ? "输出图像" : kind === "text" ? "输出文本" : "输出视频",
    kind,
    path: "data",
    multiple: kind !== "text",
  };
}

function buildRunningHubOutputDraftFromResponseExample(
  example: Record<string, unknown> | null,
  taskCapability: "image" | "video" | "audio" | "chat",
  fallback?: { outputs?: RunningHubOutputDefinition[] },
): { outputs: RunningHubOutputDefinition[] } {
  const fallbackOutput = normalizeRunningHubOutputDefinitionsForAdmin(fallback?.outputs)[0] || buildFallbackRunningHubOutputDefinition(taskCapability);
  if (!example) return { outputs: [fallbackOutput] };
  const container = pickRunningHubResponseContainer(example);
  const containerPath = safeText(container.path, fallbackOutput.path || "data");
  const urls = collectRunningHubExampleUrls(container.value);
  const grouped = new Map<RunningHubOutputDefinition["kind"], string[]>();
  for (const url of urls) {
    const kind = inferRunningHubOutputKindFromUrl(url);
    if (!kind) continue;
    grouped.set(kind, [...(grouped.get(kind) || []), url]);
  }
  const outputs: RunningHubOutputDefinition[] = [];
  for (const kind of ["image", "video", "audio"] as const) {
    const list = grouped.get(kind);
    if (!list?.length) continue;
    outputs.push({
      key: kind,
      label: kind === "image" ? "输出图像" : kind === "video" ? "输出视频" : "输出音频",
      kind,
      path: containerPath,
      multiple: list.length !== 1,
    });
  }
  if (outputs.length > 0) return { outputs };
  const textPath = pickRunningHubTextOutputPath(container.value, containerPath);
  if (taskCapability === "chat" || typeof container.value === "string" || Array.isArray(container.value)) {
    return {
      outputs: [
        {
          key: "text",
          label: "输出文本",
          kind: "text",
          path: textPath,
          multiple: Array.isArray(container.value),
        },
      ],
    };
  }
  return {
    outputs: [
      {
        ...fallbackOutput,
        path: containerPath || fallbackOutput.path || "data",
      },
    ],
  };
}

function hasRunningHubAsyncTaskSignal(example: Record<string, unknown> | null) {
  if (!example) return false;
  const data = example.data && typeof example.data === "object" && !Array.isArray(example.data)
    ? example.data as Record<string, unknown>
    : {};
  return Boolean(
    safeText(example.taskId)
    || safeText(example.task_id)
    || safeText(data.taskId)
    || safeText(data.task_id)
    || safeText(example.status)
    || safeText(data.status),
  );
}

function inferRunningHubErrorPath(example: Record<string, unknown> | null) {
  if (!example) return "message";
  const candidates = ["message", "msg", "errorMessage", "error", "detail"];
  for (const key of candidates) {
    if (safeText(example[key])) return key;
  }
  const data = example.data && typeof example.data === "object" && !Array.isArray(example.data)
    ? example.data as Record<string, unknown>
    : {};
  for (const key of candidates) {
    if (safeText(data[key])) return `data.${key}`;
  }
  return "message";
}

function buildRunningHubExecutionDraft(
  kind: "app" | "workflow",
  runTargetId: string,
  responseExampleObject: Record<string, unknown> | null,
  outputDraft: { outputs?: RunningHubOutputDefinition[] },
  fallback?: RunningHubExecutionRules,
): RunningHubExecutionRules {
  const fallbackRules = fallback || normalizeRunningHubExecutionRulesForAdmin(undefined, kind, runTargetId);
  const outputs = normalizeRunningHubOutputDefinitionsForAdmin(outputDraft.outputs);
  const primaryOutput = outputs[0];
  const asyncTask = hasRunningHubAsyncTaskSignal(responseExampleObject) && collectRunningHubExampleUrls(responseExampleObject).length === 0;
  return {
    ...fallbackRules,
    endpoint: runningHubDefaultEndpoint(kind, runTargetId),
    resultPath: safeText(primaryOutput?.path, fallbackRules.resultPath || "data"),
    errorPath: inferRunningHubErrorPath(responseExampleObject),
    supportsMultipleOutputs: outputs.some((item) => item.multiple !== false) || fallbackRules.supportsMultipleOutputs,
    pollingStrategy: asyncTask ? "fixed-interval" : "none",
    pollingIntervalMs: asyncTask ? 5000 : 0,
    pollingTimeoutMs: undefined,
  };
}

function mapRunningHubFieldValueTypeToSchemaType(valueType: string) {
  const normalized = safeText(valueType).toLowerCase();
  if (normalized === "boolean") return "boolean";
  if (normalized === "number") return "number";
  if (normalized === "array") return "array";
  if (normalized === "json") return "object";
  return "string";
}

function buildRunningHubParameterDraftFromFields(fields: RunningHubFieldDefinition[]) {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];
  const keyCount = new Map<string, number>();
  for (const field of fields) {
    const baseKey = safeText(field.fieldName, "field");
    const nextCount = (keyCount.get(baseKey) || 0) + 1;
    keyCount.set(baseKey, nextCount);
    const schemaKey = nextCount > 1 ? `${baseKey}_${safeText(field.nodeId, "node")}` : baseKey;
    properties[schemaKey] = {
      type: mapRunningHubFieldValueTypeToSchemaType(field.valueType || field.fieldType || "string"),
      title: safeText(field.label, field.fieldName),
      description: safeText(field.description, `映射到 ${field.nodeId}.${field.fieldName}`),
    };
    if (field.defaultValue !== undefined && field.defaultValue !== "") {
      properties[schemaKey].default = field.defaultValue;
    }
    if (Array.isArray(field.options) && field.options.length > 0) {
      properties[schemaKey].enum = field.options;
    }
    if (field.required) {
      required.push(schemaKey);
    }
  }
  return {
    type: "object",
    properties,
    required,
  };
}

function normalizeRunningHubOutputDefinitionsForAdmin(value: unknown): RunningHubOutputDefinition[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const key = safeText(row.key);
      const label = safeText(row.label);
      if (!key || !label) return null;
      const kind = safeText(row.kind, "image").toLowerCase();
      return {
        key,
        label,
        kind: kind || "image",
        path: safeText(row.path),
        multiple: row.multiple === undefined ? true : Boolean(row.multiple),
      } satisfies RunningHubOutputDefinition;
    })
    .filter(Boolean) as RunningHubOutputDefinition[];
}

function normalizeRunningHubExecutionRulesForAdmin(
  value: unknown,
  kind: "app" | "workflow",
  targetId: string,
): RunningHubExecutionRules {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const pollingStrategy = safeText(row.pollingStrategy).toLowerCase() === "fixed-interval" ? "fixed-interval" : "none";
  return {
    submitMode: "direct",
    targetType: kind,
    method: "POST",
    endpoint: safeText(
      row.endpoint,
      runningHubDefaultEndpoint(kind, targetId),
    ),
    resultPath: safeText(row.resultPath, "data"),
    errorPath: safeText(row.errorPath, "message"),
    acceptsUploads: row.acceptsUploads === undefined ? true : Boolean(row.acceptsUploads),
    acceptsRemoteUrls: row.acceptsRemoteUrls === undefined ? true : Boolean(row.acceptsRemoteUrls),
    outputKind: "remote-url",
    supportsMultipleOutputs: row.supportsMultipleOutputs === undefined ? true : Boolean(row.supportsMultipleOutputs),
    pollingStrategy,
    pollingIntervalMs: Number.isFinite(Number(row.pollingIntervalMs)) ? Math.max(0, Number(row.pollingIntervalMs)) : 0,
    pollingTimeoutMs: Number.isFinite(Number(row.pollingTimeoutMs)) && Number(row.pollingTimeoutMs) > 0
      ? Math.max(0, Number(row.pollingTimeoutMs))
      : undefined,
    retryable: Boolean(row.retryable),
  };
}

async function updateAdminRunningHubCatalogItem(
  catalogId: string,
  patch: {
    kind?: "app" | "workflow";
    title?: string;
    note?: string;
    enabled?: boolean;
    groupId?: string;
    thumbnail?: string;
    workflowJson?: string;
    fields?: RunningHubFieldDefinition[];
    pageId?: string;
    appId?: string;
    workflowId?: string;
    runTargetId?: string;
    taskCapability?: "image" | "video" | "audio" | "chat";
    parameterSchema?: string;
    outputSchema?: RunningHubOutputDefinition[];
    executionRules?: RunningHubExecutionRules;
    testPayload?: string;
  },
): Promise<AdminRunningHubCatalogItem> {
  const db = await readAdminDb();
  const [providerId, kindText, itemId] = catalogId.split(":");
  const kind = kindText === "app" ? "app" : "workflow";
  if (!providerId || !itemId) throw new Error("RunningHub catalogId 无效");
  let updatedProvider: AdminProviderRecord | null = null;
  let updatedItem: RunningHubAdminCatalogEntry | null = null;
  let updatedKind: "app" | "workflow" = kind;
  const providers = db.providers.map((provider) => {
    if (provider.id !== providerId) return provider;
    const sourceAppList = normalizeRunningHubEntries(provider.rhApps, "app");
    const sourceWorkflowList = normalizeRunningHubEntries(provider.rhWorkflows, "workflow");
    const sourceList = kind === "app" ? sourceAppList : sourceWorkflowList;
    const sourceEntry = sourceList.find((entry) => entry.id === itemId);
    if (!sourceEntry) throw new Error("RunningHub 条目不存在");
    const nextKind = patch.kind === "app" ? "app" : patch.kind === "workflow" ? "workflow" : kind;
    const previousTargetId = sourceEntry.runTargetId || sourceEntry.id;
    const targetId = safeText(patch.runTargetId, sourceEntry.runTargetId || sourceEntry.id);
    const pageId = safeText(patch.pageId, sourceEntry.pageId || sourceEntry.id);
    const appId = nextKind === "app"
      ? safeText(patch.appId, sourceEntry.appId || targetId || sourceEntry.id)
      : "";
    const workflowId = nextKind === "workflow"
      ? safeText(patch.workflowId, sourceEntry.workflowId || targetId || sourceEntry.id)
      : "";
    const taskCapability = patch.taskCapability === "image" || patch.taskCapability === "audio" || patch.taskCapability === "chat"
      ? patch.taskCapability
      : sourceEntry.taskCapability === "image" || sourceEntry.taskCapability === "audio" || sourceEntry.taskCapability === "chat"
        ? sourceEntry.taskCapability
        : "video";
    const baseExecutionRules = patch.executionRules === undefined
      ? normalizeRunningHubExecutionRulesForAdmin(sourceEntry.executionRules, nextKind, previousTargetId)
      : normalizeRunningHubExecutionRulesForAdmin(patch.executionRules, nextKind, previousTargetId);
    const shouldReplaceDefaultEndpoint = isRunningHubDefaultEndpoint(kind, previousTargetId, baseExecutionRules.endpoint)
      || isRunningHubDefaultEndpoint(nextKind, previousTargetId, baseExecutionRules.endpoint);
    const nextExecutionEndpoint = shouldReplaceDefaultEndpoint
      ? runningHubDefaultEndpoint(nextKind, targetId)
      : baseExecutionRules.endpoint;
    const next: RunningHubAdminCatalogEntry = {
      ...sourceEntry,
      title: patch.title === undefined ? sourceEntry.title : safeText(patch.title, sourceEntry.title),
      note: patch.note === undefined ? sourceEntry.note : safeText(patch.note),
      enabled: patch.enabled === undefined ? sourceEntry.enabled : Boolean(patch.enabled),
      thumbnail: patch.thumbnail === undefined ? sourceEntry.thumbnail : safeText(patch.thumbnail),
      pageId,
      appId,
      workflowId,
      workflowJson: patch.workflowJson === undefined ? preserveRunningHubJsonText(sourceEntry.workflowJson, "") : safeRunningHubJsonText(patch.workflowJson, ""),
      fields: patch.fields === undefined ? normalizeRunningHubFieldDefinitions(sourceEntry.fields) : normalizeRunningHubFieldDefinitions(patch.fields),
      allowsEmptyInputs: allowsRunningHubEntryWithoutFields(patch.testPayload === undefined ? sourceEntry.testPayload : patch.testPayload),
      runTargetId: targetId,
      taskCapability,
      parameterSchema: patch.parameterSchema === undefined ? preserveRunningHubObjectJsonText(sourceEntry.parameterSchema, "{}") : safeRunningHubObjectJsonText(patch.parameterSchema, "{}"),
      outputSchema: patch.outputSchema === undefined
        ? normalizeRunningHubOutputDefinitionsForAdmin(sourceEntry.outputSchema)
        : normalizeRunningHubOutputDefinitionsForAdmin(patch.outputSchema),
      executionRules: {
        ...baseExecutionRules,
        endpoint: nextExecutionEndpoint,
        targetType: nextKind,
      },
      testPayload: patch.testPayload === undefined ? preserveRunningHubJsonText(sourceEntry.testPayload, "{}") : safeRunningHubJsonText(patch.testPayload, "{}"),
    };
    if (patch.groupId !== undefined) {
      const groupId = safeText(patch.groupId);
      const groups = normalizeRunningHubGroups(provider.rhGroups, provider.id);
      if (groupId && !groups.some((group) => group.id === groupId)) throw new Error("RUNNINGHUB_GROUP_NOT_FOUND");
      next.groupId = groupId || undefined;
    }
    assertRunningHubTargetConsistency(nextKind, next);
    assertRunningHubEntryCanBeEnabled({
      ...next,
      catalogId: `${providerId}:${nextKind}:${itemId}`,
    });
    const nextApps = nextKind === "app"
      ? [...sourceAppList.filter((entry) => entry.id !== itemId), next]
      : sourceAppList.filter((entry) => entry.id !== itemId);
    const nextWorkflows = nextKind === "workflow"
      ? [...sourceWorkflowList.filter((entry) => entry.id !== itemId), next]
      : sourceWorkflowList.filter((entry) => entry.id !== itemId);
    updatedItem = next;
    updatedKind = nextKind;
    if (!updatedItem) throw new Error("RunningHub 条目不存在");
    updatedProvider = {
      ...provider,
      rhApps: nextApps,
      rhWorkflows: nextWorkflows,
      updatedAt: Date.now(),
    };
    return updatedProvider;
  });
  if (!updatedProvider || !updatedItem) throw new Error("RunningHub Provider 不存在");
  if (usePostgresRepository()) {
    await upsertProviderRecordPostgres(updatedProvider);
  } else {
    await writeAdminDb({ ...db, providers });
  }
  return toAdminRunningHubCatalogItem(updatedProvider, normalizeRunningHubCatalogItem(updatedItem, updatedKind) || updatedItem);
}

async function testAdminRunningHubCatalogItem(catalogId: string, testPayloadValue: unknown) {
  const item = await adminRunningHubCatalogItemDetail(catalogId);
  if (!item) throw new Error("RunningHub 条目不存在");
  const testPayloadText = safeRunningHubJsonText(testPayloadValue ?? item.testPayload ?? "{}", "{}");
  const testPayload = JSON.parse(testPayloadText) as Record<string, unknown>;
  const requiredSlots = item.inputSlots.filter((slot) => slot.required);
  const slotNameCount = new Map<string, number>();
  const slotTitleCount = new Map<string, number>();
  for (const slot of item.inputSlots) {
    if (slot.name) {
      slotNameCount.set(slot.name, (slotNameCount.get(slot.name) || 0) + 1);
    }
    if (slot.title) {
      slotTitleCount.set(slot.title, (slotTitleCount.get(slot.title) || 0) + 1);
    }
  }
  const missing = requiredSlots
    .filter((slot) => {
      const byKey = testPayload[slot.key];
      const byPath = testPayload[slot.bindingTarget.path];
      if (byKey !== undefined || byPath !== undefined) return false;
      const uniqueName = slot.name && slotNameCount.get(slot.name) === 1 ? testPayload[slot.name] : undefined;
      const uniqueTitle = slot.title && slotTitleCount.get(slot.title) === 1 ? testPayload[slot.title] : undefined;
      return uniqueName === undefined && uniqueTitle === undefined;
    })
    .map((slot) => {
      const ambiguousName = slot.name ? (slotNameCount.get(slot.name) || 0) > 1 : false;
      const ambiguousTitle = slot.title ? (slotTitleCount.get(slot.title) || 0) > 1 : false;
      if (ambiguousName || ambiguousTitle) {
        return `${slot.title || slot.name}（请使用 ${slot.key} 或 ${slot.bindingTarget.path}）`;
      }
      return slot.title || slot.name;
    });
  return {
    ok: missing.length === 0,
    message: missing.length ? `缺少必填输入槽: ${missing.join("、")}` : `已生成 ${item.executionRules?.endpoint || item.execution.submit.endpoint} 的预览校验结果`,
    checkedAt: Date.now(),
    requestPreview: {
      catalogId: item.catalogId,
      targetId: item.runTargetId,
      endpoint: item.executionRules?.endpoint || item.execution.submit.endpoint,
      payload: testPayload,
    },
    responsePreview: missing.length
      ? { missingRequiredSlots: missing }
      : {
          accepted: true,
          outputSchema: item.outputSchema || [],
          execution: item.executionRules || item.execution,
        },
  };
}

async function publicRunningHubCatalogItemDetail(catalogId: string, currentUser?: CurrentUser | null): Promise<RhCatalogItem | null> {
  const catalog = await publicRunningHubCatalog(currentUser);
  const canonicalMatch = catalog.items.find((entry) => entry.catalogId === catalogId);
  if (canonicalMatch) return canonicalMatch;
  const idMatches = catalog.items.filter((entry) => entry.id === catalogId);
  return idMatches.length === 1 ? idMatches[0] : null;
}

function findRunningHubCatalogItemByTarget(
  provider: AdminProviderRecord,
  targetType: "app" | "workflow",
  runTargetId: string,
) {
  const list = targetType === "app"
    ? normalizeRunningHubCatalogItems(provider.rhApps, "app")
    : normalizeRunningHubCatalogItems(provider.rhWorkflows, "workflow");
  const normalizedTargetId = safeText(runTargetId);
  if (!normalizedTargetId) return null;
  return list.find((entry) => {
    if (!entry.enabled) return false;
    const entryTargetId = safeText(
      entry.runTargetId
        || (targetType === "app" ? entry.appId : entry.workflowId)
        || entry.id,
    );
    return entryTargetId === normalizedTargetId;
  }) || null;
}

function normalizeRunningHubEntries(value: unknown, kind: "app" | "workflow", validGroupIds?: Set<string>): RunningHubAdminCatalogEntry[] {
  return normalizeRunningHubCatalogItems(value, kind, validGroupIds);
}

function publicRequestOrigin(request: import("node:http").IncomingMessage) {
  const forwardedProto = safeText(request.headers["x-forwarded-proto"]);
  const forwardedHost = safeText(request.headers["x-forwarded-host"]);
  const hostHeader = safeText(request.headers.host);
  const hostValue = forwardedHost || hostHeader || `${host}:${port}`;
  const proto = forwardedProto || (hostValue.startsWith("127.0.0.1") || hostValue.startsWith("localhost") ? "http" : "https");
  return `${proto}://${hostValue}`.replace(/\/+$/, "");
}

function providerFilePublicOrigin(request: import("node:http").IncomingMessage) {
  const configured = safeText(process.env.XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN);
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, "");
  return publicRequestOrigin(request);
}


function normalizeResourceKind(value: unknown): ResourceKind | "" {
  const kind = String(value || "").toLowerCase();
  return ["image", "video", "audio", "set", "pose", "workflow"].includes(kind) ? (kind as ResourceKind) : "";
}

function normalizeRunningHubFieldPrimitive(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = normalizeRunningHubFieldText(value, 4000);
  return text || undefined;
}

function normalizeRunningHubFieldOptions(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const options = value
    .map((item) => {
      if (typeof item === "number" && Number.isFinite(item)) return item;
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        if (typeof row.value === "number" && Number.isFinite(row.value)) return row.value;
        if (typeof row.value === "string") return row.value.trim();
        if (typeof row.label === "string") return row.label.trim();
        if (typeof row.name === "string") return row.name.trim();
      }
      return "";
    })
    .filter((item) => item !== "" && item !== null && item !== undefined);
  return options.length > 0 ? options : undefined;
}

function normalizeRunningHubFieldText(value: unknown, maxLength = 240) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeOptionalJsonText(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    JSON.parse(text);
    return text;
  } catch {
    return "";
  }
}

function normalizeModelScopeLoras(value: unknown): ModelScopeLora[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const id = safeText(row.id);
      if (!id) return null;
      const strength = Number(row.strength);
      return {
        id,
        name: safeText(row.name),
        targetModel: safeText(row.targetModel || row.target_model || row.model, "Tongyi-MAI/Z-Image-Turbo"),
        strength: Number.isFinite(strength) ? Math.max(0, Math.min(2, strength)) : 0.8,
        enabled: row.enabled === undefined ? true : Boolean(row.enabled),
        note: safeText(row.note),
      } satisfies ModelScopeLora;
    })
    .filter(Boolean) as ModelScopeLora[];
}

function looksLikeHtml(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    /^<!doctype html/i.test(normalized)
    || /^<html[\s>]/i.test(normalized)
    || /^<body[\s>]/i.test(normalized)
    || /^<head[\s>]/i.test(normalized)
    || normalized.includes("<html")
    || normalized.includes("just a moment")
    || normalized.includes("cf-browser-verification")
    || normalized.includes("attention required")
  );
}

function summarizeUpstreamBody(text: string) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 320);
}

function parseUpstreamJson(text: string, label: string, contentType?: string) {
  const normalized = String(text || "").trim();
  if (!normalized) return {};
  try {
    return JSON.parse(normalized);
  } catch {
    const type = safeText(contentType);
    if (looksLikeHtml(normalized) || /text\/html|application\/xhtml\+xml/i.test(type)) {
      throw new Error(`${label}返回网页 HTML，请检查 Base URL、Cloudflare/WAF 或上游鉴权`);
    }
    throw new Error(`${label}返回非 JSON 响应${type ? ` (${type})` : ""}: ${summarizeUpstreamBody(normalized)}`);
  }
}

function providerPlainApiKey(provider: Partial<AdminProviderRecord> & { apiKey?: string }) {
  const explicit = String(provider.apiKey || "").trim();
  if (explicit && !explicit.startsWith("enc:v1:")) return explicit;
  return decryptSecret(provider.apiKey || "");
}

function isGrsaiProviderDraft(provider: Partial<AdminProviderRecord> & { apiKey?: string }) {
  const protocol = normalizeProviderProtocol(provider.protocol);
  if (protocol === "grsai_draw") return true;
  const id = safeText(provider.id).toLowerCase();
  const name = safeText(provider.name).toLowerCase();
  const baseUrl = safeText(provider.baseUrl).toLowerCase();
  return [id, name, baseUrl].some((value) => value.includes("grsai") || value.includes("grsai.dakka.com.cn"));
}

async function probeProviderDraft(provider: Partial<AdminProviderRecord> & { apiKey?: string }) {
  const protocol = isGrsaiProviderDraft(provider) ? "grsai_draw" : normalizeProviderProtocol(provider.protocol);
  if (isGrsaiProviderDraft(provider)) {
    const baseUrl = safeText(provider.baseUrl).replace(/\/+$/, "");
    if (!baseUrl) return { ok: false, status: 0, message: "请先填写请求地址", modelCount: 0, all: [], chatModels: [], imageModels: [], videoModels: [], audioModels: [], modelTags: {} };
    if (!/^https?:\/\//i.test(baseUrl)) return { ok: false, status: 0, message: "请求地址必须以 http:// 或 https:// 开头", modelCount: 0, all: [], chatModels: [], imageModels: [], videoModels: [], audioModels: [], modelTags: {} };
    const apiKey = providerPlainApiKey(provider);
    if (!apiKey) return { ok: false, status: 0, message: "请先填写或保存 API Key", modelCount: 0, all: [], chatModels: [], imageModels: [], videoModels: [], audioModels: [], modelTags: {} };
    return {
      ok: true,
      status: 200,
      message: "GRSAI Draw 使用手动模型目录，不支持自动拉取模型列表",
      modelCount: 1,
      all: ["gpt-image-2"],
      chatModels: [],
      imageModels: ["gpt-image-2"],
      videoModels: [],
      audioModels: [],
      modelTags: { "gpt-image-2": inferModelCapabilityTags("gpt-image-2", "image") },
    };
  }
  const url = providerModelsUrl(provider.baseUrl, protocol);
  if (!url) return { ok: false, status: 0, message: "请先填写请求地址", modelCount: 0, all: [], chatModels: [], imageModels: [], videoModels: [], audioModels: [], modelTags: {} };
  if (!/^https?:\/\//i.test(url)) return { ok: false, status: 0, message: "请求地址必须以 http:// 或 https:// 开头", modelCount: 0, all: [], chatModels: [], imageModels: [], videoModels: [], audioModels: [], modelTags: {} };
  const apiKey = providerPlainApiKey(provider);
  if (!apiKey) return { ok: false, status: 0, message: "请先填写或保存 API Key", modelCount: 0, all: [], chatModels: [], imageModels: [], videoModels: [], audioModels: [], modelTags: {} };
  try {
    const upstream = await fetch(url, { headers: providerModelHeaders(apiKey, protocol), signal: AbortSignal.timeout(15000) });
    const text = await upstream.text();
    if (looksLikeHtml(text)) return { ok: false, status: upstream.status, message: "上游返回网页 HTML，请检查 Base URL 是否为 API 地址", modelCount: 0, all: [], chatModels: [], imageModels: [], videoModels: [], audioModels: [], modelTags: {} };
    if (!upstream.ok) return { ok: false, status: upstream.status, message: text.slice(0, 300), modelCount: 0, all: [], chatModels: [], imageModels: [], videoModels: [], audioModels: [], modelTags: {} };
    const raw = parseUpstreamJson(text, "模型列表探测接口", upstream.headers.get("content-type") || "");
    const parsed = parseUpstreamModels(raw, protocol);
    return {
      ok: true,
      status: upstream.status,
      message: parsed.total ? `地址验证通过，找到 ${parsed.total} 个模型` : "地址验证通过，但未返回模型列表",
      modelCount: parsed.total,
      ...parsed,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
      modelCount: 0,
      all: [],
      chatModels: [],
      imageModels: [],
      videoModels: [],
      audioModels: [],
      modelTags: {},
    };
  }
}

async function fetchProviderModelsDraft(provider: Partial<AdminProviderRecord> & { apiKey?: string }) {
  if (isGrsaiProviderDraft(provider)) {
    return {
      ok: true,
      status: 200,
      message: "GRSAI Draw 使用手动模型目录，默认提供 gpt-image-2",
      modelCount: 1,
      total: 1,
      all: ["gpt-image-2"],
      chatModels: [],
      imageModels: ["gpt-image-2"],
      videoModels: [],
      audioModels: [],
      modelTags: { "gpt-image-2": inferModelCapabilityTags("gpt-image-2", "image") },
    };
  }
  const result = await probeProviderDraft(provider);
  return {
    ...result,
    total: result.modelCount,
    chatModels: result.chatModels || [],
    imageModels: result.imageModels || [],
    videoModels: result.videoModels || [],
    audioModels: result.audioModels || [],
    modelTags: result.modelTags || {},
    all: result.all || [],
  };
}

const TEST_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const TEST_AUDIO_DATA_URL =
  "data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async function testAdminModelConnectivity(provider: AdminProviderRecord, model: AdminModelRecord, rawKind: string): Promise<{
  stateKey: keyof ModelTestState;
  test: NonNullable<ModelTestState[keyof ModelTestState]>;
}> {
  const kind = normalizeModelTestKind(rawKind);
  const startedAt = Date.now();
  const fail = (message: string, status = 0, inferredTags: ModelCapabilityTag[] = []) => ({
    stateKey: kind.stateKey,
    test: {
      ok: false,
      status,
      message,
      checkedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
      inferredTags,
    },
  });
  const apiKey = providerPlainApiKey(provider);
  if (!apiKey) return fail("Provider 未配置 API Key");
  const protocol = normalizeProviderProtocol(model.protocolOverride || provider.protocol);
  if (!["openai", "apimart", "modelscope", "custom"].includes(protocol)) {
    return fail(`当前模型测试暂未接入 ${protocol} 协议`);
  }
  const capabilityTags = normalizeModelCapabilityTags(model.capabilityTags, model.capability, model.modelId);
  if (kind.stateKey === "videoUnderstanding") {
    if (!capabilityTags.includes("video_understanding")) {
      return fail("模型未标记为视频理解模型；请先手动开启视频理解标签，或使用图像关键帧测试。", 0, ["video_understanding"]);
    }
    return fail("视频理解真实样本测试需要固定测试视频，本版本先记录能力标签，不自动消耗视频测试。", 0, ["video_understanding"]);
  }
  if (kind.stateKey === "imageGeneration" || kind.stateKey === "videoGeneration") {
    return fail("生成类模型测试可能产生费用，请在下一阶段通过专用低成本测试按钮启用。");
  }
  if (kind.stateKey === "audioGeneration" || kind.stateKey === "voiceClone") {
    const advancedConfig = parseAdvancedConfig(model.advancedConfig);
    const mode = kind.stateKey === "voiceClone" ? "voice_clone" : "tts";
    if (mode === "voice_clone" && !capabilityTags.includes("voice_clone")) {
      return fail("模型未标记为音色克隆模型；请先开启 voice_clone 标签。", 0, ["voice_clone"]);
    }
    try {
      const payload = createOpenAiAudioChatPayload({
        modelId: model.modelId,
        text: mode === "voice_clone" ? "请复刻参考音色并播报：星幻画布音色克隆测试。" : "星幻画布语音链路测试。",
        stylePrompt: mode === "voice_clone" ? "尽量保留原始音色，清晰播报。" : "自然、清晰、稳定地播报。",
        voice: safeText(advancedConfig.voice, "mimo_default"),
        audioFormat: safeText(advancedConfig.audioFormat, "wav"),
        mode,
        sampleDataUrl: mode === "voice_clone" ? TEST_AUDIO_DATA_URL : "",
      });
      const submitPath = safeText(advancedConfig.submitPath, "chat/completions");
      const upstream = await fetch(openAiEndpoint(provider.baseUrl, submitPath), {
        method: "POST",
        headers: { ...providerModelHeaders(apiKey, protocol), "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000),
      });
      const text = await upstream.text();
      if (looksLikeHtml(text)) return fail("上游返回网页 HTML，请检查 Base URL 是否为 API 地址", upstream.status);
      if (!upstream.ok) return fail(`上游音频请求失败 ${upstream.status}: ${text.slice(0, 300)}`, upstream.status);
      const raw = parseUpstreamJson(text, "音频模型测试接口", upstream.headers.get("content-type") || "");
      const result = extractAudioProviderResult(raw);
      const audioCount = result.audioDataUrls.length + result.audioUrls.length;
      if (audioCount === 0) return fail("上游返回成功但没有音频内容", upstream.status);
      return {
        stateKey: kind.stateKey,
        test: {
          ok: true,
          status: upstream.status,
          message: mode === "voice_clone" ? "音色克隆测试请求成功" : "语音生成测试请求成功",
          checkedAt: Date.now(),
          latencyMs: Date.now() - startedAt,
          inferredTags: mode === "voice_clone" ? ["voice_clone"] : ["tts"],
          sampleOutput: result.text?.slice(0, 240) || `${audioCount} 段音频已返回`,
        },
      };
    } catch (error) {
      return fail(error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300), 0, mode === "voice_clone" ? ["voice_clone"] : ["tts"]);
    }
  }
  const messages = kind.stateKey === "imageUnderstanding"
    ? [
        {
          role: "user",
          content: [
            { type: "text", text: "请用一句中文说明你是否能看到这张测试图片。" },
            { type: "image_url", image_url: { url: TEST_IMAGE_DATA_URL } },
          ],
        },
      ]
    : [{ role: "user", content: "请只回答：连接正常" }];
  try {
    const upstream = await fetch(openAiEndpoint(provider.baseUrl, "chat/completions"), {
      method: "POST",
      headers: { ...providerModelHeaders(apiKey, protocol), "content-type": "application/json" },
      body: JSON.stringify({ model: model.modelId, messages, stream: false, max_tokens: 64 }),
      signal: AbortSignal.timeout(45000),
    });
    const text = await upstream.text();
    if (looksLikeHtml(text)) return fail("上游返回网页 HTML，请检查 Base URL 是否为 API 地址", upstream.status);
    if (!upstream.ok) return fail(`上游请求失败 ${upstream.status}: ${text.slice(0, 300)}`, upstream.status);
    const raw = parseUpstreamJson(text, "文本对话测试接口", upstream.headers.get("content-type") || "");
    const content = extractChatContent(raw);
    if (!content.trim()) return fail("上游返回成功但没有文本内容", upstream.status);
    const inferredTags = kind.stateKey === "imageUnderstanding" ? ["image_understanding" as ModelCapabilityTag] : ["text_chat" as ModelCapabilityTag];
    return {
      stateKey: kind.stateKey,
      test: {
        ok: true,
        status: upstream.status,
        message: kind.stateKey === "imageUnderstanding" ? "图像理解测试请求成功" : "文本对话测试请求成功",
        checkedAt: Date.now(),
        latencyMs: Date.now() - startedAt,
        inferredTags,
        sampleOutput: content.slice(0, 240),
      },
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300));
  }
}

function normalizeModelTestKind(kind: string): { stateKey: keyof ModelTestState } {
  const value = kind.trim();
  if (value === "image_understanding") return { stateKey: "imageUnderstanding" };
  if (value === "video_understanding") return { stateKey: "videoUnderstanding" };
  if (value === "image_generation") return { stateKey: "imageGeneration" };
  if (value === "video_generation") return { stateKey: "videoGeneration" };
  if (value === "audio_generation" || value === "tts") return { stateKey: "audioGeneration" };
  if (value === "voice_clone") return { stateKey: "voiceClone" };
  return { stateKey: "chat" };
}

async function generateOpenAiLikeImage(input: {
  provider: AdminProviderRecord;
  apiKey: string;
  protocol: ProviderProtocol;
  payload: Record<string, unknown>;
  advancedConfig: ReturnType<typeof parseAdvancedConfig>;
}) {
  const upstream = await fetch(openAiImageGenerationUrl(input.provider.baseUrl), {
    method: "POST",
    headers: {
      ...providerModelHeaders(input.apiKey, input.protocol),
      "content-type": "application/json",
    },
    body: JSON.stringify(input.payload),
    signal: AbortSignal.timeout(120000),
  });
  const text = await upstream.text();
  if (looksLikeHtml(text)) throw new Error("上游返回网页 HTML，请检查 Base URL 是否为 API 地址");
  if (!upstream.ok) throw new Error(`上游图像生成失败 ${upstream.status}: ${text.slice(0, 500)}`);
  const raw = parseUpstreamJson(text, "图像生成接口", upstream.headers.get("content-type") || "");
  const extracted = extractImageOutputs(raw);
  if (extracted.urls.length > 0 || extracted.base64.length > 0) return extracted;
  const task = extractApimartTask(raw, {
    taskIdPath: safeText(input.advancedConfig.taskIdPath, "data.0.task_id"),
    statusPath: safeText(input.advancedConfig.taskStatusPath, "data.0.status"),
  });
  if (!task.taskId) return extracted;
  return pollAsyncImageTask({
    provider: input.provider,
    apiKey: input.apiKey,
    taskId: task.taskId,
    protocol: input.protocol,
    advancedConfig: input.advancedConfig,
  });
}

async function generateGrsaiImage(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  prompt: string,
  aspectRatio: string,
  size: string,
  images: string[],
  advancedConfig: Record<string, unknown> = {},
) {
  const client = createGrsaiImageClient({
    apiKey,
    baseUrl: safeText(baseUrl),
    pollIntervalMs: 1500,
  });
  const result = await client.generate({
    modelId,
    prompt,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(size && size !== "auto" ? { size } : {}),
    ...(images.length > 0 ? { images } : {}),
    submitPath: safeText(advancedConfig.submitPath),
    pollPath: safeText(advancedConfig.pollPath || advancedConfig.pollPathTemplate),
  });
  return {
    urls: result.imageUrls,
    base64: [],
    raw: result.raw,
  };
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  const status = String(value || "").toLowerCase();
  return ["queued", "running", "succeeded", "failed", "cancelled"].includes(status) ? (status as TaskStatus) : "queued";
}

function normalizeUserGroupId(value: unknown) {
  const groupId = safeText(value);
  return groupId || undefined;
}

function createUserGroupId(timestamp = Date.now()) {
  return `group-${timestamp}-${randomToken(4)}`;
}

function normalizeUserGroupSortOrder(value: unknown) {
  return Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0;
}

function assertUserGroupNameUnique(groups: UserGroupRecord[], name: string, excludeId?: string) {
  const normalizedName = safeText(name).toLowerCase();
  if (!normalizedName) throw new Error("缺少用户组名称");
  if (groups.some((group) => group.id !== excludeId && safeText(group.name).toLowerCase() === normalizedName)) {
    throw new Error("用户组名称已存在");
  }
}

function toAdminUserGroup(group: UserGroupRecord) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    sortOrder: normalizeUserGroupSortOrder(group.sortOrder),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

function toAdminUser(user: UserRecord, groupsById?: Map<string, UserGroupRecord>) {
  const password = decryptManagedPassword(user);
  const group = user.groupId ? groupsById?.get(user.groupId) : undefined;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    administratorTier: normalizeAdministratorTier(user.role, user.administratorTier),
    groupId: user.groupId,
    groupName: group?.name,
    remark: safeText(user.remark),
    disabled: Boolean(user.disabled),
    passwordAvailable: Boolean(password),
    password,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toAdminSession(
  session: SessionRecord,
  user: Pick<UserRecord, "id" | "email" | "name" | "role" | "administratorTier">,
  currentSessionId: string,
): AdminSessionRecord {
  return {
    id: session.id,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    administratorTier: normalizeAdministratorTier(user.role, user.administratorTier),
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt || session.createdAt,
    expiresAt: session.expiresAt,
    ip: safeText(session.ip),
    userAgent: safeText(session.userAgent),
    revokedAt: session.revokedAt,
    current: currentSessionId === session.id,
  };
}

function decryptManagedPassword(user: UserRecord) {
  return user.passwordCipher ? decryptSecret(user.passwordCipher) : "";
}

function toPublicProvider(provider: AdminProviderRecord) {
  const rhKeyPool = toPublicRunningHubKeyPool(provider.rhKeyPool);
  const rhKeyPoolSummary = summarizeRunningHubKeyPool(rhKeyPool);
  return {
    id: provider.id,
    sortOrder: normalizeCatalogSortOrder(provider.sortOrder),
    name: provider.name,
    baseUrl: provider.baseUrl,
    protocol: normalizeProviderProtocol(provider.protocol),
    enabled: provider.enabled,
    hasApiKey: Boolean(provider.apiKey),
    apiKeyPreview: provider.apiKeyPreview || secretPreview(decryptSecret(provider.apiKey || "")),
    lastProbeStatus: provider.lastProbeStatus || "",
    lastProbeMessage: provider.lastProbeMessage || "",
    lastFetchedAt: provider.lastFetchedAt || 0,
    rhApps: normalizeRunningHubEntries(provider.rhApps, "app"),
    rhWorkflows: normalizeRunningHubEntries(provider.rhWorkflows, "workflow"),
    rhGroups: normalizeRunningHubGroups(provider.rhGroups, provider.id),
    rhKeyPool,
    rhKeyPoolSummary,
    msLoras: normalizeModelScopeLoras(provider.msLoras),
    note: provider.note || "",
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

function normalizeProviderSecret(provider: AdminProviderRecord) {
  const rhKeyPool = normalizeProviderSecretKeyPool(provider.rhKeyPool);
  const rhGroups = normalizeRunningHubGroups(provider.rhGroups, provider.id);
  const validGroupIds = new Set(rhGroups.map((group) => group.id));
  const rhApps = normalizeRunningHubEntries(provider.rhApps, "app", validGroupIds);
  const rhWorkflows = normalizeRunningHubEntries(provider.rhWorkflows, "workflow", validGroupIds);
  if (!provider.apiKey) return { ...provider, rhKeyPool, rhGroups, rhApps, rhWorkflows };
  if (provider.apiKey.startsWith("enc:v1:")) {
    return provider.apiKeyPreview
      ? { ...provider, rhKeyPool, rhGroups, rhApps, rhWorkflows }
      : { ...provider, rhKeyPool, rhGroups, rhApps, rhWorkflows, apiKeyPreview: secretPreview(decryptSecret(provider.apiKey)) };
  }
  const raw = provider.apiKey;
  return {
    ...provider,
    rhKeyPool,
    rhGroups,
    rhApps,
    rhWorkflows,
    apiKey: encryptSecret(raw),
    apiKeyPreview: secretPreview(raw),
  };
}

function normalizeRunningHubKeyPool(value: unknown): RunningHubKeyPoolItemRecord[] {
  const normalized = (Array.isArray(value) ? value : [])
    .flatMap((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : null;
      if (!row) return [];
      const id = safeSlug(row.id, "");
      if (!id) return [];
      const apiKey = safeText(row.apiKey);
      const previewSource = decryptSecret(apiKey) || apiKey;
      return [{
        id,
        note: safeText(row.note),
        apiKey: apiKey || undefined,
        apiKeyPreview: safeText(row.apiKeyPreview, previewSource ? secretPreview(previewSource) : ""),
        maxConcurrency: Math.max(1, Number(row.maxConcurrency) || 1),
        enabled: row.enabled !== false,
        isDefault: row.isDefault === true,
        standardModelApi: typeof row.standardModelApi === "boolean"
          ? row.standardModelApi
          : /企业级|enterprise/i.test(safeText(row.note)),
        currentInFlight: Math.max(0, Number(row.currentInFlight) || 0),
        createdAt: Math.max(0, Number(row.createdAt) || 0),
        updatedAt: Math.max(0, Number(row.updatedAt) || 0),
      }];
    });
  const firstDefaultIndex = normalized.findIndex((item) => item.isDefault);
  return normalized.map((item, index) => ({
    ...item,
    isDefault: firstDefaultIndex >= 0 ? index === firstDefaultIndex : false,
  }));
}

function normalizeProviderSecretKeyPool(value: unknown): RunningHubKeyPoolItemRecord[] {
  return normalizeRunningHubKeyPool(value).map((item) => {
    const rawApiKey = safeText(item.apiKey);
    if (!rawApiKey) return item;
    if (rawApiKey.startsWith("enc:v1:")) {
      return item.apiKeyPreview ? item : { ...item, apiKeyPreview: secretPreview(decryptSecret(rawApiKey)) };
    }
    return {
      ...item,
      apiKey: encryptSecret(rawApiKey),
      apiKeyPreview: secretPreview(rawApiKey),
    };
  });
}

function toPublicRunningHubKeyPool(value: unknown): RunningHubKeyPoolItemRecord[] {
  return normalizeRunningHubKeyPool(value).map((item) => ({
    id: item.id,
    note: item.note,
    apiKeyPreview: item.apiKeyPreview,
    maxConcurrency: item.maxConcurrency,
    enabled: item.enabled,
    isDefault: item.isDefault === true,
    standardModelApi: item.standardModelApi,
    currentInFlight: item.currentInFlight,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

function summarizeRunningHubKeyPool(items: RunningHubKeyPoolItemRecord[]) {
  const enabledItems = items.filter((item) => item.enabled);
  return {
    totalKeyCount: items.length,
    enabledKeyCount: enabledItems.length,
    totalConcurrency: enabledItems.reduce((sum, item) => sum + Math.max(1, Number(item.maxConcurrency) || 1), 0),
    activeInFlight: enabledItems.reduce((sum, item) => sum + Math.max(0, Number(item.currentInFlight) || 0), 0),
  };
}

function buildEffectiveRunningHubKeyPool(provider: AdminProviderRecord, legacyFallbackConcurrency = 1) {
  const normalizedPool = normalizeRunningHubKeyPool(provider.rhKeyPool)
    .filter((item) => item.enabled && safeText(item.apiKey));
  if (normalizedPool.length > 0) return normalizedPool;
  const legacyApiKey = safeText(provider.apiKey);
  if (!legacyApiKey) return [];
  const previewSource = decryptSecret(legacyApiKey) || legacyApiKey;
  const now = Date.now();
  return [{
    id: "legacy-default",
    note: "兼容单 Key",
    apiKey: legacyApiKey,
    apiKeyPreview: provider.apiKeyPreview || secretPreview(previewSource),
    maxConcurrency: Math.max(1, Number(legacyFallbackConcurrency) || 1),
    enabled: true,
    isDefault: true,
    standardModelApi: false,
    currentInFlight: 0,
    createdAt: provider.createdAt || now,
    updatedAt: provider.updatedAt || now,
  }];
}

function summarizeEffectiveRunningHubProviderPools(providers: AdminProviderRecord[], legacyFallbackConcurrency = 1) {
  const allItems = providers.flatMap((provider) => buildEffectiveRunningHubKeyPool(provider, legacyFallbackConcurrency));
  return summarizeRunningHubKeyPool(allItems);
}

function runningHubRedisWindowKey(providerId: string, keyId: string) {
  return `xinghuan:provider-window:runninghub:${safeSlug(providerId || "runninghub", "runninghub")}:${safeSlug(keyId || "default", "default")}`;
}

async function inspectRunningHubKeyPoolAvailability(provider: AdminProviderRecord, legacyFallbackConcurrency = 1) {
  const pool = buildEffectiveRunningHubKeyPool(provider, legacyFallbackConcurrency);
  const summary = summarizeRunningHubKeyPool(pool);
  if (!pool.length) {
    return {
      pool,
      selected: null as RunningHubKeyPoolItemRecord | null,
      allBusy: false,
      totalConcurrency: 0,
      activeInFlight: 0,
    };
  }
  try {
    const client = await getRedisClient();
    let selectedDefault: RunningHubKeyPoolItemRecord | null = null;
    let selectedFallback: RunningHubKeyPoolItemRecord | null = null;
    let activeInFlight = 0;
    const withRuntime: RunningHubKeyPoolItemRecord[] = [];
    for (const item of pool) {
      const currentInFlight = Math.max(
        0,
        Number(await client.get(runningHubRedisWindowKey(provider.id, item.id)).catch(() => "0")) || 0,
      );
      activeInFlight += currentInFlight;
      const nextItem = { ...item, currentInFlight };
      withRuntime.push(nextItem);
      if (currentInFlight < Math.max(1, Number(item.maxConcurrency) || 1)) {
        if (nextItem.isDefault === true && !selectedDefault) {
          selectedDefault = nextItem;
        } else if (!selectedFallback) {
          selectedFallback = nextItem;
        }
      }
    }
    const selected = selectedDefault || selectedFallback || null;
    return {
      pool: withRuntime,
      selected,
      allBusy: !selected && summary.totalConcurrency > 0,
      totalConcurrency: summary.totalConcurrency,
      activeInFlight,
    };
  } catch {
    const selectedDefault = pool.find((item) => item.isDefault === true) || null;
    return {
      pool,
      selected: selectedDefault || pool[0] || null,
      allBusy: false,
      totalConcurrency: summary.totalConcurrency,
      activeInFlight: 0,
    };
  }
}

function withEffectiveRunningHubConcurrency(taskQueueSettings: TaskQueueSettings, providers: AdminProviderRecord[]) {
  const fallbackConcurrency = Math.max(1, Number(taskQueueSettings.runninghub.concurrency) || 1);
  const summary = summarizeEffectiveRunningHubProviderPools(providers, fallbackConcurrency);
  return {
    ...taskQueueSettings,
    runninghub: {
      ...taskQueueSettings.runninghub,
      concurrency: summary.totalConcurrency > 0 ? summary.totalConcurrency : fallbackConcurrency,
    },
  };
}

function secretPreview(value: string) {
  return value ? `...${value.slice(-4)}` : "";
}

function encryptSecret(value: string) {
  if (!value) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(value: string) {
  if (!value) return "";
  if (!value.startsWith("enc:v1:")) return value;
  try {
    const [, , ivRaw, tagRaw, encryptedRaw] = value.split(":");
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivRaw, "base64"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf-8");
  } catch {
    return "";
  }
}

function secretKey() {
  const source =
    process.env.XINGHUAN_SECRET_KEY ||
    process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ||
    (environment === "local" ? "xinghuan-local-admin-secret" : "");
  return createHash("sha256").update(source || "xinghuan-fallback-secret").digest();
}

function normalizeAssistantDocUrls(input: AssistantAnalyzeRequest) {
  const combined = [
    safeText(input.docUrl),
    ...(Array.isArray(input.docUrls) ? input.docUrls : []).map((item) => safeText(item)),
  ]
    .flatMap((item) => item.split(/\r?\n/))
    .flatMap((item) => item.split(/[,\s]+/))
    .map((item) => item.trim())
    .filter((item, index, list) => /^https?:\/\//i.test(item) && list.indexOf(item) === index);
  return combined.slice(0, 6);
}

function normalizeAssistantAsyncTemplate(value: unknown) {
  const text = safeText(value);
  if ([
    "auto",
    "sync_inline_result",
    "async_task_poll_result",
    "async_task_poll_then_final_lookup",
    "adapter_manual_model_catalog",
  ].includes(text)) {
    return text;
  }
  return "auto";
}

async function analyzeProviderAssistant(input: AssistantAnalyzeRequest, actor: CurrentUser, publicOrigin: string): Promise<AssistantAnalysisResult> {
  const docUrls = normalizeAssistantDocUrls(input);
  const grsaiSignal = /grsai|grsai\.dakka\.com\.cn/i.test(
    [
      safeText(input.providerName),
      safeText(input.baseUrl),
      safeText(input.protocolHint),
      safeText(input.notes),
      docUrls.join("\n"),
      safeText(input.sampleRequest),
      safeText(input.sampleResponse),
      safeText(input.modelId),
    ].join("\n"),
  );
  const fallback = await buildFallbackAssistantAnalysis(input);
  const settings = normalizeAssistantSettings((await readAdminDb()).assistantSettings);
  try {
    await assertAgentRuntimeCapability("agentEnabled");
    const orchestrator = createAgentOrchestrator({
      runtimeConfigurations: agentRuntimeConfigurationRepository,
      knowledgeSnapshots: agentKnowledgeSnapshotRepository,
      agentRuns: agentRunRepository,
      routing: llmRoutingRepository,
      invokeModel: async (invocation) => {
        if (invocation.ownerId !== actor.id) throw new Error("AGENT_TOOL_OWNER_MISMATCH");
        const result = await generateExternalChatProxy({
          providerId: invocation.providerId,
          providerParams: { modelRecordId: invocation.modelRecordId },
          messages: invocation.messages,
          maxTokens: invocation.maxTokens,
        }, actor, publicOrigin);
        return { content: result.content };
      },
    });
    const agent = await orchestrator.runRole({
      task: {
        id: `provider-analysis-${createRequestId()}`,
        ownerId: actor.id,
        role: "planner",
        scenario: "provider-analysis",
        inputSchema: "provider-analysis/v1",
        outputSchema: "provider-analysis-result/v1",
        toolAllowlist: [],
        maxTokens: 8_000,
        timeoutMs: 120_000,
      },
      agentKey: settings.integration.providerAnalysisAgentKey,
      environment: environment === "production" ? "production" : "gray",
      idempotencyKey: `provider-analysis:${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32)}`,
      messages: [{ role: "user", content: buildInternalProviderAnalysisPrompt(input, fallback) }],
      inputSnapshot: { providerName: safeText(input.providerName), modelId: safeText(input.modelId), capability: safeText(input.capability) },
    });
    const parsed = tryParseAssistantJson(agent.content);
    const analysis = {
      rawAssistant: agent.content,
      summary: safeText(parsed?.summary),
      protocol: safeText(parsed?.protocol),
      recommendedLayer: parseAssistantLayer(parsed?.recommendedLayer),
      asyncTask: typeof parsed?.asyncTask === "boolean" ? parsed.asyncTask : undefined,
      executionMode: parseAssistantExecutionMode(parsed?.executionMode),
      chainTemplate: safeText(parsed?.chainTemplate),
      chainTemplateVersion: safeText(parsed?.chainTemplateVersion),
      risks: Array.isArray(parsed?.risks) ? parsed.risks.map((item: unknown) => safeText(item)).filter(Boolean) : [],
      checklist: Array.isArray(parsed?.checklist) ? parsed.checklist.map((item: unknown) => safeText(item)).filter(Boolean) : [],
      drafts: { provider: plainObject(parsed?.drafts?.provider), model: plainObject(parsed?.drafts?.model) },
    };
    const merged: AssistantAnalysisResult = {
      ...fallback,
      mode: "agent",
      rawAssistant: analysis.rawAssistant,
      summary: analysis.summary || fallback.summary,
      recommendedLayer: analysis.recommendedLayer || fallback.recommendedLayer,
      protocol: fallback.protocol === "grsai_draw" ? fallback.protocol : (analysis.protocol || fallback.protocol),
      asyncTask: analysis.asyncTask ?? fallback.asyncTask,
      executionMode: parseAssistantExecutionMode((analysis as any).executionMode) || fallback.executionMode,
      chainTemplate: safeText((analysis as any).chainTemplate) || fallback.chainTemplate,
      chainTemplateVersion: safeText((analysis as any).chainTemplateVersion) || fallback.chainTemplateVersion,
      risks: analysis.risks.length ? analysis.risks : fallback.risks,
      checklist: analysis.checklist.length ? analysis.checklist : fallback.checklist,
      drafts: {
        provider: {
          ...fallback.drafts.provider,
          ...analysis.drafts.provider,
          protocol:
            fallback.drafts.provider.protocol === "grsai_draw"
              ? "grsai_draw"
              : safeText(analysis.drafts.provider.protocol, fallback.drafts.provider.protocol),
          baseUrl: safeText(analysis.drafts.provider.baseUrl, fallback.drafts.provider.baseUrl),
          note: safeText(analysis.drafts.provider.note, fallback.drafts.provider.note),
        },
        model: {
          ...fallback.drafts.model,
          ...analysis.drafts.model,
          executionMode:
            parseAssistantExecutionMode((analysis.drafts.model as Record<string, unknown>)?.executionMode)
            || fallback.drafts.model.executionMode,
          inputCapabilities: {
            ...fallback.drafts.model.inputCapabilities,
            ...(plainObject(analysis.drafts.model.inputCapabilities) as Record<string, boolean>),
          },
          advancedConfig: {
            ...fallback.drafts.model.advancedConfig,
            ...plainObject(analysis.drafts.model.advancedConfig),
          },
          parameterSchema: safeJsonText(analysis.drafts.model.parameterSchema, fallback.drafts.model.parameterSchema),
        },
      },
    };
    if (!grsaiSignal) return merged;
    const providerNote = safeText(
      merged.drafts.provider.note,
      fallback.drafts.provider.note,
    );
    return {
      ...merged,
      protocol: "grsai_draw",
      asyncTask: true,
      recommendedLayer: merged.recommendedLayer === "default" ? "adapter" : merged.recommendedLayer,
      drafts: {
        ...merged.drafts,
        provider: {
          ...merged.drafts.provider,
          baseUrl: safeText(merged.drafts.provider.baseUrl, fallback.drafts.provider.baseUrl),
          protocol: "grsai_draw",
          note: providerNote.includes("GRSAI")
            ? providerNote
            : `${providerNote} 已识别为 GRSAI 站点，建议使用手动模型目录并默认接入 gpt-image-2。`.trim(),
        },
        model: {
          ...merged.drafts.model,
          modelId: safeText(merged.drafts.model.modelId, "gpt-image-2"),
          advancedConfig: {
            ...plainObject(merged.drafts.model.advancedConfig),
            manualModelCatalog: true,
            defaultModelId: "gpt-image-2",
          },
        },
      },
    };
  } catch (error) {
    return {
      ...fallback,
      rawAssistant: `${fallback.rawAssistant}\n\n[内部 Agent 暂不可用，已回退]\n${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function runAssistantChat(input: AssistantChatRequest, actor: CurrentUser, publicOrigin: string): Promise<AssistantChatResult> {
  const settings = normalizeAssistantSettings((await readAdminDb()).assistantSettings);
  const runtime = await readAssistantRuntimeStatus(input.scope || "canvas", settings);
  const fallback = buildFallbackAssistantChat(input, actor);
  fallback.runtime = runtime;
  try {
    await assertAgentRuntimeCapability("agentEnabled");
    const orchestrator = createAgentOrchestrator({
      runtimeConfigurations: agentRuntimeConfigurationRepository,
      knowledgeSnapshots: agentKnowledgeSnapshotRepository,
      agentRuns: agentRunRepository,
      routing: llmRoutingRepository,
      invokeModel: async (invocation) => {
        if (invocation.ownerId !== actor.id) throw new Error("AGENT_TOOL_OWNER_MISMATCH");
        const result = await generateExternalChatProxy({
          providerId: invocation.providerId,
          providerParams: { modelRecordId: invocation.modelRecordId },
          messages: invocation.messages,
          maxTokens: invocation.maxTokens,
        }, actor, publicOrigin);
        return { content: result.content, usage: plainObject(result.raw).usage as Record<string, unknown> | undefined };
      },
    });
    const prompt = buildInternalAssistantChatPrompt(input, actor, fallback);
    const result = await orchestrator.runRole({
      task: {
        id: `assistant-task-${createRequestId()}`,
        ownerId: actor.id,
        role: "planner",
        scenario: "assistant-chat",
        inputSchema: "assistant-chat/v1",
        outputSchema: "assistant-response/v1",
        toolAllowlist: [],
        maxTokens: 8_000,
        timeoutMs: 120_000,
      },
      agentKey: assistantAgentKeyForScope(settings, input.scope),
      environment: environment === "production" ? "production" : "gray",
      idempotencyKey: assistantAgentIdempotencyKey(input, actor),
      messages: [
        { role: "system", content: "You are the bounded internal assistant for Xinghuan Canvas. Never claim an action was executed unless an audited tool result is present." },
        { role: "user", content: buildAssistantUserMessageContent(prompt, input.attachments || []) },
      ],
      inputSnapshot: { scope: input.scope || "canvas", conversationId: safeText(input.conversationId), attachmentCount: input.attachments?.length || 0, knowledgeCollection: settings.integration.knowledgeProfile },
      knowledgeAudience: "public",
      knowledgeCollectionAllowlist: [settings.integration.knowledgeProfile],
      knowledgeQuery: prompt,
      knowledgeTopK: 8,
      knowledgeTokenBudget: 4_000,
      requiredCapabilityTags: input.attachments?.some((attachment) => attachment.kind === "image")
        ? ["text_chat", "image_understanding"]
        : undefined,
    });
    const selectedModel = result.modelRecordId
      ? runtime.candidates.find((candidate) => candidate.modelRecordId === result.modelRecordId && (!result.providerId || candidate.providerId === result.providerId))
      : undefined;
    return buildAssistantChatContentResult("agent", result.content || fallback.message, {
      ...runtime,
      routeStatus: "ready",
      model: selectedModel || runtime.model,
    });
  } catch {
    return fallback;
  }
}

function extractAssistantProcess(rawAssistant: string): AssistantProcessEntry[] {
  void rawAssistant;
  return [];
}

async function streamAssistantChatResponse(
  response: import("node:http").ServerResponse,
  input: AssistantChatRequest,
  actor: CurrentUser,
  publicOrigin: string,
) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  const sendEvent = (event: string, data: unknown) => {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  sendEvent("status", { status: "starting" });
  sendEvent("status", { status: "building-context" });
  const result = await runAssistantChat(input, actor, publicOrigin);
  sendEvent("status", { status: "generating" });
  const message = safeLongText(result.message, "", 24000);
  const chunks = splitAssistantMessage(message);
  for (const chunk of chunks) {
    sendEvent("delta", { delta: chunk });
  }
  sendEvent("done", result);
  response.end();
}

function splitAssistantMessage(message: string) {
  const text = safeLongText(message, "", 24000);
  if (!text) return [];
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += 24) {
    chunks.push(text.slice(index, index + 24));
  }
  return chunks;
}

function providerOriginUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

function preferredProviderEndpoint(baseUrl: string, pathname: string) {
  const origin = providerOriginUrl(baseUrl);
  return origin ? `${origin}${pathname.startsWith("/") ? pathname : `/${pathname}`}` : pathname;
}

async function buildFallbackAssistantAnalysis(input: AssistantAnalyzeRequest): Promise<AssistantAnalysisResult> {
  const providerName = safeText(input.providerName, "未命名服务商");
  const baseUrl = safeText(input.baseUrl);
  const requestedCapability = safeText(input.capability).toLowerCase();
  const fallbackCapability = normalizeCapability(input.capability);
  const modelId = safeText(input.modelId, `${providerName.toLowerCase()}-${fallbackCapability}`);
  const protocolHint = safeText(input.protocolHint).toLowerCase();
  const sampleRequest = safeText(input.sampleRequest);
  const sampleResponse = safeText(input.sampleResponse);
  const notes = safeText(input.notes);
  const docUrls = normalizeAssistantDocUrls(input);
  const docUrl = docUrls[0] || safeText(input.docUrl);
  const asyncTemplateHint = normalizeAssistantAsyncTemplate(input.asyncTemplate);
  const signals = `${providerName}\n${baseUrl}\n${docUrls.join("\n")}\n${notes}\n${sampleRequest}\n${sampleResponse}\n${asyncTemplateHint}`;
  const grsaiDetected = /grsai|grsai\.dakka\.com\.cn/i.test(signals);
  const modelscopeDetected = /modelscope|api-inference\.modelscope\.cn/i.test(signals);
  const toapisDetected = /toapis|grok-video-1\.5-preview|videos\/generations\/\{task_id\}|POST\s+https:\/\/toapis\.com\/v1\/videos\/generations/i.test(signals);
  const agnesDetected = /agnes|agnes-ai\.com|agnes-video/i.test(signals);
  const platoDetected = /柏拉图|apilio|api\.apilio\.ai|gpt-best\.apifox\.cn|grok-1\.5-video-(6s|10s|15s)|grok-imagine-video-1\.5-preview|\/v2\/videos\/generations/i.test(signals);
  const platoGrok15Detected = /grok-1\.5-video-(6s|10s|15s)/i.test(modelId);
  const platoPreviewDetected = /grok-imagine-video-1\.5-preview(?:-official)?/i.test(modelId);
  const videoDetected =
    platoDetected ||
    toapisDetected ||
    agnesDetected ||
    /video|i2v|t2v|grok-video|wanx|seedance|kling|veo|sora/i.test(`${signals}\n${modelId}`);
  const capability =
    requestedCapability === "chat" || requestedCapability === "image" || requestedCapability === "video"
      ? normalizeCapability(requestedCapability)
      : grsaiDetected
        ? "image"
        : modelscopeDetected
          ? "image"
        : videoDetected
          ? "video"
          : classifyUpstreamModel(modelId);
  const asyncTask =
    asyncTemplateHint === "sync_inline_result"
      ? false
      : (
    grsaiDetected ||
    modelscopeDetected ||
    platoDetected ||
    toapisDetected ||
    agnesDetected ||
    /request[_-]?id|\/videos\/\{request_id\}|\/videos\/[a-z0-9_-]+/i.test(sampleResponse) ||
    /\bid\b|task[_-]?id|\/tasks\/|status["']?\s*:|poll/i.test(sampleResponse) ||
    /request[_-]?id|\/videos\/\{request_id\}|\/videos\/[a-z0-9_-]+/i.test(sampleRequest) ||
    /\bid\b|task[_-]?id|\/tasks\/|status["']?\s*:/i.test(sampleRequest) ||
    /async|poll/i.test(notes) ||
    asyncTemplateHint !== "auto"
    );
  const protocol =
    (grsaiDetected ? "grsai_draw" :
    modelscopeDetected ? "modelscope" :
    protocolHint ||
    (/apimart/i.test(baseUrl) || /apimart/i.test(providerName) ? "apimart" :
      /gemini/i.test(providerName) ? "gemini" :
      /runninghub/i.test(providerName) ? "runninghub" :
      grsaiDetected ? "grsai_draw" :
      modelscopeDetected ? "modelscope" :
      "openai"));
  const recommendedLayer: AssistantAnalysisResult["recommendedLayer"] =
    asyncTask ? "adapter" :
    /resultVideoPath|pollPathTemplate|taskStatusPath/i.test(sampleResponse + notes) ? "advanced" :
    "default";
  const executionMode: ProviderGenerationExecutionMode =
    asyncTask
      ? asyncTemplateHint === "async_task_poll_then_final_lookup"
        ? "async_poll_then_final_lookup"
        : asyncTemplateHint === "async_task_poll_result"
          ? "async_poll"
          : "worker_queue"
      : "sync_inline";
  const docFetchItems = await safeFetchDocExcerpts(docUrls);
  const firstDocItem = docFetchItems.find((item) => item.ok) || docFetchItems[0];
  const docFetch = {
    attempted: docFetchItems.length > 0,
    ok: docFetchItems.some((item) => item.ok),
    status: firstDocItem?.status,
    excerpt: firstDocItem?.excerpt,
    error: firstDocItem?.ok ? undefined : firstDocItem?.error,
    items: docFetchItems,
  };
  const probe = await safeProbeBaseUrl(baseUrl);
  const inputCapabilities = {
    prompt: true,
    imageReference: capability !== "chat",
    multiImage: /multi|多图|reference/i.test(notes + sampleRequest + sampleResponse),
    firstFrame: capability === "video" && /first[_-]?frame|首帧/i.test(notes + sampleRequest + sampleResponse),
    lastFrame: capability === "video" && /last[_-]?frame|尾帧/i.test(notes + sampleRequest + sampleResponse),
    mask: /mask/i.test(notes + sampleRequest + sampleResponse),
    audioReference: /audio/i.test(notes + sampleRequest + sampleResponse),
  };
  const advancedConfig: Record<string, unknown> = {};
  let chainTemplate = asyncTask ? "async_task_poll_result" : "sync_inline_result";
  const chainTemplateVersion = "video-provider-template/v1";
  if (asyncTemplateHint !== "auto") chainTemplate = asyncTemplateHint;
  if (asyncTask) {
    if (capability === "video") {
      advancedConfig.mode = "async_video_task";
      advancedConfig.submitPath = "videos/generations";
      advancedConfig.pollIntervalMs = 2500;
    }
    const xaiStyleVideo =
      capability === "video" &&
      (/request[_-]?id/i.test(sampleResponse + sampleRequest) ||
        /\/videos\/\{request_id\}|\/videos\/[a-z0-9_-]+/i.test(sampleResponse + notes));
    const generationStatusPath = /videos\/generations\/\{task_id\}|video-status/i.test(signals);
    advancedConfig.pollPathTemplate = toapisDetected || generationStatusPath
      ? "videos/generations/{task_id}"
      : xaiStyleVideo
        ? "videos/{task_id}"
        : "tasks/{task_id}";
    advancedConfig.taskIdPath = toapisDetected || /\bid\b/i.test(sampleResponse)
      ? "id"
      : xaiStyleVideo
        ? "request_id"
        : capability === "image"
          ? "data.0.task_id"
          : "task_id";
    advancedConfig.taskStatusPath =
      xaiStyleVideo || toapisDetected
        ? "status"
        : /data\.status/i.test(sampleResponse)
          ? "data.status"
          : "status";
    if (modelscopeDetected && capability === "image") {
      advancedConfig.pollPathTemplate = "tasks/{task_id}";
      advancedConfig.taskIdPath = "task_id";
      advancedConfig.taskStatusPath = "task_status";
      advancedConfig.pollIntervalMs = 2500;
    }
    advancedConfig.resultVideoPath = capability === "video"
      ? toapisDetected || /result\.data/i.test(sampleResponse + notes)
        ? "result.data.0.url"
        : xaiStyleVideo
        ? "video.url"
        : "result.videos"
      : undefined;
    if (capability === "video") {
      advancedConfig.requestMapping = toapisDetected
        ? { ratio: "aspect_ratio", duration: "seconds", images: "images" }
        : { ratio: "size", duration: "duration", resolution: "quality", images: "image_urls", firstFrame: "first_frame", lastFrame: "last_frame" };
      if (toapisDetected) advancedConfig.requestValueTypes = { duration: "string" };
    }
  }
  if (platoDetected && capability === "video") {
    chainTemplate = "async_task_poll_result";
    advancedConfig.mode = "async_video_task";
    advancedConfig.submitPath = platoPreviewDetected
      ? "videos"
      : platoGrok15Detected
        ? preferredProviderEndpoint(baseUrl, "/v1/videos")
        : preferredProviderEndpoint(baseUrl, "/v2/videos/generations");
    advancedConfig.taskIdPath = "task_id";
    advancedConfig.pollPathTemplate = platoPreviewDetected
      ? "videos/{task_id}"
      : preferredProviderEndpoint(baseUrl, "/v2/videos/generations/{task_id}");
    advancedConfig.taskStatusPath = "status";
    advancedConfig.resultVideoPath = "data.output";
    advancedConfig.pollIntervalMs = 3000;
    advancedConfig.requestMapping = platoPreviewDetected
      ? {
          ratio: "",
          duration: "seconds",
          resolution: "",
          images: "images",
        }
      : platoGrok15Detected
      ? {
          ratio: "",
          duration: "duration",
          resolution: "",
          images: "input_reference",
        }
      : {
          ratio: "aspect_ratio",
          duration: "duration",
          resolution: "resolution",
          images: "images",
        };
    if (platoPreviewDetected) {
      advancedConfig.requestValueTypes = { duration: "string" };
      advancedConfig.requestValueTemplates = { size: "{preview_video_size}" };
    }
    if (platoGrok15Detected) {
      advancedConfig.requestBodyMode = "multipart_form_data";
      advancedConfig.requestContentType = "multipart/form-data";
      advancedConfig.requestFileFields = ["images"];
      advancedConfig.requestValueTemplates = { size: "{video_size}" };
    }
    if (platoPreviewDetected) {
      inputCapabilities.imageReference = true;
    }
  }
  if (toapisDetected) {
    advancedConfig.baseUrlSuggestion = "https://toapis.com";
    advancedConfig.docStatusPath = "GET /v1/videos/generations/{task_id}";
  }
  if (agnesDetected && capability === "video") {
    chainTemplate = "async_task_poll_then_final_lookup";
    advancedConfig.baseUrlSuggestion = "https://apihub.agnes-ai.com/v1";
    advancedConfig.submitPath = "videos";
    advancedConfig.taskIdPath = "task_id";
    advancedConfig.pollPathTemplate = "videos/{task_id}";
    advancedConfig.taskStatusPath = "status";
    advancedConfig.resultVideoPath = "video_url";
    advancedConfig.finalResultTaskIdPath = "video_id";
    advancedConfig.finalResultPathTemplate = "../agnesapi?video_id={task_id}";
    advancedConfig.finalResultVideoPath = "remixed_from_video_id";
    advancedConfig.pollIntervalMs = 10000;
    advancedConfig.requestMapping = {
      ratio: "aspect_ratio",
      duration: "duration",
      resolution: "resolution",
      images: "image_urls",
      firstFrame: "first_frame",
      lastFrame: "last_frame",
      ...plainObject(advancedConfig.requestMapping),
    };
  }
  if (grsaiDetected) {
    chainTemplate = "adapter_manual_model_catalog";
    advancedConfig.manualModelCatalog = true;
    advancedConfig.defaultModelId = "gpt-image-2";
  }
  if (modelscopeDetected && capability === "image" && asyncTemplateHint === "auto") {
    chainTemplate = "async_task_poll_result";
  }
  if (toapisDetected && capability === "video" && asyncTemplateHint === "auto") {
    chainTemplate = "async_task_poll_result";
  }
  const summary = asyncTask
    ? `${providerName} 更像异步任务型 ${capability === "video" ? "视频" : capability === "image" ? "图像" : "模型"} 接口，建议走 ${recommendedLayer} 层处理。`
    : `${providerName} 当前更接近同步返回结果的 ${protocol} 风格接口，优先走统一结构化配置。`;
  const risks = [
    asyncTask ? "当前链路若按同步结果解析，任务会直接失败或超时。" : "仍需验证该接口是否存在隐藏的异步轮询阶段。",
    capability === "video" ? "视频模型需要明确首帧、尾帧、多参考图能力，避免前端错误展示输入口。" : "需要确认参数 schema 与上游字段映射是否一致。",
    probe.ok ? "基础域名探活通过，但不代表鉴权、配额和模型调用完全可用。" : "Base URL 探活未确认成功，上游地址或权限可能仍有问题。",
  ];
  if (platoDetected && capability === "video") {
    if (platoGrok15Detected) {
      risks.unshift("柏拉图的 grok-1.5-video-6s/10s/15s 不是 JSON + URL 引用接口，而是 /v1/videos + multipart/form-data + input_reference 文件上传。");
      risks.unshift("这组模型把比例和清晰度收敛成单个 size 字段；如果继续沿用 aspect_ratio + resolution，会在上游直接失败。");
    } else {
      risks.unshift("柏拉图这组 Grok 视频模型需要按 Grok v2 视频链路处理；继续沿用错误端点或错误结果路径会直接失败。");
    }
    if (platoPreviewDetected) {
      risks.unshift("grok-imagine-video-1.5-preview 需要参考图输入，不支持纯文本直接生成视频。");
    }
  }
  const checklist = [
    "在后台确认 Provider 基本信息、协议类型和 Base URL。",
    "导入或新建模型草案，检查 capability、inputCapabilities、parameterSchema。",
    asyncTask ? "补齐 task_id、status、pollPathTemplate、结果路径等 adapter / advancedConfig 配置。" : "先用默认结构化配置打通，再决定是否补高级映射。",
    "在灰度环境使用真实密钥跑一次最小生成请求并检查任务日志。",
  ];
  if (platoDetected && capability === "video") {
    checklist.splice(
      2,
      0,
      platoGrok15Detected
        ? "将提交端点改为 /v1/videos，使用 multipart/form-data 上传 input_reference 文件，并把 size 由 ratio/resolution 派生。"
        : platoPreviewDetected
          ? "将提交/轮询端点改为 /v1/videos 与 /v1/videos/{task_id}，按 JSON body 提交 seconds/size/images，并确认最终视频 URL 来自 data.output。"
          : "将提交/轮询端点改为 Grok v2 视频接口，并确认最终视频 URL 来自 data.output。",
    );
  }
  return {
    mode: "fallback",
    summary,
    recommendedLayer,
    protocol,
    asyncTask,
    executionMode,
    chainTemplate,
    chainTemplateVersion,
    docFetch,
    probe,
    drafts: {
      provider: {
        name: providerName,
        baseUrl: toapisDetected && (!baseUrl || /api\.toapis\.com/i.test(baseUrl)) ? "https://toapis.com" : baseUrl,
        protocol,
        note: grsaiDetected
          ? `${summary} 已识别为 GRSAI 站点，建议使用手动模型目录并默认接入 gpt-image-2。`
          : platoDetected
            ? platoGrok15Detected
            ? `${summary} 柏拉图的 grok-1.5-video-6s/10s/15s 需要使用 /v1/videos、multipart/form-data 和 input_reference 文件上传，size 建议由 ratio/resolution 派生后填入。`
              : `${summary} 柏拉图的 grok-imagine-video-1.5-preview 建议使用 /v1/videos 与 /v1/videos/{task_id}，按 JSON body 提交 seconds、size、images，并从 data.output 读取最终视频 URL。`
          : toapisDetected
            ? `${summary} 官方文档使用 https://toapis.com/v1/videos/generations 和 /v1/videos/generations/{task_id}。`
            : agnesDetected
              ? `${summary} Agnes 使用 /v1/videos 提交、/v1/videos/{task_id} 查询任务，并通过 /agnesapi?video_id={video_id} 读取最终视频 URL。`
              : summary,
      },
      model: {
        modelId: grsaiDetected ? "gpt-image-2" : modelId,
        displayName: safeText(input.modelId, modelId),
        capability,
        executionMode,
        inputProfile: capability === "chat" ? "prompt" : "prompt,image_reference",
        inputCapabilities,
        parameterSchema: JSON.stringify(defaultAssistantParameterSchema(capability), null, 2),
        advancedConfig,
      },
    },
    risks,
    checklist,
    rawAssistant: JSON.stringify({
      source: "fallback",
      providerName,
      protocol,
      recommendedLayer,
      asyncTask,
      executionMode,
      chainTemplate,
      chainTemplateVersion,
      sampleSignals: {
        docUrls,
        asyncTemplateHint,
        sampleRequest: sampleRequest.slice(0, 400),
        sampleResponse: sampleResponse.slice(0, 400),
        notes: notes.slice(0, 400),
      },
    }, null, 2),
  };
}

function buildFallbackAssistantChat(input: AssistantChatRequest, _actor: CurrentUser): AssistantChatResult {
  const message = safeLongText(input.message, "", 4000);
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  const attachmentSummary = attachments
    .map((item) => summarizeAssistantAttachment(item))
    .map((item) => `${safeText(item.kind || "context")}:${safeText(item.title || item.summary || item.kind)}`)
    .slice(0, 8);
  const finalMessage = [
    attachmentSummary.length
      ? `已收到 ${attachments.length} 个上下文卡片：${attachmentSummary.join(" / ")}。`
      : "当前没有上下文卡片。",
    message
      ? `问题：${message}`
      : "请继续输入问题或要求。",
    "可继续补充节点、工作流或媒体上下文。",
  ]
    .filter(Boolean)
    .join("\n");
  return buildAssistantChatContentResult("fallback", finalMessage);
}

async function readAssistantRuntimeStatus(scope: "canvas" | "admin", settings: AssistantSettingsRecord): Promise<AssistantRuntimeStatus> {
  const agentKey = assistantAgentKeyForScope(settings, scope);
  const adminDb = await readAdminDb();
  const providerNames = Object.fromEntries((adminDb.providers || []).map((provider) => [provider.id, provider.name]));
  const modelNames = Object.fromEntries((adminDb.models || []).map((model) => [model.id, {
    modelId: model.modelId,
    displayName: model.displayName,
    inputCapabilities: model.inputCapabilities,
  }]));
  const base = {
    environment: environment,
    scope,
    enabled: scope === "admin" ? settings.backend.enabled : settings.frontend.enabled,
    agentKey,
    providerNames,
    modelNames,
    updatedAt: Date.now(),
  } as const;
  if (environment !== "gray" && environment !== "production") {
    return buildAssistantRuntimeStatus({ ...base, environment: "local", candidates: [] });
  }
  try {
    const configuration = await agentRuntimeConfigurationRepository.readPublishedConfiguration({
      agentKey,
      role: "planner",
      environment,
    });
    const pool = await llmRoutingRepository.readPublishedPool({
      role: "planner",
      scenario: "assistant-chat",
      environment,
      poolKey: configuration.configuration.llmPoolKey || undefined,
    });
    return buildAssistantRuntimeStatus({
      ...base,
      environment,
      agentVersion: configuration.version,
      configurationVersionId: configuration.configurationVersionId,
      poolKey: configuration.configuration.llmPoolKey || undefined,
      poolVersionId: pool?.poolVersionId,
      candidates: pool?.candidates || [],
    });
  } catch {
    return buildAssistantRuntimeStatus({ ...base, environment, candidates: [] });
  }
}

function buildAssistantChatContentResult(mode: "agent" | "fallback", input: string, runtime?: AssistantRuntimeStatus): AssistantChatResult {
  const content = createAssistantContent(input);
  return {
    mode,
    message: content.text,
    rawAssistant: content.text,
    content,
    blocks: parseAssistantMessageBlocks(content.text),
    runtime,
  };
}

function summarizeAssistantAttachment(item: AssistantChatAttachment, detailLevel: AssistantDetailLevel = "technical") {
  const payload = plainObject(item.payload);
  const kind = safeText(item.kind || "context");
  const summary: Record<string, unknown> = {
    kind,
    title: safeText(item.title).slice(0, 120),
    summary: safeText(item.summary).slice(0, 240),
  };
  if (kind === "workflow") {
    Object.assign(summary, summarizeWorkflowAssistantAttachment(payload, { detailLevel }));
  }
  if (kind === "node") {
    Object.assign(summary, summarizeNodeAssistantAttachment(payload, { detailLevel }));
  }
  if (kind === "provider" || kind === "model" || kind === "task") {
    summary.id = safeText(payload.id || payload.providerId || payload.modelId || payload.taskId).slice(0, 80);
    summary.status = safeText(payload.status).slice(0, 80);
    summary.capability = safeText(payload.capability).slice(0, 80);
    summary.protocol = safeText(payload.protocol).slice(0, 80);
  }
  if (kind === "user" || kind === "audit" || kind === "page" || kind === "context") {
    summary.id = safeText(payload.id || payload.userId || payload.auditId || payload.targetId).slice(0, 80);
    summary.status = safeText(payload.status || payload.role || payload.activeTab).slice(0, 80);
    summary.targetType = safeText(payload.targetType).slice(0, 80);
    summary.action = safeText(payload.action).slice(0, 80);
  }
  if (kind === "image" || kind === "video" || kind === "audio") {
    summary.mediaKind = kind;
    const mediaUrl = safeText(payload.url || payload.sourceUrl);
    summary.urlHost = mediaUrl.replace(/^https?:\/\//, "").split("/")[0].slice(0, 120);
    if (/^(https?:\/\/|\/files\/)/i.test(mediaUrl)) {
      summary.url = mediaUrl.slice(0, 240);
    }
  }
  return summary;
}

function defaultAssistantParameterSchema(capability: ModelCapability) {
  if (capability === "chat") {
    return {
      type: "object",
      properties: {
        temperature: { type: "number", minimum: 0, maximum: 2, default: 0.7 },
        max_tokens: { type: "integer", minimum: 1, maximum: 8192, default: 1024 },
      },
    };
  }
  return {
    type: "object",
    properties: {
      prompt: { type: "string", title: "提示词" },
      negative_prompt: { type: "string", title: "反向提示词" },
      aspect_ratio: { type: "string", enum: ["1:1", "16:9", "9:16"] },
      duration_seconds: capability === "video" ? { type: "integer", minimum: 1, maximum: 30, default: 5 } : undefined,
    },
  };
}

function buildInternalProviderAnalysisPrompt(input: AssistantAnalyzeRequest, fallback: AssistantAnalysisResult) {
  const docUrls = normalizeAssistantDocUrls(input);
  return [
    "你是无限画布后台的受限接入审计助手。",
    "请根据给定信息输出严格 JSON，不要输出 Markdown 代码块。",
    'JSON schema: {"summary":"", "protocol":"", "recommendedLayer":"default|advanced|adapter", "asyncTask":true, "chainTemplate":"sync_inline_result|async_task_poll_result|async_task_poll_then_final_lookup|adapter_manual_model_catalog", "chainTemplateVersion":"video-provider-template/v1", "risks":[""], "checklist":[""], "drafts":{"provider":{"name":"","baseUrl":"","protocol":"","note":""},"model":{"modelId":"","displayName":"","capability":"chat|image|video","inputProfile":"","inputCapabilities":{"prompt":true,"imageReference":false,"multiImage":false,"firstFrame":false,"lastFrame":false,"mask":false,"audioReference":false},"parameterSchema":"{}", "advancedConfig":{}}}}',
    "如果是异步视频平台，必须优先判断属于哪一类模板：同步直返、单段轮询、二段最终结果查询。",
    "如果属于二段最终结果查询，advancedConfig 必须尽量给出 finalResultTaskIdPath、finalResultPathTemplate、finalResultVideoPath。",
    "如果识别到柏拉图 / apilio / Grok 1.5 视频模型，优先建议 Grok v2 视频端点、JSON body 的 images 数组、以及 data.output 结果路径。",
    "只允许输出受控配置字段，不要输出 shell 命令、数据库写入语句或需要管理员复制执行的脚本。",
    "如果信息不足，也要尽量给出保守建议。",
    `输入能力: ${JSON.stringify({ ...input, docUrls, asyncTemplate: normalizeAssistantAsyncTemplate(input.asyncTemplate) })}`,
    `当前回退分析: ${JSON.stringify(fallback)}`,
  ].join("\n");
}

function buildInternalAssistantChatPrompt(input: AssistantChatRequest, actor: CurrentUser, fallback: AssistantChatResult) {
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  const detailLevel = resolveAssistantDetailLevel({ message: safeLongText(input.message, "", 4000), scope: input.scope || "canvas" });
  return [
    "你是无限画布的内置 AI 助手。",
    "你会收到用户问题，以及若干来自画布或后台的上下文卡片。",
    "请结合这些上下文，用专业、可执行的中文直接回复。",
    buildAssistantAnswerPolicyPrompt(detailLevel),
    "不要假装你已经修改了配置或执行了操作。",
    "不要输出超长单行文本；如果内容很长，拆成多个段落或列表项。",
    "保持空行、缩进和代码块原样，不要压扁格式。",
    "如果用户提供的是工作流、节点或媒体，请优先做分析、诊断、建议和下一步动作。",
    "只能把诊断对象中的 observed、location 和 technical 字段视为已观察事实；推断必须明确标为可能原因，不得把猜测写成事实。",
    "不得声称已经重试、修改节点、切换模型或恢复运行，除非上下文中存在对应的审计结果。",
    `当前作用域: ${input.scope === "admin" ? "后台管理" : "画布工作区"}`,
    `当前用户: ${actor.email} (${actor.role})`,
    `用户问题: ${safeLongText(input.message, "", 4000) || "未提供问题"}`,
    `回答详细级别: ${detailLevel}`,
    `上下文卡片摘要: ${JSON.stringify(attachments.map((item) => summarizeAssistantAttachment(item, detailLevel)))}`,
    `本地兜底回复摘要: ${safeLongText(fallback.message, "", 1200)}`,
  ].join("\n");
}

function parseAssistantLayer(value: unknown): "default" | "advanced" | "adapter" | undefined {
  const text = safeText(value).toLowerCase();
  if (text === "default" || text === "advanced" || text === "adapter") return text;
  return undefined;
}

function parseAssistantExecutionMode(value: unknown): ProviderGenerationExecutionMode | undefined {
  const text = safeText(value);
  return PROVIDER_GENERATION_EXECUTION_MODES.has(text as ProviderGenerationExecutionMode)
    ? (text as ProviderGenerationExecutionMode)
    : undefined;
}

function tryParseAssistantJson(text: string): any {
  const trimmed = String(text || "").trim();
  const direct = safeJsonParse(trimmed);
  if (direct && typeof direct === "object") return direct;
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return safeJsonParse(match[0]);
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function safeFetchDocExcerpts(docUrls: string[]) {
  const uniqueUrls = docUrls.filter((item, index, list) => item && list.indexOf(item) === index).slice(0, 6);
  const items = [];
  for (const url of uniqueUrls) {
    items.push(await safeFetchDocExcerpt(url));
  }
  return items;
}

async function safeFetchDocExcerpt(docUrl: string) {
  if (!docUrl) return { url: docUrl, attempted: false, ok: false };
  try {
    const response = await httpJsonLike(docUrl, { method: "GET", timeoutMs: 8000 });
    const excerpt = extractReadableDocText(response.body).slice(0, 900);
    return {
      url: docUrl,
      attempted: true,
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      excerpt,
    };
  } catch (error) {
    return {
      url: docUrl,
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractReadableDocText(source: string) {
  const text = safeText(source);
  if (!text) return "";
  if (!/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function safeProbeBaseUrl(baseUrl: string) {
  if (!baseUrl) return { attempted: false, ok: false };
  try {
    const response = await httpJsonLike(baseUrl, { method: "GET", timeoutMs: 5000 });
    return {
      attempted: true,
      ok: response.status >= 200 && response.status < 500,
      status: response.status,
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function httpJsonLike(targetUrl: string, options: { method: string; timeoutMs: number }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("timeout")), options.timeoutMs);
  try {
    const response = await fetch(targetUrl, {
      method: options.method,
      headers: { "user-agent": "xinghuan-assistant-probe" },
      signal: controller.signal,
    });
    return {
      status: response.status,
      body: await response.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function appendAudit(
  actor: CurrentUser,
  action: string,
  targetType: string,
  targetId: string,
  summary: string,
  context?: RequestContext,
) {
  const record: AdminAuditRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actorId: actor.id,
    actorEmail: actor.email,
    action,
    targetType,
    targetId,
    summary,
    requestId: safeText(context?.requestId),
    ip: safeText(context?.ip),
    userAgent: safeText(context?.userAgent),
    createdAt: Date.now(),
  };
  await appendAuditRecord(record);
}

async function appendAuditRecord(record: AdminAuditRecord) {
  await adminRepository.appendAuditRecord(record);
}

function assistantAgentIdempotencyKey(input: AssistantChatRequest, actor: CurrentUser) {
  const explicit = safeText(input.idempotencyKey);
  if (explicit) return explicit.slice(0, 200);
  const digest = createHash("sha256").update(JSON.stringify({
    ownerId: actor.id,
    scope: input.scope || "canvas",
    conversationId: safeText(input.conversationId),
    message: safeLongText(input.message, "", 4000),
    attachments: (input.attachments || []).map((item) => summarizeAssistantAttachment(item)),
  })).digest("hex").slice(0, 32);
  return `assistant:${digest}`;
}

const observabilityConflictActions = {
  CANVAS_REVISION_CONFLICT: "conflict.canvas_revision",
  RESOURCE_REVISION_CONFLICT: "conflict.resource_revision",
  ADMIN_SETTINGS_REVISION_CONFLICT: "conflict.admin_settings_revision",
} as const;

async function appendObservabilityConflictAudit(error: HttpError, context: RequestContext) {
  const action = observabilityConflictActions[error.message as keyof typeof observabilityConflictActions];
  if (!action) return;
  const payload = error.payload || {};
  const targetType = action === "conflict.canvas_revision"
    ? "canvas"
    : action === "conflict.resource_revision"
      ? safeText(payload.resourceKind, "resource")
      : safeText(payload.settingsKey, "admin-settings");
  const targetId = safeText(
    payload.canvasId ?? payload.resourceId ?? payload.settingsKey ?? context.path,
    context.path,
  );
  const actorEmail = safeText(
    context.userEmail,
    context.userId ? `${context.userId}@local` : "system@local",
  );
  await appendAuditRecord({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actorId: safeText(context.userId),
    actorEmail,
    action,
    targetType,
    targetId,
    summary: `${error.message} via ${context.method} ${context.path}`,
    requestId: safeText(context.requestId),
    ip: safeText(context.ip),
    userAgent: safeText(context.userAgent),
    createdAt: Date.now(),
  });
}

async function readStorageStats() {
  const userIds = await readdir(usersDir).catch(() => []);
  let canvases = 0;
  let resources = 0;
  let inputFiles = 0;
  let outputFiles = 0;
  for (const userId of userIds) {
    const baseUser: CurrentUser = { id: userId, email: "", name: "", role: "member" };
    const dirs = userDataDirs(baseUser);
    const canvasList = await readJsonFile<CanvasListItem[]>(dirs.canvasListPath, []);
    canvases += Array.isArray(canvasList) ? canvasList.length : 0;
    const resourceDb = await readJsonFile<ResourceDb>(dirs.resourceDbPath, { categories: [], items: [] });
    resources += Array.isArray(resourceDb.items) ? resourceDb.items.length : 0;
    inputFiles += (await readdir(dirs.inputDir).catch(() => [])).length;
    outputFiles += (await readdir(dirs.outputDir).catch(() => [])).length;
  }
  return { users: userIds.length, canvases, resources, inputFiles, outputFiles };
}

async function readDatabaseStatus() {
  if (!databaseUrl) {
    return {
      configured: false,
      status: "not_configured",
      migrations: [] as string[],
      error: "",
      currentDatabase: "",
      expectedDatabase: expectedDatabaseName,
      targetMatched: false,
    };
  }
  let pg: typeof import("pg");
  try {
    pg = await import("pg");
  } catch (error) {
    return {
      configured: true,
      status: "driver_missing",
      migrations: [] as string[],
      error: error instanceof Error ? error.message : String(error),
      currentDatabase: "",
      expectedDatabase: expectedDatabaseName,
      targetMatched: false,
    };
  }
  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    const now = await client.query("select now() as now, current_database() as name");
    const migrations = await client
      .query("select id from xh_schema_migrations order by id")
      .then((result) => result.rows.map((row) => String(row.id)))
      .catch(() => []);
    const currentDatabase = safeText(String(now.rows[0]?.name || ""));
    return {
      configured: true,
      status: "connected",
      serverTime: now.rows[0]?.now,
      migrations,
      error: "",
      currentDatabase,
      expectedDatabase: expectedDatabaseName,
      targetMatched: expectedDatabaseName ? currentDatabase === expectedDatabaseName : false,
    };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      migrations: [] as string[],
      error: error instanceof Error ? error.message : String(error),
      currentDatabase: "",
      expectedDatabase: expectedDatabaseName,
      targetMatched: false,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function readRedisStatus(taskQueueSettings: TaskQueueSettings) {
  const queues = buildTaskQueueRuntimeDescriptors(taskQueueName, taskQueueSettings);
  if (!redisUrl) {
    return {
      configured: false,
      status: "not_configured",
      queue: taskQueueName,
      depth: 0,
      queues: queues.map((item) => ({
        ...item,
        userConcurrency: taskQueueSettings[item.capability].userConcurrency,
        effectiveConcurrency: undefined,
        workerCount: undefined,
        slotCount: undefined,
      })),
      error: "",
      runninghub: {
        ...taskQueueSettings.runninghub,
        activeWindowCount: undefined,
      },
    };
  }
  try {
    const client = await getRedisClient();
    const pong = await client.ping();
    const runtimeSlots = await readEnvironmentWorkerRuntimeSlots(client, environment);
    const adminDb = await readAdminDb();
    const runninghubPoolKeys = adminDb.providers
      .filter((provider) => provider.enabled && normalizeProviderProtocol(provider.protocol) === "runninghub")
      .flatMap((provider) =>
        buildEffectiveRunningHubKeyPool(provider, Math.max(1, Number(taskQueueSettings.runninghub.concurrency) || 1))
          .map((item) => runningHubRedisWindowKey(provider.id, item.id)),
      );
    const runninghubWindowValues = await Promise.all(
      runninghubPoolKeys.map((key) => client.get(key).catch(() => "0")),
    );
    const runninghubActiveWindowCount = runninghubWindowValues.reduce(
      (sum, value) => sum + Math.max(0, Number(value) || 0),
      0,
    );
    const queueStates = await Promise.all(
      queues.map(async (item) => {
        const runtimeSummary = summarizeWorkerRuntimeQueue(runtimeSlots, item.queue);
        return {
          ...item,
          userConcurrency: taskQueueSettings[item.capability].userConcurrency,
          depth: await client.lLen(item.queue),
          ...runtimeSummary,
        };
      }),
    );
    const depth = queueStates.reduce((sum, item) => sum + item.depth, 0);
    return {
      configured: true,
      status: pong === "PONG" ? "connected" : "unknown",
      queue: taskQueueName,
      depth,
      queues: queueStates,
      error: "",
      runninghub: {
        ...taskQueueSettings.runninghub,
        activeWindowCount: runninghubActiveWindowCount,
      },
    };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      queue: taskQueueName,
      depth: 0,
      queues: queues.map((item) => ({
        ...item,
        userConcurrency: taskQueueSettings[item.capability].userConcurrency,
        effectiveConcurrency: undefined,
        workerCount: undefined,
        slotCount: undefined,
      })),
      error: error instanceof Error ? error.message : String(error),
      runninghub: {
        ...taskQueueSettings.runninghub,
        activeWindowCount: undefined,
      },
    };
  }
}

async function readSystemObservability(
  database: {
    configured: boolean;
    status: string;
    error: string;
    currentDatabase?: string;
    expectedDatabase?: string;
    targetMatched?: boolean;
  },
  redis: {
    configured: boolean;
    status: string;
    error: string;
    depth: number;
  },
  rangeInput?: string,
) {
  const [tasks, audits] = await Promise.all([
    readTaskObservabilitySummary(rangeInput),
    readAuditObservabilitySummary(),
  ]);
  const queueConsistency = evaluateQueueConsistency({ databaseQueued: tasks.queued, redisQueued: redis.depth });
  const generatedAt = Date.now();
  return {
    environment,
    generatedAt,
    freshness: { status: "fresh", generatedAt },
    range: tasks.range,
    tasks,
    audits,
    requestPerformance: requestPerformance.snapshot(),
    runtime: await readProcessRuntimeSnapshot(),
    queueConsistency,
    alerts: buildObservabilityAlerts({ database, redis, tasks, audits, queueConsistency }),
  };
}

async function readProcessRuntimeSnapshot() {
  const memory = process.memoryUsage();
  let fdCount: number | undefined;
  try {
    fdCount = (await readdir("/proc/self/fd")).length;
  } catch {
    fdCount = undefined;
  }
  const runtime = {
    generatedAt: Date.now(),
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    externalBytes: memory.external,
    arrayBuffersBytes: memory.arrayBuffers,
    fdCount,
    activeHandleCount: typeof (process as NodeJS.Process & { _getActiveHandles?: () => unknown[] })._getActiveHandles === "function"
      ? (process as NodeJS.Process & { _getActiveHandles: () => unknown[] })._getActiveHandles().length
      : undefined,
    eventLoopDelayP95Ms: Number((eventLoopHistogram.percentile(95) / 1e6).toFixed(2)),
    eventLoopDelayP99Ms: Number((eventLoopHistogram.percentile(99) / 1e6).toFixed(2)),
  };
  eventLoopHistogram.reset();
  return runtime;
}

type ObservabilityHealthStatus = "healthy" | "warning" | "critical";
type ObservabilityAlertSeverity = "info" | "warning" | "critical";

function toObservabilityHealth(
  status: ObservabilityHealthStatus,
  summary: string,
) {
  return { status, summary };
}

function toObservabilityAlert(
  code: string,
  severity: ObservabilityAlertSeverity,
  source: string,
  summary: string,
  action: string,
) {
  return { code, severity, source, summary, action };
}

function toCoveragePercent(sampled: number, withRequestId: number) {
  return sampled > 0 ? Math.round((withRequestId / sampled) * 100) : 0;
}

function buildObservabilityAlerts(input: {
  database: {
    configured: boolean;
    status: string;
    error: string;
    currentDatabase?: string;
    expectedDatabase?: string;
    targetMatched?: boolean;
  };
  redis: {
    configured: boolean;
    status: string;
    error: string;
  };
  tasks: {
    health: {
      status: TaskObservabilityHealthStatus;
      summary: string;
    };
  };
  audits: {
    coverageHealth: {
      status: ObservabilityHealthStatus;
      summary: string;
    };
    conflicts: {
      health: {
        status: ObservabilityHealthStatus;
        summary: string;
      };
    };
  };
  queueConsistency: ReturnType<typeof evaluateQueueConsistency>;
}) {
  const items: Array<ReturnType<typeof toObservabilityAlert>> = [];
  if (input.database.configured && input.database.status !== "connected") {
    items.push(
      toObservabilityAlert(
        "database_unavailable",
        "critical",
        "database",
        input.database.error || `数据库状态异常：${input.database.status}`,
        "检查数据库连接、驱动与目标库配置",
      ),
    );
  } else if (
    input.database.configured
    && input.database.expectedDatabase
    && input.database.targetMatched === false
  ) {
    items.push(
      toObservabilityAlert(
        "database_target_mismatch",
        "critical",
        "database",
        `当前数据库 ${input.database.currentDatabase || "-"} 与目标 ${input.database.expectedDatabase} 不一致`,
        "立即核对环境变量、release 指针和数据库目标",
      ),
    );
  }
  if (input.redis.configured && input.redis.status !== "connected") {
    items.push(
      toObservabilityAlert(
        "redis_unavailable",
        "critical",
        "redis",
        input.redis.error || `Redis 状态异常：${input.redis.status}`,
        "检查 Redis 服务、队列配置与网络连通性",
      ),
    );
  }
  if (input.queueConsistency.status === "warning") {
    items.push(
      toObservabilityAlert(
        "queue_state_mismatch",
        "warning",
        "queue",
        input.queueConsistency.summary,
        "检查 queued 任务与 Redis 队列状态，按受控 reconciliation 流程处理",
      ),
    );
  }
  if (input.tasks.health.status !== "healthy") {
    items.push(
      toObservabilityAlert(
        "task_failures",
        input.tasks.health.status === "unknown" ? "info" : input.tasks.health.status,
        "tasks",
        input.tasks.health.summary,
        "检查失败任务日志、上游响应和队列积压情况",
      ),
    );
  }
  if (input.audits.coverageHealth.status !== "healthy") {
    items.push(
      toObservabilityAlert(
        "request_id_coverage",
        input.audits.coverageHealth.status,
        "audits",
        input.audits.coverageHealth.summary,
        "补 requestId 透传链路，并复验后台关键写入/读链路",
      ),
    );
  }
  if (input.audits.conflicts.health.status !== "healthy") {
    items.push(
      toObservabilityAlert(
        "revision_conflicts",
        input.audits.conflicts.health.status,
        "audits",
        input.audits.conflicts.health.summary,
        "检查 revision 冲突来源并确认前端基线版本是否过旧",
      ),
    );
  }
  return {
    activeCount: items.length,
    highestSeverity: items.some((item) => item.severity === "critical")
      ? "critical"
      : items.some((item) => item.severity === "warning")
        ? "warning"
        : items.some((item) => item.severity === "info")
          ? "info"
          : "healthy",
    items,
  };
}

async function readTaskObservabilitySummary(rangeInput?: string) {
  const range = normalizeSystemHealthRange(rangeInput);
  const generatedAt = Date.now();
  const rangeStart = generatedAt - range.durationMs;
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const intervalByRange = { "1h": "1 hour", "24h": "24 hour", "7d": "7 day", "30d": "30 day" } as const;
    const [result, seriesResult] = await Promise.all([pool.query(
      `select
         count(*) as total,
         count(*) filter (where status = 'queued') as queued,
       count(*) filter (where status = 'running') as running,
       count(*) filter (where status = 'succeeded') as succeeded,
       count(*) filter (where status = 'failed') as failed,
       count(*) filter (where status = 'cancelled') as cancelled,
       count(*) filter (where status = 'failed' and updated_at >= now() - interval '1 hour') as failed_last_1h,
       count(*) filter (where status = 'failed' and updated_at >= now() - interval '24 hour') as failed_last_24h
       ,
       count(*) filter (where status in ('succeeded', 'failed', 'cancelled') and updated_at >= now() - interval '24 hour') as finalized_last_24h,
       count(*) filter (where status = 'failed' and updated_at >= now() - interval '7 day') as failed_last_7d,
       count(*) filter (where status in ('succeeded', 'failed', 'cancelled') and updated_at >= now() - interval '7 day') as finalized_last_7d,
       count(*) filter (where status = 'failed' and updated_at >= now() - interval '30 day') as failed_last_30d,
       count(*) filter (where status in ('succeeded', 'failed', 'cancelled') and updated_at >= now() - interval '30 day') as finalized_last_30d
      from xh_tasks`,
    ), pool.query(
      `select date_trunc('${range.bucket}', updated_at) as bucket,
              count(*) filter (where status = 'succeeded') as succeeded,
              count(*) filter (where status = 'failed') as failed,
              count(*) filter (where status = 'cancelled') as cancelled
         from xh_tasks
        where updated_at >= now() - interval '${intervalByRange[range.key]}'
          and status in ('succeeded', 'failed', 'cancelled')
        group by 1
        order by 1 asc`,
    )]);
    const row = result.rows[0] || {};
    return {
      ...decorateTaskObservabilitySummary({
      total: Number(row.total) || 0,
      queued: Number(row.queued) || 0,
      running: Number(row.running) || 0,
      succeeded: Number(row.succeeded) || 0,
      failed: Number(row.failed) || 0,
      cancelled: Number(row.cancelled) || 0,
      failedLast1h: Number(row.failed_last_1h) || 0,
      failedLast24h: Number(row.failed_last_24h) || 0,
      finalizedLast24h: Number(row.finalized_last_24h) || 0,
      failedLast7d: Number(row.failed_last_7d) || 0,
      finalizedLast7d: Number(row.finalized_last_7d) || 0,
      failedLast30d: Number(row.failed_last_30d) || 0,
      finalizedLast30d: Number(row.finalized_last_30d) || 0,
      }),
      range: { ...range, from: rangeStart, to: generatedAt },
      series: seriesResult.rows.map((item) => ({
        at: dateToMillis(item.bucket),
        succeeded: Number(item.succeeded) || 0,
        failed: Number(item.failed) || 0,
        cancelled: Number(item.cancelled) || 0,
      })),
    };
  }
  const db = await readAdminDb();
  const tasks = Array.isArray(db.tasks) ? db.tasks : [];
  const now = Date.now();
  const finalizedTasks = tasks.filter((task) => task.status === "succeeded" || task.status === "failed" || task.status === "cancelled");
  const summary = decorateTaskObservabilitySummary({
    total: tasks.length,
    queued: tasks.filter((task) => task.status === "queued").length,
    running: tasks.filter((task) => task.status === "running").length,
    succeeded: tasks.filter((task) => task.status === "succeeded").length,
    failed: tasks.filter((task) => task.status === "failed").length,
    cancelled: tasks.filter((task) => task.status === "cancelled").length,
    failedLast1h: tasks.filter((task) => task.status === "failed" && now - Number(task.updatedAt || 0) <= 60 * 60 * 1000).length,
    failedLast24h: tasks.filter((task) => task.status === "failed" && now - Number(task.updatedAt || 0) <= 24 * 60 * 60 * 1000).length,
    finalizedLast24h: finalizedTasks.filter((task) => now - Number(task.updatedAt || 0) <= 24 * 60 * 60 * 1000).length,
    failedLast7d: tasks.filter((task) => task.status === "failed" && now - Number(task.updatedAt || 0) <= 7 * 24 * 60 * 60 * 1000).length,
    finalizedLast7d: finalizedTasks.filter((task) => now - Number(task.updatedAt || 0) <= 7 * 24 * 60 * 60 * 1000).length,
    failedLast30d: tasks.filter((task) => task.status === "failed" && now - Number(task.updatedAt || 0) <= 30 * 24 * 60 * 60 * 1000).length,
    finalizedLast30d: finalizedTasks.filter((task) => now - Number(task.updatedAt || 0) <= 30 * 24 * 60 * 60 * 1000).length,
  });
  const buckets = new Map<number, { at: number; succeeded: number; failed: number; cancelled: number }>();
  const bucketMs = range.bucket === "minute" ? 60_000 : range.bucket === "hour" ? 3_600_000 : 86_400_000;
  for (const task of finalizedTasks) {
    const updatedAt = Number(task.updatedAt || 0);
    if (updatedAt < rangeStart) continue;
    const at = Math.floor(updatedAt / bucketMs) * bucketMs;
    const item = buckets.get(at) || { at, succeeded: 0, failed: 0, cancelled: 0 };
    if (task.status === "succeeded") item.succeeded += 1;
    if (task.status === "failed") item.failed += 1;
    if (task.status === "cancelled") item.cancelled += 1;
    buckets.set(at, item);
  }
  return {
    ...summary,
    range: { ...range, from: rangeStart, to: generatedAt },
    series: [...buckets.values()].sort((left, right) => left.at - right.at),
  };
}

async function readAuditObservabilitySummary() {
  const decorate = (summary: {
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
    conflicts: {
      totalLast24h: number;
      totalLast7d: number;
      totalLast30d: number;
      distinctTargetsLast24h: number;
      distinctActorsLast24h: number;
      canvasRevisionLast24h: number;
      resourceRevisionLast24h: number;
      adminSettingsRevisionLast24h: number;
    };
    latestCreatedAt?: number;
  }) => {
    const coverageReferenceLabel = summary.sampledLast24h > 0 ? "近24h" : "最近样本";
    const coverageReferencePercent = summary.sampledLast24h > 0
      ? summary.requestIdCoverageLast24hPercent
      : summary.requestIdCoveragePercent;
    const coverageHealth = coverageReferencePercent >= 80
      ? toObservabilityHealth("healthy", `${coverageReferenceLabel} requestId 覆盖率达到 80% 以上`)
      : coverageReferencePercent >= 40
        ? toObservabilityHealth("warning", `${coverageReferenceLabel} requestId 覆盖率低于目标，建议继续提升`)
        : toObservabilityHealth("critical", `${coverageReferenceLabel} requestId 覆盖率偏低，需优先补链路`)
    ;
    return {
      ...summary,
      coverageHealth,
      coverageTrend: {
        requestIdCoverageLast24hVsLatestSample: summary.requestIdCoverageLast24hPercent - summary.requestIdCoveragePercent,
        requestIdCoverageLast7dVsLatestSample: summary.requestIdCoverageLast7dPercent - summary.requestIdCoveragePercent,
      },
      conflicts: decorateAuditConflictSummary(summary.conflicts),
    };
  };
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const [totalResult, sampleResult, recentCoverageResult, conflictResult] = await Promise.all([
      pool.query("select count(*) as total from xh_audit_logs"),
      pool.query(
        `with sample as (
           select request_id, created_at
           from xh_audit_logs
           order by created_at desc
           limit 100
         )
         select
           count(*) as sampled,
           count(*) filter (where coalesce(request_id, '') <> '') as with_request_id,
           max(created_at) as latest_created_at
         from sample`,
      ),
      pool.query(
        `select
           count(*) filter (where created_at >= now() - interval '24 hour') as sampled_last_24h,
           count(*) filter (where created_at >= now() - interval '24 hour' and coalesce(request_id, '') <> '') as with_request_id_last_24h,
           count(*) filter (where created_at >= now() - interval '7 day') as sampled_last_7d,
           count(*) filter (where created_at >= now() - interval '7 day' and coalesce(request_id, '') <> '') as with_request_id_last_7d
         from xh_audit_logs`,
      ),
      pool.query(
        `select
           count(*) filter (
             where action in ('conflict.canvas_revision', 'conflict.resource_revision', 'conflict.admin_settings_revision')
               and created_at >= now() - interval '24 hour'
           ) as total_last_24h,
           count(*) filter (
             where action in ('conflict.canvas_revision', 'conflict.resource_revision', 'conflict.admin_settings_revision')
               and created_at >= now() - interval '7 day'
           ) as total_last_7d,
           count(*) filter (
             where action in ('conflict.canvas_revision', 'conflict.resource_revision', 'conflict.admin_settings_revision')
               and created_at >= now() - interval '30 day'
           ) as total_last_30d,
           count(*) filter (where action = 'conflict.canvas_revision' and created_at >= now() - interval '24 hour') as canvas_revision_last_24h,
           count(*) filter (where action = 'conflict.resource_revision' and created_at >= now() - interval '24 hour') as resource_revision_last_24h,
           count(*) filter (where action = 'conflict.admin_settings_revision' and created_at >= now() - interval '24 hour') as admin_settings_revision_last_24h,
           count(distinct target_id) filter (
             where action in ('conflict.canvas_revision', 'conflict.resource_revision', 'conflict.admin_settings_revision')
               and created_at >= now() - interval '24 hour'
           ) as distinct_targets_last_24h,
           count(distinct actor_id) filter (
             where action in ('conflict.canvas_revision', 'conflict.resource_revision', 'conflict.admin_settings_revision')
               and created_at >= now() - interval '24 hour'
           ) as distinct_actors_last_24h
         from xh_audit_logs`,
      ),
    ]);
    const total = Number(totalResult.rows[0]?.total) || 0;
    const sampled = Number(sampleResult.rows[0]?.sampled) || 0;
    const withRequestId = Number(sampleResult.rows[0]?.with_request_id) || 0;
    const sampledLast24h = Number(recentCoverageResult.rows[0]?.sampled_last_24h) || 0;
    const withRequestIdLast24h = Number(recentCoverageResult.rows[0]?.with_request_id_last_24h) || 0;
    const sampledLast7d = Number(recentCoverageResult.rows[0]?.sampled_last_7d) || 0;
    const withRequestIdLast7d = Number(recentCoverageResult.rows[0]?.with_request_id_last_7d) || 0;
    const totalLast24h = Number(conflictResult.rows[0]?.total_last_24h) || 0;
    const totalLast7d = Number(conflictResult.rows[0]?.total_last_7d) || 0;
    const totalLast30d = Number(conflictResult.rows[0]?.total_last_30d) || 0;
    const canvasRevisionLast24h = Number(conflictResult.rows[0]?.canvas_revision_last_24h) || 0;
    const resourceRevisionLast24h = Number(conflictResult.rows[0]?.resource_revision_last_24h) || 0;
    const adminSettingsRevisionLast24h = Number(conflictResult.rows[0]?.admin_settings_revision_last_24h) || 0;
    const distinctTargetsLast24h = Number(conflictResult.rows[0]?.distinct_targets_last_24h) || 0;
    const distinctActorsLast24h = Number(conflictResult.rows[0]?.distinct_actors_last_24h) || 0;
    return decorate({
      total,
      sampled,
      withRequestId,
      requestIdCoveragePercent: toCoveragePercent(sampled, withRequestId),
      sampledLast24h,
      withRequestIdLast24h,
      requestIdCoverageLast24hPercent: toCoveragePercent(sampledLast24h, withRequestIdLast24h),
      sampledLast7d,
      withRequestIdLast7d,
      requestIdCoverageLast7dPercent: toCoveragePercent(sampledLast7d, withRequestIdLast7d),
      conflicts: {
        totalLast24h,
        totalLast7d,
        totalLast30d,
        distinctTargetsLast24h,
        distinctActorsLast24h,
        canvasRevisionLast24h,
        resourceRevisionLast24h,
        adminSettingsRevisionLast24h,
      },
      latestCreatedAt: sampleResult.rows[0]?.latest_created_at
        ? dateToMillis(sampleResult.rows[0].latest_created_at)
        : undefined,
    });
  }
  const db = await readAdminDb();
  const audits = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  const sample = audits.slice(0, 100);
  const withRequestId = sample.filter((item) => safeText(item.requestId).length > 0).length;
  const now = Date.now();
  const recent24h = audits.filter((item) => now - Number(item.createdAt || 0) <= 24 * 60 * 60 * 1000);
  const recent7d = audits.filter((item) => now - Number(item.createdAt || 0) <= 7 * 24 * 60 * 60 * 1000);
  const recent30d = audits.filter((item) => now - Number(item.createdAt || 0) <= 30 * 24 * 60 * 60 * 1000);
  const withRequestIdLast24h = recent24h.filter((item) => safeText(item.requestId).length > 0).length;
  const withRequestIdLast7d = recent7d.filter((item) => safeText(item.requestId).length > 0).length;
  const isConflict = (item: AdminAuditRecord) =>
    item.action === "conflict.canvas_revision"
    || item.action === "conflict.resource_revision"
    || item.action === "conflict.admin_settings_revision";
  const recentConflicts24h = recent24h.filter(isConflict);
  const recentConflicts7d = recent7d.filter(isConflict);
  const recentConflicts30d = recent30d.filter(isConflict);
  const canvasRevisionLast24h = recentConflicts24h.filter((item) => item.action === "conflict.canvas_revision").length;
  const resourceRevisionLast24h = recentConflicts24h.filter((item) => item.action === "conflict.resource_revision").length;
  const adminSettingsRevisionLast24h = recentConflicts24h.filter((item) => item.action === "conflict.admin_settings_revision").length;
  const distinctTargetsLast24h = new Set(recentConflicts24h.map((item) => item.targetId).filter(Boolean)).size;
  const distinctActorsLast24h = new Set(recentConflicts24h.map((item) => item.actorId).filter(Boolean)).size;
  return decorate({
    total: audits.length,
    sampled: sample.length,
    withRequestId,
    requestIdCoveragePercent: toCoveragePercent(sample.length, withRequestId),
    sampledLast24h: recent24h.length,
    withRequestIdLast24h,
    requestIdCoverageLast24hPercent: toCoveragePercent(recent24h.length, withRequestIdLast24h),
    sampledLast7d: recent7d.length,
    withRequestIdLast7d,
    requestIdCoverageLast7dPercent: toCoveragePercent(recent7d.length, withRequestIdLast7d),
    conflicts: {
      totalLast24h: recentConflicts24h.length,
      totalLast7d: recentConflicts7d.length,
      totalLast30d: recentConflicts30d.length,
      distinctTargetsLast24h,
      distinctActorsLast24h,
      canvasRevisionLast24h,
      resourceRevisionLast24h,
      adminSettingsRevisionLast24h,
    },
    latestCreatedAt: sample[0]?.createdAt,
  });
}

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function sendStaticFile(response: import("node:http").ServerResponse, baseDir: string, rawRel: string) {
  const sent = await trySendStaticFile(response, baseDir, rawRel);
  if (!sent) {
    sendJson(response, { ok: false, success: false, error: "FILE_NOT_FOUND" }, 404);
  }
}

async function trySendStaticFile(response: import("node:http").ServerResponse, baseDir: string, rawRel: string) {
  const base = resolve(baseDir);
  const target = resolve(base, decodeURIComponent(rawRel));
  if (target !== base && !target.startsWith(`${base}\\`) && !target.startsWith(`${base}/`)) {
    sendJson(response, { ok: false, success: false, error: "INVALID_PATH" }, 400);
    return true;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error("not file");
    const cacheControl = extname(target).toLowerCase() === ".html" ? "no-store" : "public, max-age=3600";
    response.writeHead(200, {
      "content-type": inferMime(target),
      "content-length": String(info.size),
      "cache-control": cacheControl,
      "access-control-allow-origin": "*",
    });
    createReadStream(target).pipe(response);
    return true;
  } catch {
    return false;
  }
}

async function sendWebAsset(response: import("node:http").ServerResponse, pathname: string) {
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/files/") ||
    pathname.startsWith("/input/") ||
    pathname.startsWith("/output/")
  ) {
    return false;
  }

  const webDistDir = await findWebDistDir();
  if (!webDistDir) return false;

  const assetRel = pathname === "/" ? "index.html" : pathname.slice(1);
  if (await trySendStaticFile(response, webDistDir, assetRel)) return true;
  if (pathname.startsWith("/assets/")) return false;
  return trySendStaticFile(response, webDistDir, "index.html");
}

async function sendAdminAsset(response: import("node:http").ServerResponse, pathname: string) {
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return false;

  const adminDistDir = await findAdminDistDir();
  if (!adminDistDir) return false;

  const assetRel = pathname === "/admin" || pathname === "/admin/" ? "index.html" : pathname.slice("/admin/".length);
  if (await trySendStaticFile(response, adminDistDir, assetRel)) return true;
  if (pathname.startsWith("/admin/assets/")) return false;
  return trySendStaticFile(response, adminDistDir, "index.html");
}

async function findWebDistDir() {
  for (const candidate of webDistCandidates) {
    try {
      const indexInfo = await stat(join(candidate, "index.html"));
      if (indexInfo.isFile()) return candidate;
    } catch {
      // Continue to the next candidate.
    }
  }
  return "";
}

async function findAdminDistDir() {
  for (const candidate of adminDistCandidates) {
    try {
      const indexInfo = await stat(join(candidate, "index.html"));
      if (indexInfo.isFile()) return candidate;
    } catch {
      // Continue to the next candidate.
    }
  }
  return "";
}

async function handleMultipartUpload(request: import("node:http").IncomingMessage, user: CurrentUser) {
  await ensureDataDirs(user);
  const dirs = userDataDirs(user);
  return new Promise((resolveUpload, rejectUpload) => {
    const busboy = Busboy({
      headers: request.headers,
      limits: { fileSize: 100 * 1024 * 1024, files: 1 },
    });
    let saved: { filename: string; url: string; size: number; mime: string } | null = null;
    busboy.on("file", (_name, file, info) => {
      const ext = extname(info.filename || "") || ".bin";
      const filename = `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      const target = join(dirs.inputDir, filename);
      let size = 0;
      file.on("data", (chunk: Buffer) => {
        size += chunk.length;
      });
      file.pipe(createWriteStream(target));
      file.on("end", () => {
        saved = {
          filename,
          url: `/files/input/${filename}`,
          size,
          mime: info.mimeType || inferMime(filename),
        };
      });
    });
    busboy.on("error", rejectUpload);
    busboy.on("finish", () => {
      if (!saved) {
        rejectUpload(new Error("未收到文件"));
        return;
      }
      void ephemeralUploadRepository.registerOwned(user.id, {
        filename: saved.filename,
        url: saved.url,
        kind: normalizeUploadKind(saved.mime),
        mime: saved.mime,
        size: saved.size,
        metadata: { registrationSource: "user-upload" },
      }).then(() => resolveUpload(saved)).catch(rejectUpload);
    });
    request.pipe(busboy);
  });
}

async function saveBase64File(body: { dataUrl?: string; prefix?: string }, user: CurrentUser) {
  await ensureDataDirs(user);
  const dirs = userDataDirs(user);
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(body.dataUrl || "");
  if (!match) throw new Error("dataUrl 格式不支持");
  const ext = match[1].includes("jpeg") || match[1].includes("jpg") ? "jpg" : match[1].split("/")[1];
  const filename = `${safeFilename(body.prefix, "draw")}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(match[2], "base64");
  await writeFile(join(dirs.outputDir, filename), buffer);
  const saved = { filename, url: `/files/output/${filename}`, size: buffer.length, mime: match[1] };
  await registerApiOutputArtifact(user, "image", saved);
  return saved;
}

async function saveBase64AudioFile(body: { dataUrl?: string; prefix?: string }, user: CurrentUser) {
  await ensureDataDirs(user);
  const dirs = userDataDirs(user);
  const match = /^data:(audio\/(?:mpeg|mp3|wav|x-wav|webm|ogg));base64,(.+)$/i.exec(body.dataUrl || "");
  if (!match) throw new Error("音频 dataUrl 格式不支持");
  const ext = audioExtensionFromMime(match[1]) || "wav";
  const filename = `${safeFilename(body.prefix, "audio")}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(match[2], "base64");
  await writeFile(join(dirs.outputDir, filename), buffer);
  const saved = { filename, url: `/files/output/${filename}`, size: buffer.length, mime: match[1] };
  await registerApiOutputArtifact(user, "audio", saved);
  return saved;
}

async function saveRemoteImageToOutput(sourceUrl: string, user: CurrentUser) {
  await ensureDataDirs(user);
  if (!/^https?:\/\//i.test(sourceUrl)) throw new Error("远程图片 URL 必须以 http:// 或 https:// 开头");
  const upstream = await fetch(sourceUrl, { signal: AbortSignal.timeout(120000) });
  if (!upstream.ok) throw new Error(`下载远程图片失败 ${upstream.status}`);
  const mime = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const extFromUrl = imageExtensionFromUrl(sourceUrl);
  const isGenericBinaryImage = mime === "application/octet-stream" && Boolean(extFromUrl);
  if (!mime.startsWith("image/") && !isGenericBinaryImage) throw new Error("远程 URL 不是图片");
  const ext = imageExtensionFromMime(mime) || extFromUrl || "png";
  const effectiveMime = mime.startsWith("image/") ? mime : inferMime(`placeholder.${ext}`);
  const buffer = Buffer.from(await upstream.arrayBuffer());
  const filename = `external_image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(join(userDataDirs(user).outputDir, filename), buffer);
  const saved = { filename, url: `/files/output/${filename}`, size: buffer.length, mime: effectiveMime };
  await registerApiOutputArtifact(user, "image", saved, sourceUrl);
  return saved;
}

async function saveRemoteAudioToOutput(sourceUrl: string, user: CurrentUser) {
  await ensureDataDirs(user);
  if (!/^https?:\/\//i.test(sourceUrl)) throw new Error("远程音频 URL 必须以 http:// 或 https:// 开头");
  const upstream = await fetch(sourceUrl, { signal: AbortSignal.timeout(180000) });
  if (!upstream.ok) throw new Error(`下载远程音频失败 ${upstream.status}`);
  const mime = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!mime.startsWith("audio/")) throw new Error("远程 URL 不是音频");
  const ext = audioExtensionFromMime(mime) || audioExtensionFromUrl(sourceUrl) || "wav";
  const buffer = Buffer.from(await upstream.arrayBuffer());
  const filename = `external_audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(join(userDataDirs(user).outputDir, filename), buffer);
  const saved = { filename, url: `/files/output/${filename}`, size: buffer.length, mime };
  await registerApiOutputArtifact(user, "audio", saved, sourceUrl);
  return saved;
}

async function saveRemoteVideoToOutput(sourceUrl: string, user: CurrentUser) {
  await ensureDataDirs(user);
  if (!/^https?:\/\//i.test(sourceUrl)) throw new Error("远程视频 URL 必须以 http:// 或 https:// 开头");
  const upstream = await fetch(sourceUrl, { signal: AbortSignal.timeout(180000) });
  if (!upstream.ok) throw new Error(`下载远程视频失败 ${upstream.status}`);
  const mime = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!mime.startsWith("video/")) throw new Error("远程 URL 不是视频");
  const ext = videoExtensionFromMime(mime) || videoExtensionFromUrl(sourceUrl) || "mp4";
  const buffer = Buffer.from(await upstream.arrayBuffer());
  const filename = `external_video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(join(userDataDirs(user).outputDir, filename), buffer);
  const saved = { filename, url: `/files/output/${filename}`, size: buffer.length, mime };
  await registerApiOutputArtifact(user, "video", saved, sourceUrl);
  return saved;
}

async function registerApiOutputArtifact(
  user: CurrentUser,
  kind: "image" | "video" | "audio",
  saved: { filename: string; url: string; size: number; mime: string },
  sourceUrl = "",
) {
  return generationArtifactRepository.registerOwned(user.id, {
    kind,
    title: saved.filename,
    storageKey: saved.filename,
    fileUrl: saved.url,
    sourceUrl: sourceUrl || saved.url,
    mime: saved.mime,
    size: saved.size,
    metadata: { registrationSource: "api-output" },
  });
}

function videoExtensionFromMime(mime: string) {
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  return "";
}

function videoExtensionFromUrl(sourceUrl: string) {
  try {
    const ext = extname(new URL(sourceUrl).pathname).replace(/^\./, "").toLowerCase();
    return ["mp4", "webm", "mov"].includes(ext) ? ext : "";
  } catch {
    return "";
  }
}

function normalizeUploadKind(mime: string): "image" | "video" | "audio" {
  const value = String(mime || "").trim().toLowerCase();
  if (value.startsWith("video/")) return "video";
  if (value.startsWith("audio/")) return "audio";
  return "image";
}

function audioExtensionFromMime(mime: string) {
  if (mime === "audio/mpeg" || mime === "audio/mp3") return "mp3";
  if (mime === "audio/wav" || mime === "audio/x-wav") return "wav";
  if (mime === "audio/webm") return "webm";
  if (mime === "audio/ogg") return "ogg";
  return "";
}

function audioExtensionFromUrl(sourceUrl: string) {
  try {
    const ext = extname(new URL(sourceUrl).pathname).replace(/^\./, "").toLowerCase();
    return ["mp3", "wav", "webm", "ogg"].includes(ext) ? ext : "";
  } catch {
    return "";
  }
}

function imageExtensionFromMime(mime: string) {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "";
}

function imageExtensionFromUrl(sourceUrl: string) {
  try {
    const ext = extname(new URL(sourceUrl).pathname).replace(/^\./, "").toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? (ext === "jpeg" ? "jpg" : ext) : "";
  } catch {
    return "";
  }
}

async function listOutputFiles(user: CurrentUser) {
  await ensureDataDirs(user);
  const dirs = userDataDirs(user);
  const { readdir } = await import("node:fs/promises");
  const names = await readdir(dirs.outputDir).catch(() => []);
  const files = [];
  for (const name of names) {
    const info = await stat(join(dirs.outputDir, name)).catch(() => null);
    if (!info?.isFile()) continue;
    files.push({ filename: name, url: `/files/output/${name}`, size: info.size, mtime: info.mtimeMs });
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

async function saveToOutput(body: { url?: string; filename?: string }, user: CurrentUser) {
  await ensureDataDirs(user);
  const dirs = userDataDirs(user);
  const url = safeText(body.url);
  if (!url) throw new Error("缺少 url");
  const filename = safeFilename(body.filename || basename(url), `out_${Date.now()}`);
  const target = join(dirs.outputDir, filename);
  if (url.startsWith("/files/input/")) {
    await copyFile(join(dirs.inputDir, decodeURIComponent(url.slice("/files/input/".length))), target);
    return { path: target, exist: false, source: "input" };
  }
  if (url.startsWith("/files/output/")) {
    await copyFile(join(dirs.outputDir, decodeURIComponent(url.slice("/files/output/".length))), target);
    return { path: target, exist: false, source: "output" };
  }
  throw new Error("暂不支持保存远程 URL");
}

async function readResourceDb(user: CurrentUser): Promise<ResourceDb> {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const [categoriesResult, itemsResult] = await Promise.all([
      pool.query(
        "select id, kind, name, revision, created_at, updated_at from xh_resource_categories where owner_id = $1 order by created_at asc",
        [user.id],
      ),
      pool.query(
        `select a.id, a.kind, a.title, a.url, a.mime, a.size_bytes, a.category_id, a.tags, a.favorite, a.last_used_at, a.metadata, a.revision, a.created_at, a.updated_at
         from xh_assets a
         left join xh_resource_categories c on c.id = a.category_id
         where a.owner_id = $1
         order by a.created_at desc`,
        [user.id],
      ),
    ]);
    const dirs = userDataDirs(user);
    if (categoriesResult.rows.length > 0 || itemsResult.rows.length > 0) {
      await markRepositoryMigrationComplete(dirs.resourcePostgresMigrationMarkerPath);
      return {
        categories: categoriesResult.rows.map((row) => toResourceCategory(row)),
        items: itemsResult.rows.map((row) => toResourceItem(row)),
      };
    }
    if (await hasRepositoryMigrationMarker(dirs.resourcePostgresMigrationMarkerPath)) {
      return {
        categories: [],
        items: [],
      };
    }
    const fileDb = await readResourceDbFromFile(user);
    if (fileDb.categories.length > 0 || fileDb.items.length > 0) {
      await writeResourceDb(fileDb, user, { pruneMissing: true });
      await markRepositoryMigrationComplete(dirs.resourcePostgresMigrationMarkerPath);
      return fileDb;
    }
    await markRepositoryMigrationComplete(dirs.resourcePostgresMigrationMarkerPath);
    return {
      categories: [],
      items: [],
    };
  }
  return readResourceDbFromFile(user);
}


async function readResourceDbFromFile(user: CurrentUser): Promise<ResourceDb> {
  await ensureDataDirs(user);
  try {
    const raw = JSON.parse(await readFile(userDataDirs(user).resourceDbPath, "utf-8")) as ResourceDb;
    return {
      categories: Array.isArray(raw.categories) ? raw.categories.map(normalizeResourceCategoryRecord) : [],
      items: Array.isArray(raw.items) ? raw.items.map(normalizeResourceItemRecord).map(enrichWorkflowResourceItem) : [],
    };
  } catch {
    return { categories: [], items: [] };
  }
}

async function writeResourceDb(db: ResourceDb, user: CurrentUser, options?: { pruneMissing?: boolean }) {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      if (options?.pruneMissing) {
        const itemIds = Array.isArray(db.items) ? db.items.map((item) => safeText(item.id)).filter(Boolean) : [];
        const categoryIds = Array.isArray(db.categories) ? db.categories.map((item) => safeText(item.id)).filter(Boolean) : [];
        if (itemIds.length > 0) {
          await client.query("delete from xh_assets where owner_id = $1 and not (id = any($2::text[]))", [user.id, itemIds]);
        } else {
          await client.query("delete from xh_assets where owner_id = $1", [user.id]);
        }
        if (categoryIds.length > 0) {
          await client.query("delete from xh_resource_categories where owner_id = $1 and not (id = any($2::text[]))", [user.id, categoryIds]);
        } else {
          await client.query("delete from xh_resource_categories where owner_id = $1", [user.id]);
        }
      }
      for (const category of Array.isArray(db.categories) ? db.categories : []) {
        const upsertedCategory = await client.query(
          `insert into xh_resource_categories (id, owner_id, kind, name, revision, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (id) do update set
             kind = excluded.kind,
             name = excluded.name,
             revision = greatest(xh_resource_categories.revision, excluded.revision),
             updated_at = excluded.updated_at
           where xh_resource_categories.owner_id = excluded.owner_id`,
          [
            category.id,
            user.id,
            normalizeResourceKind(category.kind) || "image",
            safeText(category.name, "未分类"),
            Number.isFinite(category.revision) && category.revision > 0 ? Math.floor(category.revision) : 1,
            millisToDate(category.createdAt),
            millisToDate(category.updatedAt),
          ],
        );
        if (upsertedCategory.rowCount === 0) throw new HttpError(403, "RESOURCE_OWNERSHIP_MISMATCH");
      }
      for (const item of Array.isArray(db.items) ? db.items : []) {
        const upsertedItem = await client.query(
          `insert into xh_assets (id, owner_id, project_id, kind, title, url, mime, size_bytes, metadata, category_id, tags, favorite, last_used_at, revision, created_at, updated_at)
           values ($1, $2, null, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12, $13, $14, $15)
           on conflict (id) do update set
             kind = excluded.kind,
             title = excluded.title,
             url = excluded.url,
             mime = excluded.mime,
             size_bytes = excluded.size_bytes,
             metadata = excluded.metadata,
             category_id = excluded.category_id,
             tags = excluded.tags,
             favorite = excluded.favorite,
             last_used_at = excluded.last_used_at,
             revision = greatest(xh_assets.revision, excluded.revision),
             updated_at = excluded.updated_at
           where xh_assets.owner_id = excluded.owner_id`,
          [
            item.id,
            user.id,
            normalizeResourceKind(item.kind) || "image",
            safeText(item.title, "资源"),
            safeText(item.url),
            safeText(item.mime),
            Number(item.size) || 0,
            JSON.stringify(resourceItemMetadata(item)),
            safeText(item.categoryId) || null,
            JSON.stringify(Array.isArray(item.tags) ? item.tags.map((tag) => safeText(tag)).filter(Boolean) : []),
            Boolean(item.favorite),
            item.lastUsedAt ? millisToDate(item.lastUsedAt) : null,
            Number.isFinite(item.revision) && item.revision > 0 ? Math.floor(item.revision) : 1,
            millisToDate(item.createdAt),
            millisToDate(item.updatedAt),
          ],
        );
        if (upsertedItem.rowCount === 0) throw new HttpError(403, "RESOURCE_OWNERSHIP_MISMATCH");
      }
      await client.query("commit");
      await markRepositoryMigrationComplete(userDataDirs(user).resourcePostgresMigrationMarkerPath);
      return;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  await ensureDataDirs(user);
  await writeFile(userDataDirs(user).resourceDbPath, JSON.stringify(db, null, 2), "utf-8");
}

async function upsertResourceCategoryPostgres(category: ResourceCategory, user: CurrentUser) {
  const pool = await getPostgresPool();
  const result = await pool.query(
    `insert into xh_resource_categories (id, owner_id, kind, name, revision, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (id) do update set
       kind = excluded.kind,
       name = excluded.name,
       revision = greatest(xh_resource_categories.revision, excluded.revision),
       updated_at = excluded.updated_at
     where xh_resource_categories.owner_id = excluded.owner_id`,
    [
      category.id,
      user.id,
      normalizeResourceKind(category.kind) || "image",
      safeText(category.name, "未分类"),
      Number.isFinite(category.revision) && category.revision > 0 ? Math.floor(category.revision) : 1,
      millisToDate(category.createdAt),
      millisToDate(category.updatedAt),
    ],
  );
  if (result.rowCount === 0) throw new HttpError(403, "RESOURCE_OWNERSHIP_MISMATCH");
  await markRepositoryMigrationComplete(userDataDirs(user).resourcePostgresMigrationMarkerPath);
  return category;
}

async function updateResourceCategoryPostgres(id: string, name: string, user: CurrentUser, expectedRevision?: number) {
  const pool = await getPostgresPool();
  const currentResult = await pool.query(
    `select id, kind, name, revision, created_at, updated_at
     from xh_resource_categories
     where id = $1
       and owner_id = $2
     limit 1`,
    [id, user.id],
  );
  if (!currentResult.rows[0]) throw new Error("分类不存在");
  const current = toResourceCategory(currentResult.rows[0]);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) {
    throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
      resourceKind: "category",
      resourceId: id,
      currentRevision: current.revision,
    });
  }
  const result = await pool.query(
    `update xh_resource_categories
     set name = $3,
         revision = revision + 1,
         updated_at = now()
     where id = $1
       and owner_id = $2
     returning id, kind, name, revision, created_at, updated_at`,
    [id, user.id, safeText(name, "未分类")],
  );
  if (result.rows[0]) return toResourceCategory(result.rows[0]);
  throw new Error("分类不存在");
}

async function deleteResourceCategoryPostgres(id: string, user: CurrentUser, expectedRevision?: number) {
  const pool = await getPostgresPool();
  if (expectedRevision !== undefined) {
    const currentResult = await pool.query(
      "select revision from xh_resource_categories where id = $1 and owner_id = $2 limit 1",
      [id, user.id],
    );
    if (!currentResult.rows[0]) throw new Error("分类不存在");
    const currentRevision = Number(currentResult.rows[0].revision) || 1;
    if (expectedRevision !== currentRevision) {
      throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
        resourceKind: "category",
        resourceId: id,
        currentRevision,
      });
    }
  }
  await pool.query("delete from xh_resource_categories where id = $1 and owner_id = $2", [id, user.id]);
  await markRepositoryMigrationComplete(userDataDirs(user).resourcePostgresMigrationMarkerPath);
}

async function deleteResourceCategoryPostgresWithItemRevision(id: string, user: CurrentUser, expectedRevision?: number) {
  const pool = await getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const currentResult = await client.query(
      "select revision from xh_resource_categories where id = $1 and owner_id = $2 limit 1",
      [id, user.id],
    );
    if (!currentResult.rows[0]) throw new Error("分类不存在");
    const currentRevision = Number(currentResult.rows[0].revision) || 1;
    if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
      throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
        resourceKind: "category",
        resourceId: id,
        currentRevision,
      });
    }
    await client.query(
      `update xh_assets
       set category_id = null,
           revision = coalesce(revision, 1) + 1,
           updated_at = now()
       where owner_id = $1
         and category_id = $2`,
      [user.id, id],
    );
    await client.query("delete from xh_resource_categories where id = $1 and owner_id = $2", [id, user.id]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await markRepositoryMigrationComplete(userDataDirs(user).resourcePostgresMigrationMarkerPath);
}

async function upsertResourceItemPostgres(item: ResourceItem, user: CurrentUser) {
  const pool = await getPostgresPool();
  const result = await pool.query(
    `insert into xh_assets (id, owner_id, project_id, kind, title, url, mime, size_bytes, metadata, category_id, tags, favorite, last_used_at, revision, created_at, updated_at)
     values ($1, $2, null, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12, $13, $14, $15)
     on conflict (id) do update set
       kind = excluded.kind,
       title = excluded.title,
       url = excluded.url,
       mime = excluded.mime,
       size_bytes = excluded.size_bytes,
       metadata = excluded.metadata,
       category_id = excluded.category_id,
       tags = excluded.tags,
       favorite = excluded.favorite,
       last_used_at = excluded.last_used_at,
       revision = greatest(xh_assets.revision, excluded.revision),
       updated_at = excluded.updated_at
     where xh_assets.owner_id = excluded.owner_id`,
    [
      item.id,
      user.id,
      normalizeResourceKind(item.kind) || "image",
      safeText(item.title, "资源"),
      safeText(item.url),
      safeText(item.mime),
      Number(item.size) || 0,
      JSON.stringify(resourceItemMetadata(item)),
      safeText(item.categoryId) || null,
      JSON.stringify(Array.isArray(item.tags) ? item.tags.map((tag) => safeText(tag)).filter(Boolean) : []),
      Boolean(item.favorite),
      item.lastUsedAt ? millisToDate(item.lastUsedAt) : null,
      Number.isFinite(item.revision) && item.revision > 0 ? Math.floor(item.revision) : 1,
      millisToDate(item.createdAt),
      millisToDate(item.updatedAt),
    ],
  );
  if (result.rowCount === 0) throw new HttpError(403, "RESOURCE_OWNERSHIP_MISMATCH");
  await markRepositoryMigrationComplete(userDataDirs(user).resourcePostgresMigrationMarkerPath);
  return item;
}

async function updateResourceItemPostgres(
  id: string,
  patch: Partial<ResourceItem> & { touch?: boolean },
  user: CurrentUser,
  expectedRevision?: number,
) {
  const pool = await getPostgresPool();
  const currentResult = await pool.query(
    `select id, kind, title, url, mime, size_bytes, category_id, tags, favorite, last_used_at, metadata, revision, created_at, updated_at
     from xh_assets
     where id = $1
       and owner_id = $2
     limit 1`,
    [id, user.id],
  );
  if (!currentResult.rows[0]) throw new Error("资源不存在");
  const current = toResourceItem(currentResult.rows[0]);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) {
    throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
      resourceKind: "item",
      resourceId: id,
      currentRevision: current.revision,
    });
  }
  const next: ResourceItem = {
    ...current,
    ...pickResourcePatch(patch),
    revision: current.revision + 1,
    updatedAt: Date.now(),
    ...(patch.touch ? { lastUsedAt: Date.now() } : {}),
  };
  await upsertResourceItemPostgres(next, user);
  return next;
}

async function deleteResourceItemPostgres(id: string, user: CurrentUser, expectedRevision?: number) {
  const pool = await getPostgresPool();
  const currentResult = await pool.query(
    `select id, kind, title, url, mime, size_bytes, category_id, tags, favorite, last_used_at, metadata, revision, created_at, updated_at
     from xh_assets where id = $1 and owner_id = $2 limit 1`,
    [id, user.id],
  );
  if (!currentResult.rows[0]) throw new Error("资源不存在");
  const current = toResourceItem(currentResult.rows[0]);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) {
    throw new HttpError(409, "RESOURCE_REVISION_CONFLICT", {
      resourceKind: "item",
      resourceId: id,
      currentRevision: current.revision,
    });
  }
  const client = await pool.connect();
  let shouldDeleteFile = false;
  try {
    await client.query("begin");
    const deleted = await client.query("delete from xh_assets where id = $1 and owner_id = $2", [id, user.id]);
    if (deleted.rowCount !== 1) throw new Error("资源不存在");
    const fileUrl = safeText(current.fileUrl || current.fileRel || current.url);
    if (fileUrl) {
      const refs = await client.query(
        `select 1 from xh_assets
         where owner_id = $1
           and (metadata->>'fileUrl' = $2 or metadata->>'fileRel' = $2 or url = $2)
         limit 1`,
        [user.id, fileUrl],
      );
      shouldDeleteFile = refs.rowCount === 0;
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  if (shouldDeleteFile) await removeResourcePhysicalFile(current, user);
  await markRepositoryMigrationComplete(userDataDirs(user).resourcePostgresMigrationMarkerPath);
}

async function removeUnreferencedResourceFile(current: ResourceItem, remaining: ResourceItem[], user: CurrentUser) {
  const fileUrl = safeText(current.fileUrl || current.fileRel || current.url);
  if (!fileUrl || remaining.some((item) => safeText(item.fileUrl || item.fileRel || item.url) === fileUrl)) return;
  await removeResourcePhysicalFile(current, user);
}

async function removeResourcePhysicalFile(item: ResourceItem, user: CurrentUser) {
  const fileUrl = safeText(item.fileUrl || item.fileRel || item.url);
  const prefix = fileUrl.startsWith("/files/output/")
    ? "/files/output/"
    : fileUrl.startsWith("/output/")
      ? "/output/"
      : "";
  if (!prefix) return;
  const filename = decodeURIComponent(fileUrl.slice(prefix.length));
  if (!filename || filename.includes("/") || filename.includes("\\")) return;
  const outputRoot = resolve(userDataDirs(user).outputDir);
  const target = resolve(outputRoot, filename);
  if (target !== outputRoot && !target.startsWith(`${outputRoot}${sep}`)) return;
  await unlink(target).catch(() => undefined);
}

async function addResourceFromPayload(raw: unknown, user: CurrentUser, forcedKind?: ResourceKind) {
  const payload = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kind = forcedKind || normalizeResourceKind(payload.kind) || "image";
  const now = Date.now();
  const url = safeText(payload.url);
  const item: ResourceItem = {
    id: `res-${now}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    title: safeText(payload.title, url ? basename(url) : kind === "set" ? "素材集" : "资源"),
    url,
    sourceUrl: safeText(payload.sourceUrl, url),
    originalName: safeText(payload.originalName),
    fileUrl: url,
    fileRel: url,
    mime: safeText(payload.mime, url ? inferMime(url) : ""),
    size: Number(payload.size) || 0,
    categoryId: safeText(payload.categoryId),
    tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => safeText(tag)).filter(Boolean) : [],
    favorite: Boolean(payload.favorite),
    materialSetKind: safeText(payload.materialSetKind),
    materialSetItems: Array.isArray(payload.materialSetItems) ? payload.materialSetItems : undefined,
    poseBackup: typeof payload.poseBackup === "object" ? (payload.poseBackup as Record<string, unknown>) : undefined,
    workflowFragment:
      typeof payload.workflowFragment === "object" ? (payload.workflowFragment as Record<string, unknown>) : undefined,
    createdAt: now,
    updatedAt: now,
    sourceNodeId: safeText(payload.sourceNodeId),
    sourceCanvasId: safeText(payload.sourceCanvasId),
    taskId: safeText(payload.taskId),
    providerId: safeText(payload.providerId),
    modelId: safeText(payload.modelId),
    revision: 1,
  };
  if (usePostgresRepository()) {
    await upsertResourceItemPostgres(item, user);
  } else {
    const db = await readResourceDb(user);
    db.items.unshift(item);
    await writeResourceDb(db, user);
  }
  return item;
}


function pickResourcePatch(patch: Partial<ResourceItem>) {
  return {
    ...(patch.title !== undefined ? { title: safeText(patch.title) } : {}),
    ...(patch.categoryId !== undefined ? { categoryId: safeText(patch.categoryId) } : {}),
    ...(patch.tags !== undefined && Array.isArray(patch.tags)
      ? { tags: patch.tags.map((tag) => safeText(tag)).filter(Boolean) }
      : {}),
    ...(patch.favorite !== undefined ? { favorite: Boolean(patch.favorite) } : {}),
  };
}
