import type { IncomingMessage, ServerResponse } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { safeSlug, safeText } from "./api-sanitizers.js";
import { readJsonBody } from "./http-session-utils.js";
import {
  buildComfyuiWorkflowDraft,
  createComfyuiWorkflowRegistry,
  normalizeComfyuiInstanceRecord,
  normalizeComfyuiWorkflowSchema,
  type ComfyuiInstanceRecord,
  type ComfyuiWorkflowDraft,
} from "./comfyui-workflow-registry.js";

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

interface ComfyuiInstanceRouteDeps {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number, headers?: Record<string, string>) => void;
  appendAudit: (
    actor: CurrentUserShape,
    action: string,
    targetType: string,
    targetId: string,
    summary: string,
    requestContext: RequestContextShape,
  ) => Promise<void>;
  adminDir: string;
}

interface InternalComfyuiConnectorRouteDeps {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number, headers?: Record<string, string>) => void;
  adminDir: string;
  connectorToken: string;
}

interface InstanceMutationBody {
  id?: string;
  name?: string;
  tailscaleAddress?: string;
  baseUrl?: string;
  health?: "online" | "offline" | "degraded";
  concurrency?: number;
  capabilities?: unknown;
  note?: string;
  connectorVersion?: string;
}

interface ConnectorMutationBody extends InstanceMutationBody {
  heartbeatIntervalMs?: number;
}

interface WorkflowMutationBody {
  id?: string;
  title?: string;
  description?: string;
  instanceId?: string;
  workflowJson?: unknown;
  workflow?: unknown;
  inputSchema?: unknown;
  exposedFields?: unknown;
  defaultValues?: unknown;
  hiddenFields?: unknown;
  outputSchema?: unknown;
  sharedWorkflowId?: string;
}

function sendComfyuiError(response: ServerResponse, statusCode: number, error: string, payload: Record<string, unknown> = {}) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-credentials": "true",
  });
  response.end(JSON.stringify({ ok: false, success: false, error, ...payload }));
}

function parseWorkflowJsonPayload(raw: unknown) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function mergeWorkflowDraft(existing: ComfyuiWorkflowDraft, body: WorkflowMutationBody) {
  return normalizeComfyuiWorkflowSchema({
    ...existing,
    ...body,
    workflowJson: parseWorkflowJsonPayload(body.workflowJson ?? body.workflow ?? existing.workflowJson),
    inputSchema: Array.isArray(body.inputSchema) ? body.inputSchema : existing.inputSchema,
    exposedFields: Array.isArray(body.exposedFields) ? body.exposedFields : existing.exposedFields,
    defaultValues: body.defaultValues && typeof body.defaultValues === "object" && !Array.isArray(body.defaultValues) ? body.defaultValues : existing.defaultValues,
    hiddenFields: Array.isArray(body.hiddenFields) ? body.hiddenFields : existing.hiddenFields,
    outputSchema: Array.isArray(body.outputSchema) ? body.outputSchema : existing.outputSchema,
    instanceId: existing.instanceId,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
    sharedWorkflowId: existing.sharedWorkflowId,
    publishedAt: existing.publishedAt,
    publishedBy: existing.publishedBy,
  });
}

function assertAdmin(currentUser: CurrentUserShape | null | undefined) {
  return Boolean(currentUser && currentUser.role === "admin");
}

function workflowSummary(workflow: ComfyuiWorkflowDraft) {
  return `ComfyUI 工作流 ${workflow.title}`;
}

function resolveHeartbeatIntervalMs(value: unknown) {
  const interval = Number(value);
  if (!Number.isFinite(interval)) return 15000;
  return Math.max(5000, Math.min(300000, Math.floor(interval)));
}

interface ComfyuiConnectionTestResult {
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

async function testComfyuiConnection(baseUrl: string): Promise<ComfyuiConnectionTestResult> {
  const startTime = Date.now();

  try {
    const systemStatsUrl = new URL("/system_stats", baseUrl);
    const queueUrl = new URL("/queue", baseUrl);

    const [systemStats, queueInfo] = await Promise.all([
      fetchComfyuiEndpoint(systemStatsUrl.toString()),
      fetchComfyuiEndpoint(queueUrl.toString()),
    ]);

    const latency = Date.now() - startTime;

    return {
      success: true,
      latency,
      systemStats: systemStats && typeof systemStats === "object" ? systemStats as any : undefined,
      queueInfo: queueInfo && typeof queueInfo === "object" && "queue_running" in queueInfo && "queue_pending" in queueInfo
        ? { running: Number(queueInfo.queue_running) || 0, pending: Number(queueInfo.queue_pending) || 0 }
        : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorDetail: error instanceof Error && error.stack ? error.stack : undefined,
    };
  }
}

async function fetchComfyuiEndpoint(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const requester = parsedUrl.protocol === "https:" ? httpsRequest : httpRequest;

    const req = requester({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      timeout: 10000,
      headers: {
        "user-agent": "xinghuan-comfyui-test/1.0",
        "accept": "application/json",
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        } catch (parseError) {
          reject(new Error(`JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Connection timeout"));
    });

    req.end();
  });
}

export async function handleInternalComfyuiConnectorRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  deps: InternalComfyuiConnectorRouteDeps;
}) {
  const { request, response, url, deps } = input;
  if (!url.pathname.startsWith("/api/internal/comfyui/connectors/")) return false;
  if (!deps.connectorToken) {
    sendComfyuiError(response, 503, "COMFYUI_CONNECTOR_DISABLED");
    return true;
  }
  const headerToken = safeText(request.headers["x-comfyui-connector-token"]);
  if (!headerToken || headerToken !== deps.connectorToken) {
    sendComfyuiError(response, 403, "COMFYUI_CONNECTOR_FORBIDDEN");
    return true;
  }
  const registry = createComfyuiWorkflowRegistry(deps.adminDir);

  if (url.pathname === "/api/internal/comfyui/connectors/register" && request.method === "POST") {
    const body = await readJsonBody<ConnectorMutationBody>(request);
    const instance = normalizeComfyuiInstanceRecord({
      ...body,
      id: safeSlug(body.id, safeSlug(body.name, `comfyui-${Date.now().toString(36)}`)),
      capabilities: Array.isArray(body.capabilities) ? body.capabilities : [],
      health: body.health === "offline" || body.health === "degraded" ? body.health : "online",
      lastSeenAt: Date.now(),
      updatedAt: Date.now(),
    });
    const state = await registry.updateRegistry((current) => {
      const instances = current.instances.filter((item) => item.id !== instance.id);
      instances.unshift(instance);
      return { ...current, instances };
    });
    const created = state.instances.find((item) => item.id === instance.id) || instance;
    deps.sendT8(response, {
      instance: created,
      heartbeatIntervalMs: resolveHeartbeatIntervalMs(body.heartbeatIntervalMs),
      registeredAt: Date.now(),
    });
    return true;
  }

  if (url.pathname === "/api/internal/comfyui/connectors/heartbeat" && request.method === "POST") {
    const body = await readJsonBody<ConnectorMutationBody>(request);
    const instanceId = safeSlug(body.id, "");
    if (!instanceId) {
      sendComfyuiError(response, 400, "INSTANCE_ID_REQUIRED");
      return true;
    }

    const before = await registry.readRegistry();
    const existed = before.instances.find((item) => item.id === instanceId);
    const state = existed
      ? await registry.touchHeartbeat(instanceId, body)
      : await registry.updateRegistry((current) => {
          const instance = normalizeComfyuiInstanceRecord({
            ...body,
            id: instanceId,
            capabilities: Array.isArray(body.capabilities) ? body.capabilities : [],
            health: body.health === "offline" || body.health === "degraded" ? body.health : "online",
            lastSeenAt: Date.now(),
            updatedAt: Date.now(),
          });
          const instances = current.instances.filter((item) => item.id !== instance.id);
          instances.unshift(instance);
          return { ...current, instances };
        });
    const updated = state.instances.find((item) => item.id === instanceId);
    if (!updated) {
      sendComfyuiError(response, 404, "INSTANCE_NOT_FOUND");
      return true;
    }
    deps.sendT8(response, {
      instance: updated,
      heartbeatIntervalMs: resolveHeartbeatIntervalMs(body.heartbeatIntervalMs),
      heartbeatAt: Date.now(),
    });
    return true;
  }

  return false;
}

export async function handleComfyuiInstanceRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  adminUser: CurrentUserShape;
  requestContext: RequestContextShape;
  deps: ComfyuiInstanceRouteDeps;
}) {
  const { request, response, url, adminUser, requestContext, deps } = input;
  if (!assertAdmin(adminUser)) {
    sendComfyuiError(response, 403, "ADMIN_REQUIRED");
    return true;
  }

  const registry = createComfyuiWorkflowRegistry(deps.adminDir);
  const instanceRoot = "/api/admin/comfyui/instances";

  if (url.pathname === instanceRoot) {
    if (request.method === "GET") {
      const state = await registry.readRegistry();
      deps.sendT8(response, {
        revision: state.revision,
        updatedAt: state.updatedAt,
        instances: state.instances,
        sharedWorkflows: state.sharedWorkflows,
        workflowCount: state.workflows.length,
      });
      await deps.appendAudit(adminUser, "comfyui.instance.read", "comfyui-instance", "instances", "查看 ComfyUI 实例列表", requestContext);
      return true;
    }

    if (request.method === "POST") {
      const body = await readJsonBody<InstanceMutationBody>(request);
      const instance = normalizeComfyuiInstanceRecord({
        ...body,
        id: safeSlug(body.id, safeSlug(body.name, `comfyui-${Date.now().toString(36)}`)),
        capabilities: Array.isArray(body.capabilities) ? body.capabilities : [],
      });
      const state = await registry.updateRegistry((current) => {
        const instances = current.instances.filter((item) => item.id !== instance.id);
        instances.unshift(instance);
        return { ...current, instances };
      });
      const created = state.instances.find((item) => item.id === instance.id) || instance;
      await deps.appendAudit(adminUser, "comfyui.instance.create", "comfyui-instance", created.id, `创建 ComfyUI 实例 ${created.name}`, requestContext);
      deps.sendT8(response, created, 201);
      return true;
    }
  }

  const instanceMatch = url.pathname.match(/^\/api\/admin\/comfyui\/instances\/([^/]+)$/);
  if (instanceMatch && request.method === "PATCH") {
    const instanceId = decodeURIComponent(instanceMatch[1]);
    const body = await readJsonBody<InstanceMutationBody>(request);
    const state = await registry.updateRegistry((current) => {
      const now = Date.now();
      const instances = current.instances.map((item) => (
        item.id === instanceId
          ? normalizeComfyuiInstanceRecord({
              ...item,
              ...body,
              id: instanceId,
              capabilities: Array.isArray(body.capabilities) ? body.capabilities : item.capabilities,
              updatedAt: now,
              lastSeenAt: item.lastSeenAt,
            })
          : item
      ));
      return { ...current, instances };
    });
    const updated = state.instances.find((item) => item.id === instanceId);
    if (!updated) {
      sendComfyuiError(response, 404, "INSTANCE_NOT_FOUND");
      return true;
    }
    await deps.appendAudit(adminUser, "comfyui.instance.update", "comfyui-instance", instanceId, `更新 ComfyUI 实例 ${updated.name}`, requestContext);
    deps.sendT8(response, updated);
    return true;
  }

  if (instanceMatch && request.method === "DELETE") {
    const instanceId = decodeURIComponent(instanceMatch[1]);
    const before = await registry.readRegistry();
    const existed = before.instances.some((item) => item.id === instanceId);
    if (!existed) {
      sendComfyuiError(response, 404, "INSTANCE_NOT_FOUND");
      return true;
    }
    await registry.updateRegistry((current) => {
      const instances = current.instances.filter((item) => item.id !== instanceId);
      const workflows = current.workflows.filter((workflow) => workflow.instanceId !== instanceId);
      const sharedWorkflows = current.sharedWorkflows.filter((workflow) => workflow.instanceId !== instanceId);
      return { ...current, instances, workflows, sharedWorkflows };
    });
    await deps.appendAudit(adminUser, "comfyui.instance.delete", "comfyui-instance", instanceId, `删除 ComfyUI 实例 ${instanceId}`, requestContext);
    deps.sendT8(response, { deleted: true, instanceId });
    return true;
  }

  const heartbeatMatch = url.pathname.match(/^\/api\/admin\/comfyui\/instances\/([^/]+)\/heartbeat$/);
  if (heartbeatMatch && request.method === "POST") {
    const instanceId = decodeURIComponent(heartbeatMatch[1]);
    const body = await readJsonBody<InstanceMutationBody>(request);
    const state = await registry.updateRegistry((current) => {
      const now = Date.now();
      const instances = current.instances.map((item) => (
        item.id === instanceId
          ? normalizeComfyuiInstanceRecord({
              ...item,
              ...body,
              id: instanceId,
              health: body.health === "offline" || body.health === "degraded" ? body.health : "online",
              capabilities: Array.isArray(body.capabilities) ? body.capabilities : item.capabilities,
              lastSeenAt: now,
              updatedAt: now,
            })
          : item
      ));
      return { ...current, instances };
    });
    const updated = state.instances.find((item) => item.id === instanceId);
    if (!updated) {
      sendComfyuiError(response, 404, "INSTANCE_NOT_FOUND");
      return true;
    }
    await deps.appendAudit(adminUser, "comfyui.instance.heartbeat", "comfyui-instance", instanceId, `刷新 ComfyUI 实例 ${updated.name} 心跳`, requestContext);
    deps.sendT8(response, updated);
    return true;
  }

  const capabilitiesMatch = url.pathname.match(/^\/api\/admin\/comfyui\/instances\/([^/]+)\/capabilities$/);
  if (capabilitiesMatch && request.method === "PATCH") {
    const instanceId = decodeURIComponent(capabilitiesMatch[1]);
    const body = await readJsonBody<{ capabilities?: unknown }>(request);
    const state = await registry.updateRegistry((current) => {
      const now = Date.now();
      const instances = current.instances.map((item) => (
        item.id === instanceId
          ? { ...item, capabilities: Array.isArray(body.capabilities) ? body.capabilities.map((value) => safeText(value)).filter(Boolean) : item.capabilities, lastSeenAt: now, updatedAt: now }
          : item
      ));
      return { ...current, instances };
    });
    const updated = state.instances.find((item) => item.id === instanceId);
    if (!updated) {
      sendComfyuiError(response, 404, "INSTANCE_NOT_FOUND");
      return true;
    }
    await deps.appendAudit(adminUser, "comfyui.instance.capabilities", "comfyui-instance", instanceId, `更新 ComfyUI 实例 ${updated.name} 能力`, requestContext);
    deps.sendT8(response, updated);
    return true;
  }

  const testConnectionMatch = url.pathname.match(/^\/api\/admin\/comfyui\/instances\/([^/]+)\/test-connection$/);
  if (testConnectionMatch && request.method === "POST") {
    const instanceId = decodeURIComponent(testConnectionMatch[1]);
    const state = await registry.readRegistry();
    const instance = state.instances.find((item) => item.id === instanceId);
    if (!instance) {
      sendComfyuiError(response, 404, "INSTANCE_NOT_FOUND");
      return true;
    }

    const testResult = await testComfyuiConnection(instance.baseUrl);
    await deps.appendAudit(adminUser, "comfyui.instance.testConnection", "comfyui-instance", instanceId, `测试 ComfyUI 实例 ${instance.name} 连接`, requestContext);
    deps.sendT8(response, testResult);
    return true;
  }

  const workflowsRootMatch = url.pathname.match(/^\/api\/admin\/comfyui\/instances\/([^/]+)\/workflows$/);
  if (workflowsRootMatch && request.method === "GET") {
    const instanceId = decodeURIComponent(workflowsRootMatch[1]);
    const workflows = (await registry.listWorkflows(instanceId)).sort((a, b) => b.updatedAt - a.updatedAt);
    deps.sendT8(response, { instanceId, workflows });
    await deps.appendAudit(adminUser, "comfyui.workflow.read", "comfyui-workflow", instanceId, `查看 ComfyUI 实例 ${instanceId} 工作流`, requestContext);
    return true;
  }

  if (workflowsRootMatch && request.method === "POST") {
    const instanceId = decodeURIComponent(workflowsRootMatch[1]);
    const body = await readJsonBody<WorkflowMutationBody>(request);
    const workflowJson = parseWorkflowJsonPayload(body.workflowJson ?? body.workflow);
    if (!Object.keys(workflowJson).length) {
      sendComfyuiError(response, 400, "WORKFLOW_JSON_REQUIRED");
      return true;
    }
    const draft = buildComfyuiWorkflowDraft({
      instanceId,
      workflowJson,
      title: safeText(body.title, "ComfyUI 工作流"),
      description: safeText(body.description),
      inputSchema: Array.isArray(body.inputSchema) ? body.inputSchema as any : undefined,
      exposedFields: Array.isArray(body.exposedFields) ? body.exposedFields as any : undefined,
      defaultValues: body.defaultValues && typeof body.defaultValues === "object" && !Array.isArray(body.defaultValues) ? body.defaultValues as Record<string, unknown> : undefined,
      hiddenFields: Array.isArray(body.hiddenFields) ? body.hiddenFields.map((value) => safeText(value)).filter(Boolean) : undefined,
      outputSchema: Array.isArray(body.outputSchema) ? body.outputSchema as any : undefined,
      sharedWorkflowId: safeText(body.sharedWorkflowId),
    });
    const state = await registry.updateRegistry((current) => {
      const workflows = current.workflows.filter((item) => item.instanceId !== instanceId || item.id !== draft.id);
      workflows.unshift(draft);
      return { ...current, workflows };
    });
    const created = state.workflows.find((item) => item.id === draft.id && item.instanceId === instanceId) || draft;
    await deps.appendAudit(adminUser, "comfyui.workflow.create", "comfyui-workflow", created.id, `创建 ${workflowSummary(created)}`, requestContext);
    deps.sendT8(response, created, 201);
    return true;
  }

  const workflowMatch = url.pathname.match(/^\/api\/admin\/comfyui\/instances\/([^/]+)\/workflows\/([^/]+)$/);
  if (workflowMatch && request.method === "PATCH") {
    const instanceId = decodeURIComponent(workflowMatch[1]);
    const workflowId = decodeURIComponent(workflowMatch[2]);
    const body = await readJsonBody<WorkflowMutationBody>(request);
    const state = await registry.updateRegistry((current) => {
      const existing = current.workflows.find((item) => item.instanceId === instanceId && item.id === workflowId);
      if (!existing) return current;
      const updated = mergeWorkflowDraft(existing, body);
      const workflows = current.workflows.map((item) => (
        item.instanceId === instanceId && item.id === workflowId ? updated : item
      ));
      return { ...current, workflows };
    });
    const updated = state.workflows.find((item) => item.instanceId === instanceId && item.id === workflowId);
    if (!updated) {
      sendComfyuiError(response, 404, "WORKFLOW_NOT_FOUND");
      return true;
    }
    await deps.appendAudit(adminUser, "comfyui.workflow.update", "comfyui-workflow", workflowId, `更新 ${workflowSummary(updated)}`, requestContext);
    deps.sendT8(response, updated);
    return true;
  }

  if (workflowMatch && request.method === "DELETE") {
    const instanceId = decodeURIComponent(workflowMatch[1]);
    const workflowId = decodeURIComponent(workflowMatch[2]);
    const before = await registry.readRegistry();
    const existed = before.workflows.some((item) => item.instanceId === instanceId && item.id === workflowId);
    if (!existed) {
      sendComfyuiError(response, 404, "WORKFLOW_NOT_FOUND");
      return true;
    }
    await registry.deleteWorkflow(instanceId, workflowId);
    await deps.appendAudit(adminUser, "comfyui.workflow.delete", "comfyui-workflow", workflowId, `删除 ComfyUI 工作流 ${workflowId}`, requestContext);
    deps.sendT8(response, { deleted: true, instanceId, workflowId });
    return true;
  }

  const pushMatch = url.pathname.match(/^\/api\/admin\/comfyui\/instances\/([^/]+)\/workflows\/([^/]+)\/push-to-shared$/);
  if (pushMatch && request.method === "POST") {
    const instanceId = decodeURIComponent(pushMatch[1]);
    const workflowId = decodeURIComponent(pushMatch[2]);
    const state = await registry.pushWorkflowToShared(instanceId, workflowId, adminUser.id);
    const workflow = state.workflows.find((item) => item.instanceId === instanceId && item.id === workflowId);
    const sharedWorkflow = workflow?.sharedWorkflowId
      ? state.sharedWorkflows.find((item) => item.id === workflow.sharedWorkflowId || item.sharedWorkflowId === workflow.sharedWorkflowId)
      : state.sharedWorkflows.find((item) => item.id === workflowId || item.sharedWorkflowId === workflowId);
    if (!workflow || !sharedWorkflow) {
      sendComfyuiError(response, 404, "WORKFLOW_NOT_FOUND");
      return true;
    }
    await deps.appendAudit(adminUser, "comfyui.workflow.pushToShared", "comfyui-workflow", workflowId, `推送 ${workflowSummary(workflow)} 到共享区`, requestContext);
    deps.sendT8(response, { workflow, sharedWorkflow });
    return true;
  }

  return false;
}
