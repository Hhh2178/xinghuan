import { createHealthPayload, type AppEnvironment, type TaskStatus } from "@xinghuan/shared";
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
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import {
  inferMime,
  safeEmail,
  safeFilename,
  safeJsonText,
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
  applyTaskCancellation,
  assertTaskCancellable,
  createRetriedTask,
  taskCancellationPatch,
} from "./task-lifecycle.js";
import { createExternalProxyHandlers } from "./external-proxy.js";

const host = process.env.XINGHUAN_API_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.XINGHUAN_API_PORT ?? "18300", 10);
const environment = (process.env.XINGHUAN_APP_ENV ?? "local") as AppEnvironment;
const dataDir = process.env.XINGHUAN_DATA_DIR ?? join(process.cwd(), "data");
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
const storageDriver = process.env.XINGHUAN_STORAGE_DRIVER === "postgres" ? "postgres" : "file";
const redisUrl = process.env.XINGHUAN_REDIS_URL || process.env.REDIS_URL || "";
const taskQueueName = process.env.XINGHUAN_TASK_QUEUE || "xinghuan:tasks";
const GENERATION_LIBRARY_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const authDir = join(dataDir, "auth");
const adminDir = join(dataDir, "admin");
const usersDir = join(dataDir, "users");
const authDbPath = join(authDir, "auth.json");
const adminDbPath = join(adminDir, "admin.json");
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

const {
  generateExternalImageProxy,
  generateExternalChatProxy,
  generateExternalVideoProxy,
  generateExternalAudioProxy,
} = createExternalProxyHandlers({
  dataDir,
  normalizeProviderProtocol,
  normalizeCapability,
  providerModelHeaders,
  providerPlainApiKey: (provider) => providerPlainApiKey(provider as Partial<AdminProviderRecord> & { apiKey?: string }),
  readAdminDb,
  saveRemoteImageToOutput,
  saveRemoteVideoToOutput,
  saveRemoteAudioToOutput,
  saveBase64File,
  saveBase64AudioFile,
  secretKey,
  safeSlug,
  safeText,
  plainObject,
  stringMap,
  looksLikeHtml,
  clampInteger,
});

interface CanvasListItem {
  id: string;
  name: string;
  nodeCount: number;
  createdAt: number;
  updatedAt: number;
}

interface CanvasData {
  nodes: unknown[];
  edges: unknown[];
  viewport: { x: number; y: number; zoom: number };
  nextNodeSerialId?: number;
}

type ResourceKind = "image" | "video" | "audio" | "set" | "pose" | "workflow";
type GenerationLibraryKind = "image" | "video" | "audio";

interface ResourceCategory {
  id: string;
  kind: ResourceKind;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface ResourceItem {
  id: string;
  kind: ResourceKind;
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
}

interface ResourceDb {
  categories: ResourceCategory[];
  items: ResourceItem[];
}

interface GenerationLibraryItem {
  id: string;
  kind: GenerationLibraryKind;
  title: string;
  url: string;
  fileUrl: string;
  mime?: string;
  size?: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  taskId?: string;
  providerId?: string;
  modelId?: string;
}

interface GenerationLibraryDb {
  items: GenerationLibraryItem[];
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  passwordHash: string;
  passwordCipher?: string;
  disabled?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface SessionRecord {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

interface AuthDb {
  users: UserRecord[];
  sessions: SessionRecord[];
}

type CurrentUser = Pick<UserRecord, "id" | "email" | "name" | "role">;

type ModelCapability = "chat" | "image" | "video" | "audio";
type ProviderProtocol = "openai" | "gemini" | "runninghub" | "volcengine" | "apimart" | "custom" | "grsai_draw";

interface AdminProviderRecord {
  id: string;
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
  msLoras?: ModelScopeLora[];
  note?: string;
  createdAt: number;
  updatedAt: number;
}

interface RunningHubEntry {
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

interface RunningHubFieldDefinition {
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

interface ModelScopeLora {
  id: string;
  name?: string;
  targetModel: string;
  strength: number;
  enabled: boolean;
  note?: string;
}

interface AdminModelRecord {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capability: ModelCapability;
  enabled: boolean;
  inputProfile: string;
  inputCapabilities?: Record<string, unknown>;
  capabilityTags?: ModelCapabilityTag[];
  testState?: ModelTestState;
  parameterSchema: string;
  advancedConfig?: Record<string, unknown>;
  protocolOverride?: string;
  createdAt: number;
  updatedAt: number;
}

interface AdminTaskRecord {
  id: string;
  title: string;
  status: TaskStatus;
  ownerId?: string;
  providerId?: string;
  modelId?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  logs: string[];
  createdAt: number;
  updatedAt: number;
}

interface AdminDb {
  providers: AdminProviderRecord[];
  models: AdminModelRecord[];
  tasks: AdminTaskRecord[];
  auditLogs?: AdminAuditRecord[];
  assistantSettings?: AssistantSettingsRecord;
}

interface AdminAuditRecord {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: number;
}

interface AssistantFrontendSettingsRecord {
  enabled: boolean;
  title: string;
  hint: string;
  placeholder: string;
  allowWorkflowAttachment: boolean;
  allowNodeAttachment: boolean;
  allowMediaAttachment: boolean;
  persistMemory: false;
}

interface AssistantBackendSettingsRecord {
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

interface AssistantIntegrationSettingsRecord {
  kernel: "hermes" | "fallback";
  endpoint: string;
  endpointConfigured?: boolean;
  workspace: string;
  model: string;
  profile: string;
  persistMemory: boolean;
  strictMode: boolean;
}

interface AssistantSettingsRecord {
  frontend: AssistantFrontendSettingsRecord;
  backend: AssistantBackendSettingsRecord;
  integration: AssistantIntegrationSettingsRecord;
  updatedAt: number;
}

interface AssistantAnalyzeRequest {
  providerName?: string;
  baseUrl?: string;
  protocolHint?: string;
  capability?: string;
  modelId?: string;
  docUrl?: string;
  sampleRequest?: string;
  sampleResponse?: string;
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
}

interface AssistantAnalysisResult {
  mode: "hermes" | "fallback";
  summary: string;
  recommendedLayer: "default" | "advanced" | "adapter";
  protocol: string;
  asyncTask: boolean;
  chainTemplate?: string;
  chainTemplateVersion?: string;
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

interface AssistantChatResult {
  mode: "hermes" | "fallback";
  message: string;
  rawAssistant: string;
}

interface AssistantProcessEntry {
  label: string;
  content: string;
}

const assistantHermesSessionCache = new Map<string, { sessionId: string; updatedAt: number }>();
const ASSISTANT_HERMES_SESSION_TTL_MS = 1000 * 60 * 60 * 6;

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
  return name === item.name ? item : { ...item, name };
}

function sanitizeCanvasNodeData(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const source = data as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  let changed = false;
  for (const key of ["prompt", "text", "title", "content"] as const) {
    if (typeof source[key] !== "string") continue;
    const cleaned = sanitizeVisibleSeedText(source[key]);
    if (cleaned === source[key]) continue;
    next[key] = cleaned;
    changed = true;
  }
  return changed ? next : data;
}

function sanitizeCanvasNodes(nodes: unknown[]): unknown[] {
  let changed = false;
  const sanitized = nodes.map((node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const source = node as Record<string, unknown>;
    const nextData = sanitizeCanvasNodeData(source.data);
    if (nextData === source.data) return node;
    changed = true;
    return { ...source, data: nextData };
  });
  return changed ? sanitized : nodes;
}

function sanitizeAdminDbVisibleText(db: AdminDb): { db: AdminDb; changed: boolean } {
  let changed = false;
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
    db: changed ? { ...db, providers, models, tasks, auditLogs } : db,
    changed,
  };
}

const emptyCanvasData = (): CanvasData => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  nextNodeSerialId: 1,
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type",
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
      version: "0.1.0",
      environment,
      dataDir,
    });
    return;
  }

  if (url.pathname === "/api/version") {
    sendJson(response, createHealthPayload("xinghuan-api-version", environment));
    return;
  }

  try {
    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const user = await getCurrentUser(request);
      sendT8(response, { authenticated: Boolean(user), user });
      return;
    }

    if (url.pathname === "/api/auth/admin-me" && request.method === "GET") {
      const user = await getCurrentUser(request);
      const adminUser = user?.role === "admin" ? user : null;
      sendT8(response, { authenticated: Boolean(adminUser), user: adminUser });
      return;
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const body = await readJsonBody<{ email?: string; password?: string }>(request);
      const login = await loginUser(body.email, body.password);
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
      const login = await loginUser(body.email, body.password, { adminOnly: true });
      if (login === "ADMIN_REQUIRED") {
        sendJson(response, { ok: false, success: false, error: "ADMIN_REQUIRED" }, 403);
        return;
      }
      if (!login || typeof login === "string") {
        sendJson(response, { ok: false, success: false, error: "INVALID_CREDENTIALS" }, 401);
        return;
      }
      sendT8(response, { authenticated: true, user: toPublicUser(login.user) }, 200, {
        "set-cookie": buildSessionCookie(request, login.session.id),
      });
      return;
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      await logoutUser(request);
      sendT8(response, { authenticated: false }, 200, {
        "set-cookie": expireSessionCookie(request),
      });
      return;
    }

    const currentUser = await getCurrentUser(request);
    if (request.method === "GET" && url.pathname.startsWith("/api/provider-files/")) {
      await sendProviderFile(response, url);
      return;
    }

    if (isProtectedRequest(url.pathname) && !currentUser) {
      sendJson(response, { ok: false, success: false, error: "AUTH_REQUIRED" }, 401);
      return;
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (!currentUser || currentUser.role !== "admin") {
        sendJson(response, { ok: false, success: false, error: "ADMIN_REQUIRED" }, 403);
        return;
      }
      if (await handleAdminRequest(request, response, url, currentUser)) return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/files/input/")) {
      await sendStaticFile(response, userDataDirs(currentUser!).inputDir, url.pathname.slice("/files/input/".length));
      return;
    }

    if (url.pathname === "/api/assistant/chat" && request.method === "POST") {
      const body = await readJsonBody<AssistantChatRequest>(request);
      const result = await runAssistantChat({ ...body, scope: body.scope || "canvas" }, currentUser!);
      sendT8(response, result);
      return;
    }

    if (url.pathname === "/api/assistant/chat/stream" && request.method === "POST") {
      const body = await readJsonBody<AssistantChatRequest>(request);
      await streamAssistantChatResponse(response, { ...body, scope: body.scope || "canvas" }, currentUser!);
      return;
    }

    if (url.pathname === "/api/assistant/settings" && request.method === "GET") {
      const adminDb = await readAdminDb();
      sendT8(response, toPublicAssistantSettings(adminDb.assistantSettings || defaultAssistantSettings()));
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/files/output/")) {
      await sendStaticFile(response, userDataDirs(currentUser!).outputDir, url.pathname.slice("/files/output/".length));
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

    if (url.pathname === "/api/models" && request.method === "GET") {
      sendT8(response, await publicModelCatalog());
      return;
    }

    if (url.pathname === "/api/runninghub/catalog" && request.method === "GET") {
      sendT8(response, await publicRunningHubCatalog());
      return;
    }

    if (url.pathname === "/api/proxy/generation/cancel" && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const taskId = safeText(body.taskId);
      if (!taskId) throw new Error("缺少 taskId");
      const kind = safeText(body.kind, "generation");
      sendT8(response, {
        cancelled: true,
        upstream: false,
        taskId,
        kind,
        message: "已停止本地轮询；当前上游未配置可确认的取消接口。",
      });
      return;
    }

    if (url.pathname === "/api/proxy/external/image" && request.method === "POST") {
      sendT8(response, await generateExternalImageProxy(await readJsonBody(request), currentUser!, publicRequestOrigin(request)));
      return;
    }

    if (url.pathname === "/api/proxy/external/llm" && request.method === "POST") {
      sendT8(response, await generateExternalChatProxy(await readJsonBody(request), currentUser!, publicRequestOrigin(request)));
      return;
    }

    if (url.pathname === "/api/proxy/external/video" && request.method === "POST") {
      sendT8(response, await generateExternalVideoProxy(await readJsonBody(request), currentUser!, publicRequestOrigin(request)));
      return;
    }

    if (url.pathname === "/api/proxy/external/audio" && request.method === "POST") {
      sendT8(response, await generateExternalAudioProxy(await readJsonBody(request), currentUser!));
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
          createdAt: now,
          updatedAt: now,
        };
        const db = await readResourceDb(currentUser!);
        db.categories.push(category);
        await writeResourceDb(db, currentUser!);
        sendT8(response, category);
        return;
      }
    }

    const resourceCategoryMatch = url.pathname.match(/^\/api\/resources\/categories\/([^/]+)$/);
    if (resourceCategoryMatch) {
      const id = decodeURIComponent(resourceCategoryMatch[1]);
      const db = await readResourceDb(currentUser!);
      if (request.method === "PUT") {
        const body = await readJsonBody<{ name?: string }>(request);
        const updated = db.categories.map((item) =>
          item.id === id ? { ...item, name: safeText(body.name, item.name), updatedAt: Date.now() } : item,
        );
        await writeResourceDb({ ...db, categories: updated }, currentUser!);
        sendT8(response, updated.find((item) => item.id === id) ?? null);
        return;
      }
      if (request.method === "DELETE") {
        await writeResourceDb({
          categories: db.categories.filter((item) => item.id !== id),
          items: db.items.map((item) => (item.categoryId === id ? { ...item, categoryId: "" } : item)),
        }, currentUser!);
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
      const db = await readResourceDb(currentUser!);
      if (request.method === "PUT") {
        const patch = await readJsonBody<Partial<ResourceItem> & { touch?: boolean }>(request);
        const updated = db.items.map((item) =>
          item.id === id
            ? {
                ...item,
                ...pickResourcePatch(patch),
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
        await writeResourceDb({ ...db, items: db.items.filter((item) => item.id !== id) }, currentUser!);
        sendT8(response, null);
        return;
      }
    }

    if (url.pathname === "/api/generation-library/items") {
      const db = await readGenerationLibraryDb(currentUser!, { cleanup: true });
      if (request.method === "GET") {
        const kind = normalizeGenerationLibraryKind(url.searchParams.get("kind"));
        const q = safeText(url.searchParams.get("q"), "").toLowerCase();
        sendT8(
          response,
          db.items.filter((item) => {
            if (kind && item.kind !== kind) return false;
            if (q && !`${item.title} ${item.url}`.toLowerCase().includes(q)) return false;
            return true;
          }),
        );
        return;
      }
      if (request.method === "POST") {
        sendT8(response, await addGenerationLibraryItem(await readJsonBody(request), currentUser!, db));
        return;
      }
    }

    const generationLibraryItemMatch = url.pathname.match(/^\/api\/generation-library\/items\/([^/]+)$/);
    if (generationLibraryItemMatch) {
      const id = decodeURIComponent(generationLibraryItemMatch[1]);
      const db = await readGenerationLibraryDb(currentUser!, { cleanup: true });
      if (request.method === "DELETE") {
        const item = db.items.find((entry) => entry.id === id);
        await writeGenerationLibraryDb({ items: db.items.filter((entry) => entry.id !== id) }, currentUser!);
        if (item) await deleteGenerationLibraryLocalFile(item, currentUser!);
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
          createdAt: now,
          updatedAt: now,
        };
        const list = await readCanvasList(currentUser!);
        await writeCanvasData(id, emptyCanvasData(), currentUser!);
        await writeCanvasList([item, ...list], currentUser!);
        sendT8(response, item);
        return;
      }
    }

    const canvasNameMatch = url.pathname.match(/^\/api\/canvas\/([^/]+)\/name$/);
    if (canvasNameMatch && request.method === "PATCH") {
      const id = decodeURIComponent(canvasNameMatch[1]);
      const body = await readJsonBody<{ name?: string }>(request);
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
      const data = normalizeCanvasData(await readJsonBody(request));
      await writeCanvasAndUpdateList(id, data, currentUser!);
      sendT8(response, {
        path: canvasDataPath(id, currentUser!),
        nodeCount: data.nodes.length,
        edgeCount: data.edges.length,
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
        const data = normalizeCanvasData(await readJsonBody(request));
        await writeCanvasAndUpdateList(id, data, currentUser!);
        sendT8(response, {
          path: canvasDataPath(id, currentUser!),
          nodeCount: data.nodes.length,
          edgeCount: data.edges.length,
        });
        return;
      }
      if (request.method === "DELETE") {
        const list = await readCanvasList(currentUser!);
        await writeCanvasList(list.filter((item) => item.id !== id), currentUser!);
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
    sendJson(
      response,
      {
        ok: false,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

server.listen(port, host, () => {
  console.log(`xinghuan-api listening on http://${host}:${port}`);
});

async function handleAdminRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
  adminUser: CurrentUser,
) {
  if (url.pathname === "/api/admin/summary" && request.method === "GET") {
    const [authDb, adminDb, storage] = await Promise.all([readAuthDb(), readAdminDb(), readStorageStats()]);
    sendT8(response, {
      users: authDb.users.length,
      enabledUsers: authDb.users.filter((user) => !user.disabled).length,
      providers: adminDb.providers.length,
      enabledProviders: adminDb.providers.filter((provider) => provider.enabled).length,
      models: adminDb.models.length,
      enabledModels: adminDb.models.filter((model) => model.enabled).length,
      tasks: adminDb.tasks.length,
      runningTasks: adminDb.tasks.filter((task) => task.status === "queued" || task.status === "running").length,
      auditLogs: adminDb.auditLogs?.length || 0,
      storage,
      environment,
    });
    return true;
  }

  if (url.pathname === "/api/admin/users") {
    const authDb = await readAuthDb();
    if (request.method === "GET") {
      sendT8(response, authDb.users.map(toAdminUser));
      return true;
    }
    if (request.method === "POST") {
      const body = await readJsonBody<{ email?: string; name?: string; role?: string; password?: string }>(request);
      const email = safeEmail(body.email);
      if (!email) throw new Error("缺少邮箱");
      if (authDb.users.some((user) => user.email.toLowerCase() === email)) throw new Error("邮箱已存在");
      const now = Date.now();
      const rawPassword = String(body.password || randomToken(10));
      const user: UserRecord = {
        id: `usr-${now}-${Math.random().toString(36).slice(2, 8)}`,
        email,
        name: safeText(body.name, email.split("@")[0]),
        role: body.role === "admin" ? "admin" : "member",
        passwordHash: hashPassword(rawPassword),
        passwordCipher: encryptSecret(rawPassword),
        createdAt: now,
        updatedAt: now,
      };
      await writeAuthDb({ ...authDb, users: [user, ...authDb.users] });
      await appendAudit(adminUser, "user.create", "user", user.id, `创建用户 ${user.email}`);
      sendT8(response, toAdminUser(user));
      return true;
    }
  }

  const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch && request.method === "PATCH") {
    const id = decodeURIComponent(userMatch[1]);
    const body = await readJsonBody<{ email?: string; name?: string; role?: string; disabled?: boolean; password?: string }>(request);
    const authDb = await readAuthDb();
    let updatedUser: UserRecord | undefined;
    const users = authDb.users.map((user) => {
      if (user.id !== id) return user;
      const nextEmail = body.email === undefined ? user.email : safeEmail(body.email);
      if (!nextEmail) throw new Error("邮箱无效");
      const next: UserRecord = {
        ...user,
        email: nextEmail,
        name: body.name === undefined ? user.name : safeText(body.name, user.name),
        role: body.role === "admin" ? "admin" : body.role === "member" ? "member" : user.role,
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
    await writeAuthDb({
      ...authDb,
      users,
      sessions: authDb.sessions.filter((session) => session.userId !== id),
    });
    await appendAudit(adminUser, "user.update", "user", id, `更新用户 ${updatedUser.email}`);
    sendT8(response, toAdminUser(updatedUser));
    return true;
  }

  if (url.pathname === "/api/admin/providers") {
    const db = await readAdminDb();
    if (request.method === "GET") {
      sendT8(response, db.providers.map(toPublicProvider));
      return true;
    }
    if (request.method === "POST") {
      const body = await readJsonBody<Partial<AdminProviderRecord>>(request);
      const now = Date.now();
      const provider: AdminProviderRecord = {
        id: safeSlug(body.id, `provider-${now}`),
        name: safeText(body.name, "新服务商"),
        baseUrl: safeText(body.baseUrl),
        protocol: normalizeProviderProtocol(body.protocol),
        enabled: Boolean(body.enabled),
        apiKey: encryptSecret(safeText(body.apiKey)),
        apiKeyPreview: secretPreview(safeText(body.apiKey)),
        rhApps: normalizeRunningHubEntries(body.rhApps, "app"),
        rhWorkflows: normalizeRunningHubEntries(body.rhWorkflows, "workflow"),
        msLoras: normalizeModelScopeLoras(body.msLoras),
        note: safeText(body.note),
        createdAt: now,
        updatedAt: now,
      };
      if (db.providers.some((item) => item.id === provider.id)) throw new Error("Provider ID 已存在");
      await writeAdminDb({ ...db, providers: [provider, ...db.providers] });
      await appendAudit(adminUser, "provider.create", "provider", provider.id, `创建 Provider ${provider.name}`);
      sendT8(response, toPublicProvider(provider));
      return true;
    }
  }

  if (url.pathname === "/api/admin/providers/probe" && request.method === "POST") {
    const body = await readJsonBody<Partial<AdminProviderRecord> & { apiKey?: string }>(request);
    sendT8(response, await probeProviderDraft(body));
    return true;
  }

  if (url.pathname === "/api/admin/providers/fetch-models" && request.method === "POST") {
    const body = await readJsonBody<Partial<AdminProviderRecord> & { apiKey?: string }>(request);
    sendT8(response, await fetchProviderModelsDraft(body));
    return true;
  }

  const providerProbeMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/probe$/);
  if (providerProbeMatch && request.method === "POST") {
    const id = decodeURIComponent(providerProbeMatch[1]);
    const body = await readJsonBody<Partial<AdminProviderRecord> & { apiKey?: string }>(request);
    const db = await readAdminDb();
    const provider = db.providers.find((item) => item.id === id);
    if (!provider) throw new Error("Provider 不存在");
    const result = await probeProviderDraft({ ...provider, ...body });
    const now = Date.now();
    await updateProviderProbeResult(id, result, now);
    await appendAudit(adminUser, "provider.probe", "provider", id, `验证 Provider ${provider.name}: ${result.ok ? "ok" : "error"}`);
    sendT8(response, result);
    return true;
  }

  const providerFetchModelsMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/fetch-models$/);
  if (providerFetchModelsMatch && request.method === "POST") {
    const id = decodeURIComponent(providerFetchModelsMatch[1]);
    const body = await readJsonBody<Partial<AdminProviderRecord> & { apiKey?: string }>(request);
    const db = await readAdminDb();
    const provider = db.providers.find((item) => item.id === id);
    if (!provider) throw new Error("Provider 不存在");
    const result = await fetchProviderModelsDraft({ ...provider, ...body });
    const now = Date.now();
    await updateProviderLastFetchedAt(id, now);
    await appendAudit(adminUser, "provider.fetchModels", "provider", id, `拉取 Provider ${provider.name} 模型 ${result.total}`);
    sendT8(response, result);
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
    const nextModels = [...db.models];
    let imported = 0;
    for (const item of incoming) {
      const modelId = safeText(item.modelId);
      if (!modelId) continue;
      const capability = normalizeCapability(item.capability);
      const capabilityTags = normalizeModelCapabilityTags(
        item.capabilityTags === undefined ? inferModelCapabilityTags(modelId, capability) : item.capabilityTags,
        capability,
        modelId,
      );
      const id = safeSlug(`${providerId}-${capability}-${modelId}`, `model-${now}-${imported}`);
      const existingIndex = nextModels.findIndex((model) => model.providerId === providerId && model.modelId === modelId);
      const model: AdminModelRecord = {
        id: existingIndex >= 0 ? nextModels[existingIndex].id : id,
        providerId,
        modelId,
        displayName: safeText(item.displayName, modelId),
        capability,
        enabled: true,
        inputProfile:
          existingIndex >= 0
            ? nextModels[existingIndex].inputProfile
            : capability === "audio"
              ? "prompt,audio_reference"
            : capability === "image" || capability === "video"
              ? "prompt,image_reference"
              : "prompt",
        inputCapabilities:
          existingIndex >= 0
            ? plainObject(nextModels[existingIndex].inputCapabilities)
            : capability === "audio"
              ? { prompt: true, audioReference: capabilityTags.includes("voice_clone") }
            : capability === "video"
              ? { prompt: true, imageReference: true, multiImage: false, firstFrame: false, lastFrame: false }
              : capability === "image"
                ? { prompt: true, imageReference: true, multiImage: false, firstFrame: false, lastFrame: false }
                : {
                    prompt: true,
                    imageReference: capabilityTags.includes("image_understanding"),
                    videoReference: capabilityTags.includes("video_understanding"),
                    audioReference: capabilityTags.includes("audio_understanding"),
                    multiImage: false,
                    firstFrame: false,
                    lastFrame: false,
                  },
        capabilityTags: existingIndex >= 0
          ? normalizeModelCapabilityTags(nextModels[existingIndex].capabilityTags, capability, modelId)
          : capabilityTags,
        testState: existingIndex >= 0 ? normalizeModelTestState(nextModels[existingIndex].testState) : {},
        parameterSchema: existingIndex >= 0 ? nextModels[existingIndex].parameterSchema : "{}",
        advancedConfig: existingIndex >= 0 ? plainObject(nextModels[existingIndex].advancedConfig) : {},
        protocolOverride: normalizeOptionalProtocol(item.protocolOverride),
        createdAt: existingIndex >= 0 ? nextModels[existingIndex].createdAt : now,
        updatedAt: now,
      };
      if (existingIndex >= 0) nextModels[existingIndex] = normalizeAdminModelRecord({ ...nextModels[existingIndex], ...model });
      else nextModels.unshift(normalizeAdminModelRecord(model));
      imported += 1;
    }
    await writeAdminDb({ ...db, models: nextModels });
    await appendAudit(adminUser, "model.import", "provider", providerId, `导入模型 ${imported} 个`);
    sendT8(response, { imported, models: nextModels.filter((model) => model.providerId === providerId) });
    return true;
  }

  const providerMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)$/);
  if (providerMatch && request.method === "PATCH") {
    const id = decodeURIComponent(providerMatch[1]);
    const body = await readJsonBody<Partial<AdminProviderRecord> & { clearApiKey?: boolean }>(request);
    const db = await readAdminDb();
    let updated: AdminProviderRecord | undefined;
    const providers = db.providers.map((provider) => {
      if (provider.id !== id) return provider;
      const next: AdminProviderRecord = {
        ...provider,
        name: body.name === undefined ? provider.name : safeText(body.name, provider.name),
        baseUrl: body.baseUrl === undefined ? provider.baseUrl : safeText(body.baseUrl),
        protocol: body.protocol === undefined ? provider.protocol : normalizeProviderProtocol(body.protocol),
        enabled: body.enabled === undefined ? provider.enabled : Boolean(body.enabled),
        rhApps: body.rhApps === undefined ? provider.rhApps : normalizeRunningHubEntries(body.rhApps, "app"),
        rhWorkflows: body.rhWorkflows === undefined ? provider.rhWorkflows : normalizeRunningHubEntries(body.rhWorkflows, "workflow"),
        msLoras: body.msLoras === undefined ? provider.msLoras : normalizeModelScopeLoras(body.msLoras),
        note: body.note === undefined ? provider.note : safeText(body.note),
        updatedAt: Date.now(),
      };
      if (body.clearApiKey) {
        delete next.apiKey;
        delete next.apiKeyPreview;
      }
      if (body.apiKey) {
        const apiKey = safeText(body.apiKey);
        next.apiKey = encryptSecret(apiKey);
        next.apiKeyPreview = secretPreview(apiKey);
      }
      updated = next;
      return next;
    });
    if (!updated) throw new Error("Provider 不存在");
    await writeAdminDb({ ...db, providers });
    await appendAudit(adminUser, "provider.update", "provider", id, `更新 Provider ${updated.name}`);
    sendT8(response, toPublicProvider(updated));
    return true;
  }

  if (providerMatch && request.method === "DELETE") {
    const id = decodeURIComponent(providerMatch[1]);
    const db = await readAdminDb();
    const provider = db.providers.find((item) => item.id === id);
    if (!provider) throw new Error("Provider 不存在");
    const removedModelIds = new Set(db.models.filter((item) => item.providerId === id).map((item) => item.id));
    await writeAdminDb({
      ...db,
      providers: db.providers.filter((item) => item.id !== id),
      models: db.models.filter((item) => item.providerId !== id),
      tasks: db.tasks.map((task) =>
        task.providerId === id || (task.modelId && removedModelIds.has(task.modelId))
          ? { ...task, providerId: "", modelId: removedModelIds.has(task.modelId || "") ? "" : task.modelId }
          : task,
      ),
    });
    await appendAudit(adminUser, "provider.delete", "provider", id, `删除 Provider ${provider.name}`);
    sendT8(response, null);
    return true;
  }

  if (url.pathname === "/api/admin/models") {
    const db = await readAdminDb();
    if (request.method === "GET") {
      sendT8(response, db.models);
      return true;
    }
    if (request.method === "POST") {
      const body = await readJsonBody<Partial<AdminModelRecord>>(request);
      const now = Date.now();
      const model: AdminModelRecord = {
        id: safeSlug(body.id, `model-${now}`),
        providerId: safeSlug(body.providerId, "provider"),
        modelId: safeText(body.modelId, "model"),
        displayName: safeText(body.displayName, "新模型"),
        capability: normalizeCapability(body.capability),
        enabled: Boolean(body.enabled),
        inputProfile: safeText(body.inputProfile, "prompt"),
        inputCapabilities: { ...parseInputCapabilities(body.inputCapabilities, normalizeCapability(body.capability)) },
        capabilityTags: normalizeModelCapabilityTags(body.capabilityTags, normalizeCapability(body.capability), body.modelId),
        testState: normalizeModelTestState(body.testState),
        parameterSchema: safeJsonText(body.parameterSchema, "{}"),
        advancedConfig: parseAdvancedConfig(body.advancedConfig),
        protocolOverride: normalizeOptionalProtocol(body.protocolOverride),
        createdAt: now,
        updatedAt: now,
      };
      if (db.models.some((item) => item.id === model.id)) throw new Error("模型 ID 已存在");
      const normalizedModel = normalizeAdminModelRecord(model);
      await writeAdminDb({ ...db, models: [normalizedModel, ...db.models] });
      await appendAudit(adminUser, "model.create", "model", normalizedModel.id, `创建模型 ${normalizedModel.displayName}`);
      sendT8(response, normalizedModel);
      return true;
    }
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
    await writeAdminDb({ ...db, models });
    await appendAudit(adminUser, "model.test", "model", id, `测试模型 ${model.displayName}: ${result.test.ok ? "ok" : "error"}`);
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
      const next: AdminModelRecord = {
        ...model,
        providerId: body.providerId === undefined ? model.providerId : safeSlug(body.providerId, model.providerId),
        modelId: body.modelId === undefined ? model.modelId : safeText(body.modelId, model.modelId),
        displayName: body.displayName === undefined ? model.displayName : safeText(body.displayName, model.displayName),
        capability: body.capability === undefined ? model.capability : normalizeCapability(body.capability),
        enabled: body.enabled === undefined ? model.enabled : Boolean(body.enabled),
        inputProfile: body.inputProfile === undefined ? model.inputProfile : safeText(body.inputProfile, model.inputProfile),
        inputCapabilities:
          body.inputCapabilities === undefined
            ? plainObject(model.inputCapabilities)
            : { ...parseInputCapabilities(body.inputCapabilities, body.capability === undefined ? model.capability : normalizeCapability(body.capability)) },
        capabilityTags: body.capabilityTags === undefined
          ? normalizeModelCapabilityTags(model.capabilityTags, body.capability === undefined ? model.capability : normalizeCapability(body.capability), body.modelId === undefined ? model.modelId : body.modelId)
          : normalizeModelCapabilityTags(body.capabilityTags, body.capability === undefined ? model.capability : normalizeCapability(body.capability), body.modelId === undefined ? model.modelId : body.modelId),
        testState: body.testState === undefined ? normalizeModelTestState(model.testState) : normalizeModelTestState(body.testState),
        parameterSchema: body.parameterSchema === undefined ? model.parameterSchema : safeJsonText(body.parameterSchema, "{}"),
        advancedConfig: body.advancedConfig === undefined ? plainObject(model.advancedConfig) : parseAdvancedConfig(body.advancedConfig),
        protocolOverride: body.protocolOverride === undefined ? model.protocolOverride : normalizeOptionalProtocol(body.protocolOverride),
        updatedAt: Date.now(),
      };
      updated = normalizeAdminModelRecord(next);
      return updated;
    });
    if (!updated) throw new Error("模型不存在");
    await writeAdminDb({ ...db, models });
    await appendAudit(adminUser, "model.update", "model", id, `更新模型 ${updated.displayName}`);
    sendT8(response, updated);
    return true;
  }

  if (modelMatch && request.method === "DELETE") {
    const id = decodeURIComponent(modelMatch[1]);
    const db = await readAdminDb();
    const model = db.models.find((item) => item.id === id);
    if (!model) throw new Error("模型不存在");
    await writeAdminDb({
      ...db,
      models: db.models.filter((item) => item.id !== id),
      tasks: db.tasks.map((task) => (task.modelId === id ? { ...task, modelId: "" } : task)),
    });
    await appendAudit(adminUser, "model.delete", "model", id, `删除模型 ${model.displayName}`);
    sendT8(response, null);
    return true;
  }

  if (url.pathname === "/api/admin/tasks") {
    const db = await readAdminDb();
    if (request.method === "GET") {
      sendT8(response, db.tasks);
      return true;
    }
    if (request.method === "POST") {
      const body = await readJsonBody<Partial<AdminTaskRecord>>(request);
      const now = Date.now();
      const task: AdminTaskRecord = {
        id: `task-${now}-${Math.random().toString(36).slice(2, 8)}`,
        title: safeText(body.title, "后台任务"),
        status: normalizeTaskStatus(body.status),
        ownerId: safeText(body.ownerId, adminUser.id),
        providerId: safeText(body.providerId),
        modelId: safeText(body.modelId),
        payload: plainObject(body.payload),
        result: plainObject(body.result),
        logs: Array.isArray(body.logs) ? body.logs.map((line) => safeText(line)).filter(Boolean) : ["任务由后台创建"],
        createdAt: now,
        updatedAt: now,
      };
      await insertTaskRecord(task);
      const queueResult = task.status === "queued" ? await enqueueTask(task.id) : { queued: false, reason: "not_queued_status" };
      const queueLog = queueResult.queued ? `已进入 Redis 队列 ${taskQueueName}` : `未进入 Redis 队列: ${queueResult.reason}`;
      await appendTaskLog(task.id, queueLog);
      const queuedTask: AdminTaskRecord = {
        ...task,
        logs: [...task.logs, queueLog],
        updatedAt: Date.now(),
      };
      await appendAudit(adminUser, "task.create", "task", task.id, `创建任务 ${task.title}`);
      sendT8(response, queuedTask);
      return true;
    }
  }

  const retryMatch = url.pathname.match(/^\/api\/admin\/tasks\/([^/]+)\/retry$/);
  if (retryMatch && request.method === "POST") {
    const id = decodeURIComponent(retryMatch[1]);
    const originalTask = await readTaskRecord(id);
    if (!originalTask) throw new Error("任务不存在");
    const now = Date.now();
    const retriedTask = createRetriedTask(originalTask, {
      id: `task-${now}-${Math.random().toString(36).slice(2, 8)}`,
      ownerId: adminUser.id,
      now,
    });
    await insertTaskRecord(retriedTask);
    await appendTaskLog(id, `管理员发起重试，创建新任务 ${retriedTask.id}`);
    const queueResult = await enqueueTask(retriedTask.id);
    const queueLog = queueResult.queued ? `已进入 Redis 队列 ${taskQueueName}` : `未进入 Redis 队列: ${queueResult.reason}`;
    await appendTaskLog(retriedTask.id, queueLog);
    retriedTask.logs = [...retriedTask.logs, queueLog];
    retriedTask.updatedAt = Date.now();
    await appendAudit(adminUser, "task.retry", "task", id, `重试任务 ${originalTask.title}，新任务 ${retriedTask.id}`);
    sendT8(response, retriedTask);
    return true;
  }

  const taskMatch = url.pathname.match(/^\/api\/admin\/tasks\/([^/]+)$/);
  if (taskMatch && request.method === "PATCH") {
    const id = decodeURIComponent(taskMatch[1]);
    const body = await readJsonBody<Partial<AdminTaskRecord> & { action?: string }>(request);
    let updated: AdminTaskRecord | null = null;
    if (body.action === "cancel") {
      updated = await cancelTaskRecord(id, adminUser.email);
      if (!updated) throw new Error("任务不存在");
      await appendAudit(adminUser, "task.cancel", "task", id, `取消任务 ${updated.title}`);
      sendT8(response, updated);
      return true;
    }
    if (body.status !== undefined) {
      throw new Error("任务状态不能直接修改，请使用取消或重试动作");
    }
    const currentTask = await readTaskRecord(id);
    if (!currentTask) throw new Error("任务不存在");
    updated = {
      ...currentTask,
      title: body.title === undefined ? currentTask.title : safeText(body.title, currentTask.title),
      payload: body.payload === undefined ? currentTask.payload : plainObject(body.payload),
      result: body.result === undefined ? currentTask.result : plainObject(body.result),
      logs: body.logs === undefined ? currentTask.logs : body.logs.map((line) => safeText(line)).filter(Boolean),
      updatedAt: Date.now(),
    };
    await writeTaskRecord(updated);
    if (!updated) throw new Error("任务不存在");
    await appendAudit(adminUser, "task.update", "task", id, `更新任务 ${updated.title}`);
    sendT8(response, updated);
    return true;
  }

  if (url.pathname === "/api/admin/system" && request.method === "GET") {
    sendT8(response, {
      environment,
      dataDir,
      database: await readDatabaseStatus(),
      redis: await readRedisStatus(),
      storageDriver,
      authDbPath,
      adminDbPath,
      service: "xinghuan-api",
      version: "0.1.0",
      storage: await readStorageStats(),
    });
    return true;
  }

  if (url.pathname === "/api/admin/audit" && request.method === "GET") {
    const db = await readAdminDb();
    sendT8(response, (db.auditLogs || []).slice(0, 200));
    return true;
  }

  if (url.pathname === "/api/admin/assistant/analyze-provider" && request.method === "POST") {
    const body = await readJsonBody<AssistantAnalyzeRequest>(request);
    const result = await analyzeProviderAssistant(body);
    await appendAudit(
      adminUser,
      "assistant.analyzeProvider",
      "assistant",
      safeText(body.providerName || body.baseUrl || body.modelId, "provider-analysis"),
      `AI 助手分析 ${safeText(body.providerName || body.modelId || "未命名服务商")}`,
    );
    sendT8(response, result);
    return true;
  }

  if (url.pathname === "/api/admin/assistant/settings") {
    if (request.method === "GET") {
      const db = await readAdminDb();
      sendT8(response, maskAssistantEndpoint(db.assistantSettings || defaultAssistantSettings()));
      return true;
    }
    if (request.method === "PATCH") {
      const body = await readJsonBody<Partial<AssistantSettingsRecord>>(request);
      const db = await readAdminDb();
      const settings = normalizeAssistantSettings(body, db.assistantSettings || defaultAssistantSettings());
      await writeAssistantSettingsRecord(settings);
      await appendAudit(adminUser, "assistant.settings.update", "assistant", "assistant-settings", "更新 AI 助手接入与显示设置");
      sendT8(response, maskAssistantEndpoint(settings));
      return true;
    }
  }

    if (url.pathname === "/api/admin/assistant/chat" && request.method === "POST") {
      const body = await readJsonBody<AssistantChatRequest>(request);
      const result = await runAssistantChat({ ...body, scope: "admin" }, adminUser);
      await appendAudit(
        adminUser,
        "assistant.chat",
      "assistant",
      safeText(body.scope || "admin", "assistant-chat"),
      `AI 助手对话 ${safeText((body.message || "").slice(0, 48) || "空消息")}`,
    );
    sendT8(response, result);
    return true;
  }

  if (url.pathname === "/api/admin/assistant/chat/stream" && request.method === "POST") {
    const body = await readJsonBody<AssistantChatRequest>(request);
    await streamAssistantChatResponse(response, { ...body, scope: "admin" }, adminUser);
    await appendAudit(
      adminUser,
      "assistant.chat",
      "assistant",
      "admin",
      `AI 助手对话 ${safeText((body.message || "").slice(0, 48) || "空消息")}`,
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
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-credentials": "true",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function sendT8(
  response: import("node:http").ServerResponse,
  data: unknown,
  statusCode = 200,
  headers: Record<string, string> = {},
) {
  sendJson(response, { success: true, data }, statusCode, headers);
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
  return {
    baseDir,
    canvasDir,
    inputDir,
    outputDir,
    resourceDir,
    canvasListPath: join(canvasDir, "canvas-list.json"),
    resourceDbPath: join(resourceDir, "resource-library.json"),
    generationLibraryDbPath: join(resourceDir, "generation-library.json"),
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
      "select id, name, node_count, created_at, updated_at from xh_canvases where owner_id = $1 order by updated_at desc, created_at desc",
      [user.id],
    );
    if (result.rows.length > 0) return result.rows.map((row) => sanitizeCanvasListItem(toCanvasListItem(row)));
    const fileList = await readCanvasListFromFile(user);
    if (fileList.length > 0) {
      await writeCanvasList(fileList, user);
      return fileList;
    }
    return [];
  }
  return readCanvasListFromFile(user);
}

async function writeCanvasList(list: CanvasListItem[], user: CurrentUser) {
  const sanitizedList = list.map(sanitizeCanvasListItem);
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const existingResult = await client.query("select id, data from xh_canvases where owner_id = $1", [user.id]);
      const dataById = new Map(existingResult.rows.map((row) => [String(row.id), normalizeCanvasData(row.data)]));
      const ids = sanitizedList.map((item) => item.id);
      if (ids.length > 0) {
        await client.query("delete from xh_canvases where owner_id = $1 and not (id = any($2::text[]))", [user.id, ids]);
      } else {
        await client.query("delete from xh_canvases where owner_id = $1", [user.id]);
      }
      for (const item of sanitizedList) {
        const canvasData = dataById.get(item.id) || (await readCanvasDataFromFile(item.id, user));
        await client.query(
          `insert into xh_canvases (id, owner_id, project_id, name, node_count, data, created_at, updated_at)
           values ($1, $2, null, $3, $4, $5::jsonb, $6, $7)
           on conflict (id) do update
             set owner_id = excluded.owner_id,
                 name = excluded.name,
                 node_count = excluded.node_count,
                 data = excluded.data,
                 updated_at = excluded.updated_at`,
          [
            item.id,
            user.id,
            item.name,
            Number.isFinite(item.nodeCount) ? item.nodeCount : 0,
            JSON.stringify(canvasData),
            millisToDate(item.createdAt),
            millisToDate(item.updatedAt),
          ],
        );
      }
      await client.query("commit");
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
    const result = await pool.query("select data from xh_canvases where id = $1 and owner_id = $2 limit 1", [id, user.id]);
    if (result.rows[0]) return normalizeCanvasData(result.rows[0].data);
    const fileData = await readCanvasDataFromFile(id, user);
    if (fileData.nodes.length > 0 || fileData.edges.length > 0 || fileData.nextNodeSerialId !== 1) {
      await writeCanvasData(id, fileData, user);
      return fileData;
    }
    return emptyCanvasData();
  }
  return readCanvasDataFromFile(id, user);
}

async function writeCanvasData(id: string, data: CanvasData, user: CurrentUser) {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const existing = await pool.query("select name, created_at from xh_canvases where id = $1 and owner_id = $2 limit 1", [id, user.id]);
    const fileList = existing.rows[0] ? [] : await readCanvasListFromFile(user);
    const fileItem = fileList.find((item) => item.id === id);
    const now = Date.now();
    await pool.query(
      `insert into xh_canvases (id, owner_id, project_id, name, node_count, data, created_at, updated_at)
       values ($1, $2, null, $3, $4, $5::jsonb, $6, $7)
       on conflict (id) do update
         set owner_id = excluded.owner_id,
             name = excluded.name,
             node_count = excluded.node_count,
             data = excluded.data,
             updated_at = excluded.updated_at`,
      [
        id,
        user.id,
        safeText(existing.rows[0]?.name || fileItem?.name, "未命名画布"),
        data.nodes.length,
        JSON.stringify(normalizeCanvasData(data)),
        millisToDate(existing.rows[0] ? dateToMillis(existing.rows[0].created_at) : fileItem?.createdAt || now),
        millisToDate(now),
      ],
    );
    return;
  }
  await ensureDataDirs(user);
  await writeFile(canvasDataPath(id, user), JSON.stringify(data, null, 2), "utf-8");
}

async function writeCanvasAndUpdateList(id: string, data: CanvasData, user: CurrentUser) {
  if (usePostgresRepository()) {
    await writeCanvasData(id, data, user);
    return;
  }
  await writeCanvasData(id, data, user);
  const now = Date.now();
  const list = await readCanvasList(user);
  const existing = list.find((item) => item.id === id);
  const item: CanvasListItem = {
    id,
    name: existing?.name || "未命名画布",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    nodeCount: data.nodes.length,
  };
  await writeCanvasList([item, ...list.filter((entry) => entry.id !== id)], user);
}

function normalizeCanvasData(value: unknown): CanvasData {
  const data = (value && typeof value === "object" ? value : {}) as Partial<CanvasData>;
  return {
    nodes: sanitizeCanvasNodes(Array.isArray(data.nodes) ? data.nodes : []),
    edges: Array.isArray(data.edges) ? data.edges : [],
    viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
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
    db = { users: [], sessions: [] };
  }
  const bootstrapped = await ensureBootstrapUser(db);
  const now = Date.now();
  const cleaned = {
    users: bootstrapped.users,
    sessions: bootstrapped.sessions.filter((session) => session.expiresAt > now),
  };
  if (cleaned.sessions.length !== bootstrapped.sessions.length || bootstrapped !== db) {
    await writeAuthDb(cleaned);
  }
  return cleaned;
}

async function writeAuthDb(db: AuthDb) {
  if (usePostgresRepository()) {
    await writeAuthDbPostgres(db);
    return;
  }
  await ensureDataDirs();
  await writeFile(authDbPath, JSON.stringify(db, null, 2), "utf-8");
}

async function readAdminDb(): Promise<AdminDb> {
  let db: AdminDb;
  if (usePostgresRepository()) {
    db = await readAdminDbPostgres();
  } else {
    await ensureDataDirs();
    try {
      db = JSON.parse(await readFile(adminDbPath, "utf-8")) as AdminDb;
    } catch {
      db = defaultAdminDb();
      await writeAdminDb(db);
    }
  }
  let secretMigrated = false;
  const providers = Array.isArray(db.providers)
    ? db.providers.map((provider) => {
        const normalized = normalizeProviderSecret(provider);
        if (normalized !== provider) secretMigrated = true;
        return normalized;
      })
    : [];
  const normalizedDb = {
    providers,
    models: Array.isArray(db.models) ? db.models.map((model) => normalizeAdminModelRecord(model)) : [],
    tasks: Array.isArray(db.tasks) ? db.tasks : [],
    auditLogs: Array.isArray(db.auditLogs) ? db.auditLogs : [],
    assistantSettings: normalizeAssistantSettings(db.assistantSettings),
  };
  const modelMigrated = Array.isArray(db.models) && db.models.some((model, index) => normalizedDb.models[index] !== model);
  const assistantMigrated = normalizedDb.assistantSettings !== db.assistantSettings;
  const visibleSanitized = sanitizeAdminDbVisibleText(normalizedDb);
  if (!usePostgresRepository() && (secretMigrated || modelMigrated || assistantMigrated || visibleSanitized.changed)) {
    await writeAdminDb(visibleSanitized.db);
  }
  return visibleSanitized.db;
}

async function writeAdminDb(db: AdminDb) {
  if (usePostgresRepository()) {
    await writeAdminDbPostgres(db);
    return;
  }
  await ensureDataDirs();
  await writeFile(adminDbPath, JSON.stringify(db, null, 2), "utf-8");
}

async function writeAssistantSettingsRecord(settings: AssistantSettingsRecord) {
  const normalized = normalizeAssistantSettings(settings);
  if (usePostgresRepository()) {
    await writeAssistantSettingsRecordPostgres(normalized);
    return;
  }
  const db = await readAdminDb();
  await ensureDataDirs();
  await writeFile(
    adminDbPath,
    JSON.stringify(
      {
        ...db,
        assistantSettings: normalized,
      },
      null,
      2,
    ),
    "utf-8",
  );
}

function usePostgresRepository() {
  return storageDriver === "postgres" && Boolean(databaseUrl);
}

let postgresPoolPromise: Promise<import("pg").Pool> | null = null;
let redisClientPromise: Promise<import("redis").RedisClientType> | null = null;

async function getPostgresPool() {
  if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");
  postgresPoolPromise ??= import("pg").then((pg) => {
    const Pool = pg.Pool;
    return new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3000,
      max: 5,
    });
  });
  return postgresPoolPromise;
}

async function readAuthDbPostgres(): Promise<AuthDb> {
  const pool = await getPostgresPool();
  const [usersResult, sessionsResult] = await Promise.all([
    pool.query(
      "select id, email, name, role, password_hash, password_cipher, disabled, created_at, updated_at from xh_users order by created_at asc",
    ),
    pool.query("select id, user_id, created_at, expires_at from xh_sessions order by created_at desc"),
  ]);
  const db: AuthDb = {
    users: usersResult.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role === "admin" ? "admin" : "member",
      passwordHash: row.password_hash,
      passwordCipher: row.password_cipher || undefined,
      disabled: Boolean(row.disabled),
      createdAt: dateToMillis(row.created_at),
      updatedAt: dateToMillis(row.updated_at),
    })),
    sessions: sessionsResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      createdAt: dateToMillis(row.created_at),
      expiresAt: dateToMillis(row.expires_at),
    })),
  };
  const bootstrapped = await ensureBootstrapUser(db);
  const now = Date.now();
  const cleaned: AuthDb = {
    users: bootstrapped.users,
    sessions: bootstrapped.sessions.filter((session) => session.expiresAt > now),
  };
  if (cleaned.sessions.length !== bootstrapped.sessions.length || bootstrapped !== db) {
    await writeAuthDbPostgres(cleaned);
  }
  return cleaned;
}

async function writeAuthDbPostgres(db: AuthDb) {
  const pool = await getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from xh_sessions");
    await client.query("delete from xh_users");
    for (const user of db.users) {
      await client.query(
        `insert into xh_users (id, email, name, role, password_hash, password_cipher, disabled, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          user.id,
          user.email,
          user.name,
          user.role,
          user.passwordHash,
          user.passwordCipher || null,
          Boolean(user.disabled),
          millisToDate(user.createdAt),
          millisToDate(user.updatedAt),
        ],
      );
    }
    for (const session of db.sessions) {
      await client.query(
        `insert into xh_sessions (id, user_id, created_at, expires_at)
         values ($1, $2, $3, $4)`,
        [session.id, session.userId, millisToDate(session.createdAt), millisToDate(session.expiresAt)],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function readAdminDbPostgres(): Promise<AdminDb> {
  const pool = await getPostgresPool();
  const [providersResult, modelsResult, tasksResult, auditResult, assistantSettingsResult] = await Promise.all([
    pool.query("select id, name, base_url, protocol, enabled, api_key_cipher, api_key_preview, last_probe_status, last_probe_message, last_fetched_at, rh_apps, rh_workflows, ms_loras, note, created_at, updated_at from xh_providers order by created_at desc"),
    pool.query(
      "select id, provider_id, model_id, display_name, capability, enabled, input_profile, input_capabilities, capability_tags, test_state, parameter_schema, advanced_config, protocol_override, created_at, updated_at from xh_models order by created_at desc",
    ),
    pool.query("select id, owner_id, title, status, provider_id, model_id, payload, result, logs, created_at, updated_at from xh_tasks order by created_at desc"),
    pool.query(
      "select id, actor_id, actor_email, action, target_type, target_id, summary, created_at from xh_audit_logs order by created_at desc limit 500",
    ),
    pool.query("select id, frontend, backend, integration, updated_at from xh_assistant_settings where id = 'default' limit 1"),
  ]);
  const db: AdminDb = {
    providers: providersResult.rows.map((row) =>
      normalizeProviderSecret({
        id: row.id,
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
        msLoras: normalizeModelScopeLoras(row.ms_loras),
        note: row.note || "",
        createdAt: dateToMillis(row.created_at),
        updatedAt: dateToMillis(row.updated_at),
      }),
    ),
    models: modelsResult.rows.map((row) =>
      normalizeAdminModelRecord({
        id: row.id,
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
      createdAt: dateToMillis(row.created_at),
    })),
    assistantSettings: normalizeAssistantSettings(
      assistantSettingsResult.rows[0]
        ? {
            frontend: plainObject(assistantSettingsResult.rows[0].frontend),
            backend: plainObject(assistantSettingsResult.rows[0].backend),
            integration: plainObject(assistantSettingsResult.rows[0].integration),
            updatedAt: assistantSettingsResult.rows[0].updated_at
              ? dateToMillis(assistantSettingsResult.rows[0].updated_at)
              : Date.now(),
          }
        : undefined,
    ),
  };
  if (db.providers.length === 0 && db.models.length === 0 && db.tasks.length === 0) {
    const seeded = defaultAdminDb();
    await writeAdminDbPostgres(seeded);
    return seeded;
  }
  return db;
}

async function writeAdminDbPostgres(db: AdminDb) {
  const pool = await getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from xh_assistant_settings");
    await client.query("delete from xh_audit_logs");
    await client.query("delete from xh_tasks");
    await client.query("delete from xh_models");
    await client.query("delete from xh_providers");
    for (const provider of db.providers.map(normalizeProviderSecret)) {
      await client.query(
        `insert into xh_providers (id, name, base_url, protocol, enabled, api_key_cipher, api_key_preview, last_probe_status, last_probe_message, last_fetched_at, rh_apps, rh_workflows, ms_loras, note, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15, $16)`,
        [
          provider.id,
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
        `insert into xh_models (id, provider_id, model_id, display_name, capability, enabled, input_profile, input_capabilities, capability_tags, test_state, parameter_schema, advanced_config, protocol_override, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14, $15)`,
        [
          normalizedModel.id,
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
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11)`,
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
    for (const audit of db.auditLogs || []) {
      await client.query(
        `insert into xh_audit_logs (id, actor_id, actor_email, action, target_type, target_id, summary, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          audit.id,
          audit.actorId || null,
          audit.actorEmail,
          audit.action,
          audit.targetType,
          audit.targetId,
          audit.summary,
          millisToDate(audit.createdAt),
        ],
      );
    }
    const assistantSettings = normalizeAssistantSettings(db.assistantSettings);
    await client.query(
      `insert into xh_assistant_settings (id, frontend, backend, integration, updated_at)
       values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5)`,
      [
        "default",
        JSON.stringify(assistantSettings.frontend),
        JSON.stringify(assistantSettings.backend),
        JSON.stringify(assistantSettings.integration),
        millisToDate(assistantSettings.updatedAt),
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

async function writeAssistantSettingsRecordPostgres(settings: AssistantSettingsRecord) {
  const pool = await getPostgresPool();
  const normalized = normalizeAssistantSettings(settings);
  await pool.query(
    `insert into xh_assistant_settings (id, frontend, backend, integration, updated_at)
     values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5)
     on conflict (id) do update set
       frontend = excluded.frontend,
       backend = excluded.backend,
       integration = excluded.integration,
       updated_at = excluded.updated_at`,
    [
      "default",
      JSON.stringify(normalized.frontend),
      JSON.stringify(normalized.backend),
      JSON.stringify(normalized.integration),
      millisToDate(normalized.updatedAt),
    ],
  );
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
  provider_id?: string | null;
  model_id?: string | null;
  payload?: unknown;
  result?: unknown;
  logs?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}): AdminTaskRecord {
  return {
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
  };
}

function toCanvasListItem(row: {
  id: string;
  name?: string | null;
  node_count?: number | null;
  created_at?: unknown;
  updated_at?: unknown;
}): CanvasListItem {
  return {
    id: row.id,
    name: safeText(row.name, "未命名画布"),
    nodeCount: Number(row.node_count) || 0,
    createdAt: dateToMillis(row.created_at),
    updatedAt: dateToMillis(row.updated_at),
  };
}

function optionalObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
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
  created_at?: unknown;
  updated_at?: unknown;
}): ResourceCategory {
  return {
    id: row.id,
    kind: normalizeResourceKind(row.kind) || "image",
    name: safeText(row.name, "未分类"),
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
  return {
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
  };
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
  return {
    ...model,
    capability,
    enabled: Boolean(model.enabled),
    inputProfile,
    inputCapabilities: { ...inputCapabilities },
    capabilityTags,
    testState: normalizeModelTestState(model.testState),
    parameterSchema: safeJsonText(model.parameterSchema, "{}"),
    advancedConfig: parseAdvancedConfig(model.advancedConfig),
    protocolOverride: normalizeOptionalProtocol(model.protocolOverride),
  };
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
    const raw = text ? JSON.parse(text) : {};
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
    const raw = text ? JSON.parse(text) : {};
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
  return baseUrl.endsWith("/v1") ? `${baseUrl}/${pathname}` : `${baseUrl}/v1/${pathname}`;
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

async function enqueueTask(taskId: string): Promise<{ queued: boolean; reason: string }> {
  if (!redisUrl) return { queued: false, reason: "redis_not_configured" };
  try {
    const client = await getRedisClient();
    await client.lPush(taskQueueName, taskId);
    return { queued: true, reason: "queued" };
  } catch (error) {
    return { queued: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function appendTaskLog(taskId: string, line: string) {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    await pool.query(
      `update xh_tasks
       set logs = coalesce(logs, '[]'::jsonb) || $2::jsonb,
           updated_at = now()
       where id = $1`,
      [taskId, JSON.stringify([line])],
    );
    return;
  }
  const db = await readAdminDb();
  await writeAdminDb({
    ...db,
    tasks: db.tasks.map((task) =>
      task.id === taskId ? { ...task, logs: [...task.logs, line], updatedAt: Date.now() } : task,
    ),
  });
}

async function readTaskRecord(taskId: string): Promise<AdminTaskRecord | null> {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const result = await pool.query(
      "select id, owner_id, title, status, provider_id, model_id, payload, result, logs, created_at, updated_at from xh_tasks where id = $1 limit 1",
      [taskId],
    );
    return result.rows[0] ? toAdminTaskRecord(result.rows[0]) : null;
  }
  const db = await readAdminDb();
  return db.tasks.find((task) => task.id === taskId) ?? null;
}

async function insertTaskRecord(task: AdminTaskRecord) {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    await pool.query(
      `insert into xh_tasks (id, owner_id, title, status, provider_id, model_id, payload, result, logs, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11)`,
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
    return;
  }
  const db = await readAdminDb();
  await writeAdminDb({ ...db, tasks: [task, ...db.tasks] });
}

async function writeTaskRecord(task: AdminTaskRecord) {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    await pool.query(
      `update xh_tasks
       set owner_id = $2,
           title = $3,
           status = $4,
           provider_id = $5,
           model_id = $6,
           payload = $7::jsonb,
           result = $8::jsonb,
           logs = $9::jsonb,
           updated_at = $10
       where id = $1`,
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
        millisToDate(task.updatedAt),
      ],
    );
    return;
  }
  const db = await readAdminDb();
  await writeAdminDb({
    ...db,
    tasks: db.tasks.map((item) => (item.id === task.id ? task : item)),
  });
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
    if (cancelledResult.rows[0]) return toAdminTaskRecord(cancelledResult.rows[0]);
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
  return updatedTask;
}

function defaultAdminDb(): AdminDb {
  const now = Date.now();
  return {
    providers: [
      {
        id: "modelscope",
        name: "ModelScope",
        baseUrl: "https://api-inference.modelscope.cn/v1",
        protocol: "openai",
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
  };
}

function defaultAssistantSettings(): AssistantSettingsRecord {
  const endpoint = safeText(process.env.XINGHUAN_HERMES_WEBUI_URL);
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
      kernel: "hermes",
      endpoint: endpoint || "已配置（服务器内地址已隐藏）",
      endpointConfigured: Boolean(endpoint),
      workspace: safeText(process.env.XINGHUAN_HERMES_WORKSPACE, process.cwd()),
      model: "hermes",
      profile: safeText(process.env.XINGHUAN_HERMES_PROFILE, "canvas-assistant"),
      persistMemory: false,
      strictMode: true,
    },
    updatedAt: Date.now(),
  };
}

function maskAssistantEndpoint(settings: AssistantSettingsRecord): AssistantSettingsRecord {
  return {
    ...settings,
    integration: {
      ...settings.integration,
      endpoint: settings.integration.endpointConfigured ? "已配置（服务器内地址已隐藏）" : "",
    },
  };
}

function toPublicAssistantSettings(settings: AssistantSettingsRecord) {
  return {
    frontend: settings.frontend,
    integration: {
      ...settings.integration,
      endpoint: settings.integration.endpointConfigured ? "已配置（服务器内地址已隐藏）" : "",
    },
    updatedAt: settings.updatedAt,
  };
}

function normalizeAssistantSettings(
  value: unknown,
  base: AssistantSettingsRecord = defaultAssistantSettings(),
): AssistantSettingsRecord {
  const runtimeDefaults = defaultAssistantSettings();
  const source = plainObject(value);
  const frontendSource = plainObject(source.frontend);
  const backendSource = plainObject(source.backend);
  const integrationSource = plainObject(source.integration);
  const baseEndpoint = safeText(base.integration.endpoint);
  const runtimeEndpoint = safeText(runtimeDefaults.integration.endpoint);
  const incomingEndpoint =
    typeof integrationSource.endpoint === "string" ? integrationSource.endpoint.trim() : undefined;
  const maskedEndpoint = "已配置（服务器内地址已隐藏）";
  let nextEndpoint =
    baseEndpoint && baseEndpoint !== maskedEndpoint
      ? baseEndpoint
      : runtimeEndpoint && runtimeEndpoint !== maskedEndpoint
        ? runtimeEndpoint
        : "";
  let nextEndpointConfigured = booleanValue(
    base.integration.endpointConfigured,
    nextEndpoint.length > 0,
  );
  if (!nextEndpointConfigured && runtimeDefaults.integration.endpointConfigured && incomingEndpoint === undefined) {
    nextEndpointConfigured = true;
  }

  if (incomingEndpoint !== undefined) {
    if (!incomingEndpoint) {
      nextEndpoint = "";
      nextEndpointConfigured = false;
    } else if (incomingEndpoint === maskedEndpoint) {
      nextEndpointConfigured = nextEndpoint.length > 0;
    } else {
      nextEndpoint = incomingEndpoint;
      nextEndpointConfigured = true;
    }
  } else if (typeof integrationSource.endpointConfigured === "boolean") {
    if (integrationSource.endpointConfigured) {
      nextEndpointConfigured = true;
    } else if (runtimeDefaults.integration.endpointConfigured) {
      nextEndpointConfigured = true;
      if (!nextEndpoint && runtimeEndpoint && runtimeEndpoint !== maskedEndpoint) nextEndpoint = runtimeEndpoint;
    } else {
      nextEndpointConfigured = false;
      nextEndpoint = "";
    }
  }

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
      kernel: integrationSource.kernel === "fallback" ? "fallback" : "hermes",
      endpoint: nextEndpoint,
      endpointConfigured: nextEndpointConfigured,
      workspace: safeText(integrationSource.workspace, base.integration.workspace),
      model: safeText(integrationSource.model, base.integration.model),
      profile: safeText(integrationSource.profile, base.integration.profile || "canvas-assistant"),
      persistMemory: booleanValue(integrationSource.persistMemory, false),
      strictMode: booleanValue(integrationSource.strictMode, base.integration.strictMode),
    },
    updatedAt: Number.isFinite(source.updatedAt) ? Number(source.updatedAt) : Date.now(),
  };
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

async function loginUser(
  emailValue: unknown,
  passwordValue: unknown,
  options?: { adminOnly?: boolean },
) {
  const email = safeText(emailValue).toLowerCase();
  const password = String(passwordValue || "");
  if (!email || !password) return null;
  const db = await readAuthDb();
  const user = db.users.find((item) => item.email.toLowerCase() === email && !item.disabled);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  if (options?.adminOnly && user.role !== "admin") return "ADMIN_REQUIRED" as const;
  const now = Date.now();
  const session: SessionRecord = {
    id: randomToken(32),
    userId: user.id,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  await writeAuthDb({
    ...db,
    sessions: [session, ...db.sessions.filter((item) => item.expiresAt > now && item.id !== session.id)],
  });
  return { user, session };
}

async function logoutUser(request: import("node:http").IncomingMessage) {
  const sessionId = readCookie(request, SESSION_COOKIE_NAME);
  if (!sessionId) return;
  const db = await readAuthDb();
  await writeAuthDb({ ...db, sessions: db.sessions.filter((session) => session.id !== sessionId) });
}

async function getCurrentUser(request: import("node:http").IncomingMessage): Promise<CurrentUser | null> {
  const sessionId = readCookie(request, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  const db = await readAuthDb();
  const session = db.sessions.find((item) => item.id === sessionId && item.expiresAt > Date.now());
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId && !item.disabled);
  return user ? toPublicUser(user) : null;
}

function toPublicUser(user: UserRecord): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
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

async function publicModelCatalog() {
  const db = await readAdminDb();
  const providerMap = new Map(db.providers.map((provider) => [provider.id, provider]));
  const all = db.models
    .filter((model) => model.enabled)
    .map((model) => {
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
      return {
        id: model.id,
        providerId: model.providerId,
        modelId: model.modelId,
        displayName: model.displayName,
        capability,
        enabled: true,
        inputProfile: model.inputProfile,
        inputCapabilities,
        advancedConfig: plainObject(model.advancedConfig),
        protocol,
        parameterSchema,
        ui: uiMetadataFromSchema(parameterSchema, capability, inputCapabilities),
        provider: {
          id: provider.id,
          name: provider.name,
          protocol: normalizeProviderProtocol(provider.protocol),
          enabled: true,
        },
        updatedAt: model.updatedAt,
      };
    })
    .filter(Boolean);
  return {
    all,
    chatModels: all.filter((model) => model?.capability === "chat"),
    imageModels: all.filter((model) => model?.capability === "image"),
    videoModels: all.filter((model) => model?.capability === "video"),
    audioModels: all.filter((model) => model?.capability === "audio"),
  };
}

async function publicRunningHubCatalog() {
  const db = await readAdminDb();
  const providers = db.providers
    .filter((provider) => provider.enabled && normalizeProviderProtocol(provider.protocol) === "runninghub")
    .map((provider) => {
      const workflows = normalizeRunningHubEntries(provider.rhWorkflows, "workflow")
        .filter((entry) => entry.enabled)
        .map((entry) => toPublicRunningHubCatalogEntry(provider, entry));
      const apps = normalizeRunningHubEntries(provider.rhApps, "app")
        .filter((entry) => entry.enabled)
        .map((entry) => toPublicRunningHubCatalogEntry(provider, entry));
      return {
        id: provider.id,
        name: provider.name,
        baseUrl: provider.baseUrl,
        workflows,
        apps,
      };
    });
  return {
    providers,
    workflows: providers.flatMap((provider) => provider.workflows),
    apps: providers.flatMap((provider) => provider.apps),
  };
}

function publicRequestOrigin(request: import("node:http").IncomingMessage) {
  const forwardedProto = safeText(request.headers["x-forwarded-proto"]);
  const forwardedHost = safeText(request.headers["x-forwarded-host"]);
  const hostHeader = safeText(request.headers.host);
  const hostValue = forwardedHost || hostHeader || `${host}:${port}`;
  const proto = forwardedProto || (hostValue.startsWith("127.0.0.1") || hostValue.startsWith("localhost") ? "http" : "https");
  return `${proto}://${hostValue}`.replace(/\/+$/, "");
}


function normalizeResourceKind(value: unknown): ResourceKind | "" {
  const kind = String(value || "").toLowerCase();
  return ["image", "video", "audio", "set", "pose", "workflow"].includes(kind) ? (kind as ResourceKind) : "";
}

function normalizeRunningHubEntries(value: unknown, kind: "app" | "workflow"): RunningHubEntry[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const parsed = parseRunningHubRef(row.id || row.appId || row.workflowId || "");
      const id = safeText(parsed?.id || row.id || row.appId || row.workflowId);
      if (!id) return null;
      return {
        id,
        kind,
        appId: kind === "app" ? safeText(row.appId || id) : undefined,
        workflowId: kind === "workflow" ? safeText(row.workflowId || id) : undefined,
        runTargetId: safeText(row.runTargetId || (kind === "app" ? row.appId : row.workflowId) || id),
        title: safeText(row.title, kind === "app" ? `AI 应用 ${id.slice(-6)}` : `工作流 ${id.slice(-6)}`),
        note: safeText(row.note),
        thumbnail: safeText(row.thumbnail),
        enabled: row.enabled === undefined ? true : Boolean(row.enabled),
        workflowJson: normalizeOptionalJsonText(row.workflowJson),
        fields: normalizeRunningHubFieldDefinitions(row.fields),
      } satisfies RunningHubEntry;
    })
    .filter(Boolean) as RunningHubEntry[];
}

function normalizeRunningHubFieldDefinitions(value: unknown): RunningHubFieldDefinition[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const nodeId = normalizeRunningHubFieldText(row.nodeId);
      const fieldName = normalizeRunningHubFieldText(row.fieldName);
      if (!nodeId || !fieldName) return null;
      return {
        nodeId,
        fieldName,
        label: normalizeRunningHubFieldText(row.label),
        description: normalizeRunningHubFieldText(row.description, 2000),
        fieldType: normalizeRunningHubFieldText(row.fieldType),
        valueType: normalizeRunningHubFieldText(row.valueType),
        placeholder: normalizeRunningHubFieldText(row.placeholder, 1000),
        required: row.required === undefined ? undefined : Boolean(row.required),
        fieldValue: normalizeRunningHubFieldPrimitive(row.fieldValue),
        defaultValue: normalizeRunningHubFieldPrimitive(row.defaultValue),
        options: normalizeRunningHubFieldOptions(row.options || row.fieldData || row.list || row.values),
      } satisfies RunningHubFieldDefinition;
    })
    .filter(Boolean) as RunningHubFieldDefinition[];
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

function parseRunningHubRef(value: unknown) {
  const text = safeText(value);
  const match = text.match(/\/run\/(ai-app|workflow)\/([0-9A-Za-z_-]+)/i);
  if (match) return { type: match[1].toLowerCase() === "ai-app" ? "app" : "workflow", id: match[2] };
  const plain = text.match(/^[0-9A-Za-z_-]{6,}$/);
  return plain ? { type: "workflow", id: text } : null;
}

function toPublicRunningHubCatalogEntry(provider: AdminProviderRecord, entry: RunningHubEntry) {
  return {
    catalogId: `${provider.id}:${entry.kind || "workflow"}:${entry.id}`,
    providerId: provider.id,
    providerName: provider.name,
    providerBaseUrl: provider.baseUrl,
    id: entry.id,
    kind: entry.kind || "workflow",
    appId: entry.appId || "",
    workflowId: entry.workflowId || "",
    runTargetId: entry.runTargetId || entry.workflowId || entry.appId || entry.id,
    title: entry.title,
    note: entry.note || "",
    thumbnail: entry.thumbnail || "",
    workflowJson: entry.workflowJson || "",
    fields: normalizeRunningHubFieldDefinitions(entry.fields),
  };
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
  return /^\s*<!doctype html/i.test(value) || /^\s*<html[\s>]/i.test(value);
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
    const raw = text ? JSON.parse(text) : {};
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
  if (!["openai", "apimart", "custom"].includes(protocol)) {
    return fail(`当前模型测试暂未接入 ${protocol} 协议`);
  }
  const capabilityTags = normalizeModelCapabilityTags(model.capabilityTags, model.capability, model.modelId);
  if (kind.stateKey === "videoUnderstanding") {
    if (!capabilityTags.includes("video_understanding")) {
      return fail("模型未标记为视频理解模型；请先手动开启视频理解标签，或使用图像关键帧测试。", 0, ["video_understanding"]);
    }
    return fail("视频理解真实样本测试需要固定测试视频，本版本先记录能力标签，不自动消耗视频测试。", 0, ["video_understanding"]);
  }
  if (kind.stateKey === "audioGeneration" || kind.stateKey === "voiceClone") {
    return fail("音频模型测试将在 MiMo 音频 Provider 适配完成后启用。", 0, kind.stateKey === "voiceClone" ? ["voice_clone"] : ["tts"]);
  }
  if (kind.stateKey === "imageGeneration" || kind.stateKey === "videoGeneration") {
    return fail("生成类模型测试可能产生费用，请在下一阶段通过专用低成本测试按钮启用。");
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
    const raw = text ? JSON.parse(text) : {};
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
  const raw = text ? JSON.parse(text) : {};
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
) {
  const client = createGrsaiImageClient({
    apiKey,
    baseUrl: safeText(baseUrl),
    pollIntervalMs: 1500,
    timeoutMs: 120000,
  });
  const result = await client.generate({
    modelId,
    prompt,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(size && size !== "auto" ? { size } : {}),
    ...(images.length > 0 ? { images } : {}),
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

function toAdminUser(user: UserRecord) {
  const password = decryptManagedPassword(user);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    disabled: Boolean(user.disabled),
    passwordAvailable: Boolean(password),
    password,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function decryptManagedPassword(user: UserRecord) {
  return user.passwordCipher ? decryptSecret(user.passwordCipher) : "";
}

function toPublicProvider(provider: AdminProviderRecord) {
  return {
    id: provider.id,
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
    msLoras: normalizeModelScopeLoras(provider.msLoras),
    note: provider.note || "",
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

function normalizeProviderSecret(provider: AdminProviderRecord) {
  if (!provider.apiKey) return provider;
  if (provider.apiKey.startsWith("enc:v1:")) {
    return provider.apiKeyPreview ? provider : { ...provider, apiKeyPreview: secretPreview(decryptSecret(provider.apiKey)) };
  }
  const raw = provider.apiKey;
  return {
    ...provider,
    apiKey: encryptSecret(raw),
    apiKeyPreview: secretPreview(raw),
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

async function analyzeProviderAssistant(input: AssistantAnalyzeRequest): Promise<AssistantAnalysisResult> {
  const grsaiSignal = /grsai|grsai\.dakka\.com\.cn/i.test(
    [
      safeText(input.providerName),
      safeText(input.baseUrl),
      safeText(input.protocolHint),
      safeText(input.notes),
      safeText(input.sampleRequest),
      safeText(input.sampleResponse),
      safeText(input.modelId),
    ].join("\n"),
  );
  const fallback = await buildFallbackAssistantAnalysis(input);
  const settings = normalizeAssistantSettings((await readAdminDb()).assistantSettings);
  const hermesBaseUrl = safeText(process.env.XINGHUAN_HERMES_WEBUI_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
  const hermesPassword = safeText(process.env.XINGHUAN_HERMES_WEBUI_PASSWORD);
  if (!hermesPassword) {
    return fallback;
  }
  try {
    const hermes = await runHermesAssistantAnalysis({
      baseUrl: hermesBaseUrl,
      password: hermesPassword,
      workspace: safeText(process.env.XINGHUAN_HERMES_WORKSPACE, process.cwd()),
      prompt: buildHermesAssistantPrompt(input, fallback),
      settings,
    });
    const merged: AssistantAnalysisResult = {
      ...fallback,
      mode: "hermes",
      rawAssistant: hermes.rawAssistant,
      summary: hermes.summary || fallback.summary,
      recommendedLayer: hermes.recommendedLayer || fallback.recommendedLayer,
      protocol: fallback.protocol === "grsai_draw" ? fallback.protocol : (hermes.protocol || fallback.protocol),
      asyncTask: hermes.asyncTask ?? fallback.asyncTask,
      chainTemplate: safeText((hermes as any).chainTemplate) || fallback.chainTemplate,
      chainTemplateVersion: safeText((hermes as any).chainTemplateVersion) || fallback.chainTemplateVersion,
      risks: hermes.risks.length ? hermes.risks : fallback.risks,
      checklist: hermes.checklist.length ? hermes.checklist : fallback.checklist,
      drafts: {
        provider: {
          ...fallback.drafts.provider,
          ...hermes.drafts.provider,
          protocol:
            fallback.drafts.provider.protocol === "grsai_draw"
              ? "grsai_draw"
              : safeText(hermes.drafts.provider.protocol, fallback.drafts.provider.protocol),
          baseUrl: safeText(hermes.drafts.provider.baseUrl, fallback.drafts.provider.baseUrl),
          note: safeText(hermes.drafts.provider.note, fallback.drafts.provider.note),
        },
        model: {
          ...fallback.drafts.model,
          ...hermes.drafts.model,
          inputCapabilities: {
            ...fallback.drafts.model.inputCapabilities,
            ...(plainObject(hermes.drafts.model.inputCapabilities) as Record<string, boolean>),
          },
          advancedConfig: {
            ...fallback.drafts.model.advancedConfig,
            ...plainObject(hermes.drafts.model.advancedConfig),
          },
          parameterSchema: safeJsonText(hermes.drafts.model.parameterSchema, fallback.drafts.model.parameterSchema),
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
      rawAssistant: `${fallback.rawAssistant}\n\n[Hermes 调用失败，已回退]\n${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function runAssistantChat(input: AssistantChatRequest, actor: CurrentUser): Promise<AssistantChatResult> {
  const fallback = buildFallbackAssistantChat(input, actor);
  const settings = normalizeAssistantSettings((await readAdminDb()).assistantSettings);
  const workspace = safeText(process.env.XINGHUAN_HERMES_WORKSPACE, settings.integration.workspace || process.cwd());
  const hermesBaseUrl = safeText(process.env.XINGHUAN_HERMES_WEBUI_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
  const hermesPassword = safeText(process.env.XINGHUAN_HERMES_WEBUI_PASSWORD);
  if (!hermesPassword) return fallback;
  try {
    const hermes = await runHermesAssistantChat({
      baseUrl: hermesBaseUrl,
      password: hermesPassword,
      workspace,
      prompt: buildHermesAssistantChatPrompt(input, actor, fallback),
      settings: assistantMemoryPolicySettings(input, settings),
      conversationKey: assistantConversationKey(input, actor, workspace),
    });
    return {
      mode: "hermes",
      message: hermes.message || fallback.message,
      rawAssistant: hermes.rawAssistant,
    };
  } catch (error) {
    return {
      ...fallback,
      rawAssistant: `${fallback.rawAssistant}\n\n[Hermes 调用失败，已回退]\n${error instanceof Error ? error.message : String(error)}`,
    };
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
  const result = await runAssistantChat(input, actor);
  sendEvent("status", { status: "generating" });
  const message = safeText(result.message);
  const chunks = splitAssistantMessage(message);
  for (const chunk of chunks) {
    sendEvent("delta", { delta: chunk });
  }
  sendEvent("done", { ...result, rawAssistant: "" });
  response.end();
}

function splitAssistantMessage(message: string) {
  const text = safeText(message, "");
  if (!text) return [];
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += 24) {
    chunks.push(text.slice(index, index + 24));
  }
  return chunks;
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
  const docUrl = safeText(input.docUrl);
  const signals = `${providerName}\n${baseUrl}\n${docUrl}\n${notes}\n${sampleRequest}\n${sampleResponse}`;
  const grsaiDetected = /grsai|grsai\.dakka\.com\.cn/i.test(signals);
  const toapisDetected = /toapis|grok-video-1\.5-preview|videos\/generations\/\{task_id\}|POST\s+https:\/\/toapis\.com\/v1\/videos\/generations/i.test(signals);
  const agnesDetected = /agnes|agnes-ai\.com|agnes-video/i.test(signals);
  const videoDetected =
    toapisDetected ||
    agnesDetected ||
    /video|i2v|t2v|grok-video|wanx|seedance|kling|veo|sora/i.test(`${signals}\n${modelId}`);
  const capability =
    requestedCapability === "chat" || requestedCapability === "image" || requestedCapability === "video"
      ? normalizeCapability(requestedCapability)
      : grsaiDetected
        ? "image"
        : videoDetected
          ? "video"
          : classifyUpstreamModel(modelId);
  const asyncTask =
    grsaiDetected ||
    toapisDetected ||
    agnesDetected ||
    /request[_-]?id|\/videos\/\{request_id\}|\/videos\/[a-z0-9_-]+/i.test(sampleResponse) ||
    /\bid\b|task[_-]?id|\/tasks\/|status["']?\s*:|poll/i.test(sampleResponse) ||
    /request[_-]?id|\/videos\/\{request_id\}|\/videos\/[a-z0-9_-]+/i.test(sampleRequest) ||
    /\bid\b|task[_-]?id|\/tasks\/|status["']?\s*:/i.test(sampleRequest) ||
    /async|poll/i.test(notes);
  const protocol =
    (grsaiDetected ? "grsai_draw" :
    protocolHint ||
    (/apimart/i.test(baseUrl) || /apimart/i.test(providerName) ? "apimart" :
      /gemini/i.test(providerName) ? "gemini" :
      /runninghub/i.test(providerName) ? "runninghub" :
      grsaiDetected ? "grsai_draw" :
      "openai"));
  const recommendedLayer: AssistantAnalysisResult["recommendedLayer"] =
    asyncTask ? "adapter" :
    /resultVideoPath|pollPathTemplate|taskStatusPath/i.test(sampleResponse + notes) ? "advanced" :
    "default";
  const docFetch = await safeFetchDocExcerpt(docUrl);
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
  if (asyncTask) {
    if (capability === "video") {
      advancedConfig.mode = "async_video_task";
      advancedConfig.submitPath = "videos/generations";
      advancedConfig.pollIntervalMs = 2500;
      advancedConfig.pollTimeoutMs = 360000;
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
    advancedConfig.pollTimeoutMs = 600000;
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
  if (toapisDetected && capability === "video") {
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
  const checklist = [
    "在后台确认 Provider 基本信息、协议类型和 Base URL。",
    "导入或新建模型草案，检查 capability、inputCapabilities、parameterSchema。",
    asyncTask ? "补齐 task_id、status、pollPathTemplate、结果路径等 adapter / advancedConfig 配置。" : "先用默认结构化配置打通，再决定是否补高级映射。",
    "在灰度环境使用真实密钥跑一次最小生成请求并检查任务日志。",
  ];
  return {
    mode: "fallback",
    summary,
    recommendedLayer,
    protocol,
    asyncTask,
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
      chainTemplate,
      chainTemplateVersion,
      sampleSignals: {
        sampleRequest: sampleRequest.slice(0, 400),
        sampleResponse: sampleResponse.slice(0, 400),
        notes: notes.slice(0, 400),
      },
    }, null, 2),
  };
}

function buildFallbackAssistantChat(input: AssistantChatRequest, _actor: CurrentUser): AssistantChatResult {
  const message = safeText(input.message);
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  const attachmentSummary = attachments
    .map((item) => summarizeAssistantAttachment(item))
    .map((item) => `${safeText(item.kind || "context")}:${safeText(item.title || item.summary || item.kind)}`)
    .slice(0, 8);
  return {
    mode: "fallback",
    message: [
      attachmentSummary.length
        ? `已收到 ${attachments.length} 个上下文卡片：${attachmentSummary.join(" / ")}。`
        : "当前没有上下文卡片。",
      message
        ? `问题：${message}`
        : "请继续输入问题或要求。",
      "可继续补充节点、工作流或媒体上下文。",
    ]
      .filter(Boolean)
      .join("\n"),
    rawAssistant: "",
  };
}

function summarizeAssistantAttachment(item: AssistantChatAttachment) {
  const payload = plainObject(item.payload);
  const kind = safeText(item.kind || "context");
  const summary: Record<string, unknown> = {
    kind,
    title: safeText(item.title).slice(0, 120),
    summary: safeText(item.summary).slice(0, 240),
  };
  if (kind === "workflow") {
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const edges = Array.isArray(payload.edges) ? payload.edges : [];
    summary.nodeCount = nodes.length;
    summary.edgeCount = edges.length;
    summary.nodeTypes = nodes
      .slice(0, 12)
      .map((node) => safeText(plainObject(node).type))
      .filter(Boolean);
  }
  if (kind === "node") {
    summary.nodeId = safeText(payload.id || payload.nodeId).slice(0, 80);
    summary.nodeType = safeText(payload.type || payload.nodeType).slice(0, 80);
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

function buildHermesAssistantPrompt(input: AssistantAnalyzeRequest, fallback: AssistantAnalysisResult) {
  return [
    "你是无限画布后台的受限接入审计助手。",
    "请根据给定信息输出严格 JSON，不要输出 Markdown 代码块。",
    'JSON schema: {"summary":"", "protocol":"", "recommendedLayer":"default|advanced|adapter", "asyncTask":true, "chainTemplate":"sync_inline_result|async_task_poll_result|async_task_poll_then_final_lookup|adapter_manual_model_catalog", "chainTemplateVersion":"video-provider-template/v1", "risks":[""], "checklist":[""], "drafts":{"provider":{"name":"","baseUrl":"","protocol":"","note":""},"model":{"modelId":"","displayName":"","capability":"chat|image|video","inputProfile":"","inputCapabilities":{"prompt":true,"imageReference":false,"multiImage":false,"firstFrame":false,"lastFrame":false,"mask":false,"audioReference":false},"parameterSchema":"{}", "advancedConfig":{}}}}',
    "如果是异步视频平台，必须优先判断属于哪一类模板：同步直返、单段轮询、二段最终结果查询。",
    "如果属于二段最终结果查询，advancedConfig 必须尽量给出 finalResultTaskIdPath、finalResultPathTemplate、finalResultVideoPath。",
    "只允许输出受控配置字段，不要输出 shell 命令、数据库写入语句或需要管理员复制执行的脚本。",
    "如果信息不足，也要尽量给出保守建议。",
    `输入能力: ${JSON.stringify(input)}`,
    `当前回退分析: ${JSON.stringify(fallback)}`,
  ].join("\n");
}

function buildHermesAssistantChatPrompt(input: AssistantChatRequest, actor: CurrentUser, fallback: AssistantChatResult) {
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  return [
    "你是无限画布的内置 AI 助手。",
    "你会收到用户问题，以及若干来自画布或后台的上下文卡片。",
    "请结合这些上下文，用简洁、专业、可执行的中文直接回复。",
    "不要输出 Markdown 代码块，不要假装你已经修改了配置或执行了操作。",
    "如果用户提供的是工作流、节点或媒体，请优先做分析、诊断、建议和下一步动作。",
    `当前作用域: ${input.scope === "admin" ? "后台管理" : "画布工作区"}`,
    `当前用户: ${actor.email} (${actor.role})`,
    `用户问题: ${safeText(input.message) || "未提供问题"}`,
    `上下文卡片摘要: ${JSON.stringify(attachments.map((item) => summarizeAssistantAttachment(item)))}`,
    `本地兜底回复摘要: ${safeText(fallback.message).slice(0, 500)}`,
  ].join("\n");
}

function hermesProfileName(settings?: AssistantSettingsRecord) {
  return safeText(
    process.env.XINGHUAN_HERMES_PROFILE || settings?.integration.profile,
    "canvas-assistant",
  );
}

function buildHermesSessionPayload(workspace: string, settings?: AssistantSettingsRecord) {
  return {
    workspace,
    profile: hermesProfileName(settings),
    memory: Boolean(settings?.integration.persistMemory),
    persistMemory: Boolean(settings?.integration.persistMemory),
  };
}

function buildHermesChatPayload(sessionId: string, message: string, workspace: string, settings?: AssistantSettingsRecord) {
  return {
    session_id: sessionId,
    message,
    workspace,
    profile: hermesProfileName(settings),
    memory: Boolean(settings?.integration.persistMemory),
    persistMemory: Boolean(settings?.integration.persistMemory),
  };
}

function assistantMemoryPolicySettings(input: AssistantChatRequest, settings: AssistantSettingsRecord): AssistantSettingsRecord {
  const memoryAllowed = input.scope === "admin" && Boolean(settings.integration.persistMemory);
  return {
    ...settings,
    integration: {
      ...settings.integration,
      persistMemory: memoryAllowed,
    },
  };
}

function assistantConversationKey(input: AssistantChatRequest, actor: CurrentUser, workspace: string) {
  const scope = input.scope === "admin" ? "admin" : "canvas";
  const conversationId = safeText(input.conversationId, "default");
  return [workspace, scope, actor.id || actor.email, conversationId].join("::");
}

function extractHermesSessionId(payload: any) {
  return safeText(
    payload?.data?.session?.session_id ||
    payload?.data?.session_id ||
    payload?.data?.session?.id ||
    payload?.session?.session_id ||
    payload?.session_id ||
    payload?.session?.id,
  );
}

async function getHermesAssistantSessionId(input: {
  baseUrl: string;
  cookie: string;
  csrf: string;
  workspace: string;
  conversationKey: string;
  settings?: AssistantSettingsRecord;
}) {
  const now = Date.now();
  const cached = assistantHermesSessionCache.get(input.conversationKey);
  if (cached && now - cached.updatedAt < ASSISTANT_HERMES_SESSION_TTL_MS) {
    cached.updatedAt = now;
    return cached.sessionId;
  }
  const sessionResp = await hermesRequestJson(input.baseUrl, "/api/session/new", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Cookie: input.cookie,
      ...(input.csrf ? { "X-Hermes-CSRF-Token": input.csrf, Origin: input.baseUrl } : {}),
    },
    body: JSON.stringify(buildHermesSessionPayload(input.workspace, input.settings)),
  });
  const sessionId = extractHermesSessionId(sessionResp.data);
  if (!sessionId) throw new Error("Hermes 未返回 session_id");
  assistantHermesSessionCache.set(input.conversationKey, { sessionId, updatedAt: now });
  return sessionId;
}

async function runHermesAssistantAnalysis(input: {
  baseUrl: string;
  password: string;
  workspace: string;
  prompt: string;
  settings?: AssistantSettingsRecord;
}) {
  const login = await hermesRequestJson(input.baseUrl, "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: input.password }),
  });
  const cookie = extractCookieHeader(login.headers["set-cookie"]);
  if (!cookie) throw new Error("Hermes 登录成功但未返回会话 Cookie");
  const shell = await hermesRequestText(input.baseUrl, "/", { headers: { Cookie: cookie } });
  const csrf = extractHermesCsrfToken(shell.body);
  const sessionResp = await hermesRequestJson(input.baseUrl, "/api/session/new", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Cookie: cookie,
      ...(csrf ? { "X-Hermes-CSRF-Token": csrf, Origin: input.baseUrl } : {}),
    },
    body: JSON.stringify(buildHermesSessionPayload(input.workspace, input.settings)),
  });
  const sessionId = extractHermesSessionId(sessionResp.data);
  if (!sessionId) throw new Error("Hermes 未返回 session_id");
  const chatResp = await hermesRequestJson(input.baseUrl, "/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Cookie: cookie,
      ...(csrf ? { "X-Hermes-CSRF-Token": csrf, Origin: input.baseUrl } : {}),
    },
    body: JSON.stringify(buildHermesChatPayload(sessionId, input.prompt, input.workspace, input.settings)),
  });
  const rawAssistant =
    safeText(
      chatResp.data?.answer ||
      chatResp.data?.assistant ||
      chatResp.data?.response ||
      chatResp.data?.message ||
      chatResp.data?.text ||
      chatResp.data?.result ||
      "",
    ) || JSON.stringify(chatResp.data ?? chatResp, null, 2);
  const parsed = tryParseAssistantJson(rawAssistant);
  return {
    rawAssistant,
    summary: safeText(parsed?.summary),
    protocol: safeText(parsed?.protocol),
    recommendedLayer: parseAssistantLayer(parsed?.recommendedLayer),
    asyncTask: typeof parsed?.asyncTask === "boolean" ? parsed.asyncTask : undefined,
    chainTemplate: safeText(parsed?.chainTemplate),
    chainTemplateVersion: safeText(parsed?.chainTemplateVersion),
    risks: Array.isArray(parsed?.risks) ? parsed.risks.map((item: unknown) => safeText(item)).filter(Boolean) : [],
    checklist: Array.isArray(parsed?.checklist) ? parsed.checklist.map((item: unknown) => safeText(item)).filter(Boolean) : [],
    drafts: {
      provider: plainObject(parsed?.drafts?.provider),
      model: plainObject(parsed?.drafts?.model),
    },
  };
}

async function runHermesAssistantChat(input: {
  baseUrl: string;
  password: string;
  workspace: string;
  prompt: string;
  settings?: AssistantSettingsRecord;
  conversationKey: string;
}) {
  const login = await hermesRequestJson(input.baseUrl, "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: input.password }),
  });
  const cookie = extractCookieHeader(login.headers["set-cookie"]);
  if (!cookie) throw new Error("Hermes 登录成功但未返回会话 Cookie");
  const shell = await hermesRequestText(input.baseUrl, "/", { headers: { Cookie: cookie } });
  const csrf = extractHermesCsrfToken(shell.body);
  const sessionId = await getHermesAssistantSessionId({
    baseUrl: input.baseUrl,
    cookie,
    csrf,
    workspace: input.workspace,
    conversationKey: input.conversationKey,
    settings: input.settings,
  });
  const chatStartResp = await hermesRequestJson(input.baseUrl, "/api/chat/start", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Cookie: cookie,
      ...(csrf ? { "X-Hermes-CSRF-Token": csrf, Origin: input.baseUrl } : {}),
    },
    body: JSON.stringify({
      session_id: sessionId,
      message: input.prompt,
      workspace: input.workspace,
      profile: hermesProfileName(input.settings),
      attachments: [],
    }),
  });
  const streamId = safeText(chatStartResp.data?.stream_id);
  if (!streamId) {
    throw new Error("Hermes 未返回 stream_id");
  }
  const rawAssistant = await readHermesAssistantStream(input.baseUrl, streamId, cookie);
  return {
    rawAssistant,
    message: rawAssistant.trim(),
  };
}

async function readHermesAssistantStream(baseUrl: string, streamId: string, cookie: string) {
  const response = await rawHttpRequest(
    baseUrl,
    `/api/chat/stream?${new URLSearchParams({ stream_id: streamId }).toString()}`,
    {
      method: "GET",
      headers: {
        Cookie: cookie,
        accept: "text/event-stream",
      },
      timeoutMs: 180000,
    },
  );
  if (response.status >= 400) {
    throw new Error(`Hermes stream 请求失败: HTTP ${response.status}`);
  }
  const events = parseServerSentEvents(response.body);
  const tokenText = events
    .filter((event) => event.event === "token")
    .map((event) => safeText(plainObject(event.data).text))
    .join("");
  if (tokenText.trim()) return tokenText;
  const doneEvent = events.find((event) => event.event === "done");
  const donePayload = plainObject(doneEvent?.data);
  const doneText = safeText(
    donePayload.answer ||
    donePayload.assistant ||
    donePayload.response ||
    donePayload.message ||
    donePayload.text ||
    donePayload.result,
  );
  if (doneText.trim()) return doneText;
  const appError = events.find((event) => event.event === "apperror" || event.event === "error");
  if (appError) {
    const payload = plainObject(appError.data);
    throw new Error(safeText(payload.message || payload.error || JSON.stringify(payload), "Hermes stream error"));
  }
  return "";
}

function parseServerSentEvents(body: string) {
  const blocks = String(body || "").split(/\r?\n\r?\n/);
  const events: Array<{ event: string; data: unknown }> = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter(Boolean);
    if (!lines.length) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim() || "message";
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    const rawData = dataLines.join("\n");
    events.push({
      event,
      data: safeJsonParse(rawData) ?? rawData,
    });
  }
  return events;
}

function parseAssistantLayer(value: unknown): "default" | "advanced" | "adapter" | undefined {
  const text = safeText(value).toLowerCase();
  if (text === "default" || text === "advanced" || text === "adapter") return text;
  return undefined;
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

function extractHermesCsrfToken(html: string) {
  const match = html.match(/__CSRF_TOKEN_JSON__"\s*:\s*("[^"]*")/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      return "";
    }
  }
  const fallback = html.match(/"csrfToken"\s*:\s*"([^"]+)"/);
  return fallback?.[1] || "";
}

function extractCookieHeader(setCookieHeader: string | string[] | undefined) {
  if (!setCookieHeader) return "";
  const first = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  return String(first || "").split(";")[0] || "";
}

async function safeFetchDocExcerpt(docUrl: string) {
  if (!docUrl) return { attempted: false, ok: false };
  try {
    const response = await httpJsonLike(docUrl, { method: "GET", timeoutMs: 8000 });
    return {
      attempted: true,
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      excerpt: response.body.slice(0, 600),
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

async function hermesRequestJson(baseUrl: string, path: string, options: { method: string; headers?: Record<string, string>; body?: string }) {
  const response = await rawHttpRequest(baseUrl, path, options);
  const payload = safeJsonParse(response.body);
  if (!payload || typeof payload !== "object") {
    throw new Error(`Hermes 返回了非 JSON 数据: HTTP ${response.status}`);
  }
  if (response.status >= 400 || payload.error) {
    throw new Error(`Hermes 请求失败: HTTP ${response.status} ${safeText(payload.error)}`);
  }
  return { data: payload, headers: response.headers };
}

async function hermesRequestText(baseUrl: string, path: string, options: { headers?: Record<string, string> }) {
  return rawHttpRequest(baseUrl, path, { method: "GET", headers: options.headers });
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

async function rawHttpRequest(
  baseUrl: string,
  path: string,
  options: { method: string; headers?: Record<string, string>; body?: string; timeoutMs?: number },
) {
  const target = new URL(path, `${baseUrl}/`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("timeout")), options.timeoutMs ?? 60000);
  try {
    const response = await fetch(target, {
      method: options.method,
      headers: {
        accept: "application/json, text/html;q=0.9, */*;q=0.8",
        "user-agent": "xinghuan-hermes-bridge",
        ...options.headers,
      },
      body: options.body,
      signal: controller.signal,
    });
    const headerRecord: Record<string, string | string[] | undefined> = {};
    response.headers.forEach((value, key) => {
      headerRecord[key] = value;
    });
    const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    if (typeof getSetCookie === "function") {
      headerRecord["set-cookie"] = getSetCookie.call(response.headers);
    }
    return {
      status: response.status,
      body: await response.text(),
      headers: headerRecord,
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
) {
  const record: AdminAuditRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actorId: actor.id,
    actorEmail: actor.email,
    action,
    targetType,
    targetId,
    summary,
    createdAt: Date.now(),
  };
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    await pool.query(
      `insert into xh_audit_logs (id, actor_id, actor_email, action, target_type, target_id, summary, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.id,
        record.actorId || null,
        record.actorEmail,
        record.action,
        record.targetType,
        record.targetId,
        record.summary,
        millisToDate(record.createdAt),
      ],
    );
    return;
  }
  const db = await readAdminDb();
  await writeAdminDb({
    ...db,
    auditLogs: [record, ...(db.auditLogs || [])].slice(0, 1000),
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
    };
  }
  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    const now = await client.query("select now() as now");
    const migrations = await client
      .query("select id from xh_schema_migrations order by id")
      .then((result) => result.rows.map((row) => String(row.id)))
      .catch(() => []);
    return {
      configured: true,
      status: "connected",
      serverTime: now.rows[0]?.now,
      migrations,
      error: "",
    };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      migrations: [] as string[],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function readRedisStatus() {
  if (!redisUrl) {
    return {
      configured: false,
      status: "not_configured",
      queue: taskQueueName,
      depth: 0,
      error: "",
    };
  }
  try {
    const client = await getRedisClient();
    const pong = await client.ping();
    const depth = await client.lLen(taskQueueName);
    return {
      configured: true,
      status: pong === "PONG" ? "connected" : "unknown",
      queue: taskQueueName,
      depth,
      error: "",
    };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      queue: taskQueueName,
      depth: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
      resolveUpload(saved);
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
  return { filename, url: `/files/output/${filename}`, size: buffer.length, mime: match[1] };
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
  return { filename, url: `/files/output/${filename}`, size: buffer.length, mime: match[1] };
}

async function saveRemoteImageToOutput(sourceUrl: string, user: CurrentUser) {
  await ensureDataDirs(user);
  if (!/^https?:\/\//i.test(sourceUrl)) throw new Error("远程图片 URL 必须以 http:// 或 https:// 开头");
  const upstream = await fetch(sourceUrl, { signal: AbortSignal.timeout(120000) });
  if (!upstream.ok) throw new Error(`下载远程图片失败 ${upstream.status}`);
  const mime = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!mime.startsWith("image/")) throw new Error("远程 URL 不是图片");
  const ext = imageExtensionFromMime(mime) || imageExtensionFromUrl(sourceUrl) || "png";
  const buffer = Buffer.from(await upstream.arrayBuffer());
  const filename = `external_image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(join(userDataDirs(user).outputDir, filename), buffer);
  return { filename, url: `/files/output/${filename}`, size: buffer.length, mime };
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
  return { filename, url: `/files/output/${filename}`, size: buffer.length, mime };
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
  return { filename, url: `/files/output/${filename}`, size: buffer.length, mime };
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
        "select id, kind, name, created_at, updated_at from xh_resource_categories where owner_id = $1 order by created_at asc",
        [user.id],
      ),
      pool.query(
        `select a.id, a.kind, a.title, a.url, a.mime, a.size_bytes, a.category_id, a.tags, a.favorite, a.last_used_at, a.metadata, a.created_at, a.updated_at
         from xh_assets a
         left join xh_resource_categories c on c.id = a.category_id
         where a.owner_id = $1
         order by a.created_at desc`,
        [user.id],
      ),
    ]);
    if (categoriesResult.rows.length > 0 || itemsResult.rows.length > 0) {
      return {
        categories: categoriesResult.rows.map((row) => toResourceCategory(row)),
        items: itemsResult.rows.map((row) => toResourceItem(row)),
      };
    }
    const fileDb = await readResourceDbFromFile(user);
    if (fileDb.categories.length > 0 || fileDb.items.length > 0) {
      await writeResourceDb(fileDb, user);
      return fileDb;
    }
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
    return JSON.parse(await readFile(userDataDirs(user).resourceDbPath, "utf-8")) as ResourceDb;
  } catch {
    return { categories: [], items: [] };
  }
}

async function writeResourceDb(db: ResourceDb, user: CurrentUser) {
  if (usePostgresRepository()) {
    const pool = await getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from xh_assets where owner_id = $1", [user.id]);
      await client.query("delete from xh_resource_categories where owner_id = $1", [user.id]);
      for (const category of Array.isArray(db.categories) ? db.categories : []) {
        await client.query(
          `insert into xh_resource_categories (id, owner_id, kind, name, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [
            category.id,
            user.id,
            normalizeResourceKind(category.kind) || "image",
            safeText(category.name, "未分类"),
            millisToDate(category.createdAt),
            millisToDate(category.updatedAt),
          ],
        );
      }
      for (const item of Array.isArray(db.items) ? db.items : []) {
        await client.query(
          `insert into xh_assets (id, owner_id, project_id, kind, title, url, mime, size_bytes, metadata, category_id, tags, favorite, last_used_at, created_at, updated_at)
           values ($1, $2, null, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12, $13, $14)`,
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
            millisToDate(item.createdAt),
            millisToDate(item.updatedAt),
          ],
        );
      }
      await client.query("commit");
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
  };
  const db = await readResourceDb(user);
  db.items.unshift(item);
  await writeResourceDb(db, user);
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

function normalizeGenerationLibraryKind(value: unknown): GenerationLibraryKind | "" {
  const kind = safeText(value).toLowerCase();
  return ["image", "video", "audio"].includes(kind) ? (kind as GenerationLibraryKind) : "";
}

async function readGenerationLibraryDb(
  user: CurrentUser,
  options: { cleanup?: boolean } = {},
): Promise<GenerationLibraryDb> {
  await ensureDataDirs(user);
  let db: GenerationLibraryDb;
  try {
    const raw = JSON.parse(await readFile(userDataDirs(user).generationLibraryDbPath, "utf-8")) as GenerationLibraryDb;
    db = { items: Array.isArray(raw.items) ? raw.items.map(sanitizeGenerationLibraryItem).filter(Boolean) as GenerationLibraryItem[] : [] };
  } catch {
    db = { items: [] };
  }
  if (!options.cleanup) return db;
  const now = Date.now();
  const active: GenerationLibraryItem[] = [];
  const expired: GenerationLibraryItem[] = [];
  for (const item of db.items) {
    if (item.expiresAt <= now) expired.push(item);
    else active.push(item);
  }
  if (expired.length > 0) {
    await writeGenerationLibraryDb({ items: active }, user);
    for (const item of expired) {
      await deleteGenerationLibraryLocalFile(item, user);
    }
    return { items: active };
  }
  return db;
}

function sanitizeGenerationLibraryItem(item: unknown): GenerationLibraryItem | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Partial<GenerationLibraryItem>;
  const kind = normalizeGenerationLibraryKind(raw.kind);
  const url = safeText(raw.url || raw.fileUrl);
  if (!kind || !url) return null;
  const createdAt = Number(raw.createdAt) || Date.now();
  const expiresAt = Number(raw.expiresAt) || createdAt + GENERATION_LIBRARY_TTL_MS;
  return {
    id: safeText(raw.id, `gen-${createdAt}-${safeSlug(url).slice(0, 8)}`),
    kind,
    title: safeText(raw.title, basename(url)),
    url,
    fileUrl: safeText(raw.fileUrl, url),
    mime: safeText(raw.mime, inferMime(url)),
    size: Number(raw.size) || 0,
    createdAt,
    updatedAt: Number(raw.updatedAt) || createdAt,
    expiresAt,
    sourceNodeId: safeText(raw.sourceNodeId),
    sourceCanvasId: safeText(raw.sourceCanvasId),
    taskId: safeText(raw.taskId),
    providerId: safeText(raw.providerId),
    modelId: safeText(raw.modelId),
  };
}

async function writeGenerationLibraryDb(db: GenerationLibraryDb, user: CurrentUser) {
  await ensureDataDirs(user);
  await writeFile(userDataDirs(user).generationLibraryDbPath, JSON.stringify({ items: db.items }, null, 2), "utf-8");
}

async function addGenerationLibraryItem(raw: unknown, user: CurrentUser, existingDb?: GenerationLibraryDb) {
  const payload = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kind = normalizeGenerationLibraryKind(payload.kind);
  const url = safeText(payload.url || payload.fileUrl);
  if (!kind || !url) throw new Error("生成库素材缺少类型或 URL");
  const now = Date.now();
  const expiresAt = now + GENERATION_LIBRARY_TTL_MS;
  const db = existingDb || await readGenerationLibraryDb(user, { cleanup: true });
  const duplicateIndex = db.items.findIndex((item) => item.kind === kind && item.url === url);
  const existing = duplicateIndex >= 0 ? db.items[duplicateIndex] : null;
  const item: GenerationLibraryItem = {
    id: existing ? existing.id : `gen-${now}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    title: safeText(payload.title, basename(url)),
    url,
    fileUrl: url,
    mime: safeText(payload.mime, inferMime(url)),
    size: Number(payload.size) || 0,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    expiresAt: existing ? existing.expiresAt : expiresAt,
    sourceNodeId: safeText(payload.sourceNodeId),
    sourceCanvasId: safeText(payload.sourceCanvasId),
    taskId: safeText(payload.taskId),
    providerId: safeText(payload.providerId),
    modelId: safeText(payload.modelId),
  };
  const nextItems = duplicateIndex >= 0
    ? [item, ...db.items.filter((_, index) => index !== duplicateIndex)]
    : [item, ...db.items];
  await writeGenerationLibraryDb({ items: nextItems }, user);
  return { ...item, duplicate: duplicateIndex >= 0 };
}

async function deleteGenerationLibraryLocalFile(item: GenerationLibraryItem, user: CurrentUser) {
  const dirs = userDataDirs(user);
  const url = safeText(item.fileUrl || item.url);
  if (!url.startsWith("/files/output/")) return;
  const filename = decodeURIComponent(url.slice("/files/output/".length));
  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) return;
  await unlink(join(dirs.outputDir, filename)).catch(() => undefined);
}
