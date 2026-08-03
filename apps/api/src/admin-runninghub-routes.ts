import type { IncomingMessage, ServerResponse } from "node:http";
import { safeText } from "./api-sanitizers.js";
import { readJsonBody } from "./http-session-utils.js";
import type {
  RunningHubExecutionRules,
  RunningHubFieldDefinition,
  RunningHubOutputDefinition,
} from "./runninghub-catalog.js";
import type { RhCatalogGroup } from "@xinghuan/shared";

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

interface RunningHubCatalogItemResponse {
  catalogId: string;
  title: string;
}

interface RunningHubCatalogTestResponse {
  ok: boolean;
}

interface RunningHubCatalogItemsResponse {
  items: unknown[];
}

interface RunningHubGroupMutationBody {
  providerId?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  sortOrder?: number;
}

interface RunningHubCatalogRouteDeps {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number) => void;
  appendAudit: (
    actor: CurrentUserShape,
    action: string,
    targetType: string,
    targetId: string,
    summary: string,
    requestContext: RequestContextShape,
  ) => Promise<void>;
  adminRunningHubCatalogItems: () => Promise<unknown[]>;
  createAdminRunningHubCatalogItem: (input: RunningHubCatalogMutationBody) => Promise<RunningHubCatalogItemResponse>;
  updateAdminRunningHubCatalogItem: (catalogId: string, input: RunningHubCatalogMutationBody) => Promise<RunningHubCatalogItemResponse>;
  deleteAdminRunningHubCatalogItem: (catalogId: string) => Promise<RunningHubCatalogItemResponse>;
  testAdminRunningHubCatalogItem: (catalogId: string, testPayloadValue?: string) => Promise<RunningHubCatalogTestResponse>;
  analyzeRunningHubCatalogDraft: (input: RunningHubCatalogAnalyzeBody) => Promise<unknown>;
  listAdminRunningHubGroups: (providerId: string) => Promise<RhCatalogGroup[]>;
  createAdminRunningHubGroup: (input: RunningHubGroupMutationBody) => Promise<RhCatalogGroup>;
  updateAdminRunningHubGroup: (groupId: string, input: RunningHubGroupMutationBody) => Promise<RhCatalogGroup>;
  deleteAdminRunningHubGroup: (groupId: string) => Promise<{ groupId: string; ungroupedCatalogIds: string[] }>;
}

interface RunningHubCatalogMutationBody {
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
}

interface RunningHubCatalogAnalyzeBody {
  providerId?: string;
  kind?: "app" | "workflow";
  sourceUrl?: string;
  pageId?: string;
  runTargetId?: string;
  docUrl?: string;
  requestExample?: string;
  responseExample?: string;
  notes?: string;
}

export async function handleAdminRunningHubRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  adminUser: CurrentUserShape;
  requestContext: RequestContextShape;
  deps: RunningHubCatalogRouteDeps;
}) {
  const { request, response, url, adminUser, requestContext, deps } = input;

  if (url.pathname === "/api/admin/runninghub/items" && request.method === "GET") {
    const items = await deps.adminRunningHubCatalogItems();
    await deps.appendAudit(adminUser, "runninghub.catalog.read", "runninghub", "catalog-items", "查看 RunningHub 条目目录", requestContext);
    deps.sendT8(response, { items } satisfies RunningHubCatalogItemsResponse);
    return true;
  }

  if (url.pathname === "/api/admin/runninghub/groups" && request.method === "GET") {
    const providerId = safeText(url.searchParams.get("providerId"));
    deps.sendT8(response, await deps.listAdminRunningHubGroups(providerId));
    return true;
  }

  if (url.pathname === "/api/admin/runninghub/groups" && request.method === "POST") {
    const body = await readJsonBody<RunningHubGroupMutationBody>(request);
    const group = await deps.createAdminRunningHubGroup(body);
    await deps.appendAudit(adminUser, "runninghub.group.create", "runninghub-group", group.id, `创建 RunningHub 分组 ${group.name}`, requestContext);
    deps.sendT8(response, group, 201);
    return true;
  }

  const runningHubGroupMatch = url.pathname.match(/^\/api\/admin\/runninghub\/groups\/([^/]+)$/);
  if (runningHubGroupMatch && request.method === "PATCH") {
    const groupId = decodeURIComponent(runningHubGroupMatch[1]);
    const body = await readJsonBody<RunningHubGroupMutationBody>(request);
    const group = await deps.updateAdminRunningHubGroup(groupId, body);
    await deps.appendAudit(adminUser, "runninghub.group.update", "runninghub-group", group.id, `更新 RunningHub 分组 ${group.name}`, requestContext);
    deps.sendT8(response, group);
    return true;
  }

  if (runningHubGroupMatch && request.method === "DELETE") {
    const groupId = decodeURIComponent(runningHubGroupMatch[1]);
    const result = await deps.deleteAdminRunningHubGroup(groupId);
    await deps.appendAudit(adminUser, "runninghub.group.delete", "runninghub-group", groupId, `删除 RunningHub 分组，${result.ungroupedCatalogIds.length} 个条目移至未分组`, requestContext);
    deps.sendT8(response, result);
    return true;
  }

  if (url.pathname === "/api/admin/runninghub/items" && request.method === "POST") {
    const body = await readJsonBody<RunningHubCatalogMutationBody>(request);
    const created = await deps.createAdminRunningHubCatalogItem(body);
    await deps.appendAudit(adminUser, "runninghub.item.create", "runninghub", created.catalogId, `新建 RunningHub 条目 ${created.title}`, requestContext);
    deps.sendT8(response, created, 201);
    return true;
  }

  const runningHubItemMatch = url.pathname.match(/^\/api\/admin\/runninghub\/items\/([^/]+)$/);
  if (runningHubItemMatch && request.method === "PATCH") {
    const catalogId = decodeURIComponent(runningHubItemMatch[1]);
    const body = await readJsonBody<RunningHubCatalogMutationBody>(request);
    const updated = await deps.updateAdminRunningHubCatalogItem(catalogId, body);
    await deps.appendAudit(adminUser, "runninghub.item.update", "runninghub", catalogId, `更新 RunningHub 条目 ${updated.title}`, requestContext);
    deps.sendT8(response, updated);
    return true;
  }

  if (runningHubItemMatch && request.method === "DELETE") {
    const catalogId = decodeURIComponent(runningHubItemMatch[1]);
    const deleted = await deps.deleteAdminRunningHubCatalogItem(catalogId);
    await deps.appendAudit(adminUser, "runninghub.item.delete", "runninghub", catalogId, `删除 RunningHub 条目 ${deleted.title}`, requestContext);
    deps.sendT8(response, { deleted: true, catalogId });
    return true;
  }

  const runningHubItemTestMatch = url.pathname.match(/^\/api\/admin\/runninghub\/items\/([^/]+)\/test$/);
  if (runningHubItemTestMatch && request.method === "POST") {
    const catalogId = decodeURIComponent(runningHubItemTestMatch[1]);
    const body = await readJsonBody<{ testPayload?: string }>(request);
    const result = await deps.testAdminRunningHubCatalogItem(catalogId, body.testPayload);
    await deps.appendAudit(adminUser, "runninghub.item.test", "runninghub", catalogId, `测试 RunningHub 条目 ${catalogId}: ${result.ok ? "ok" : "error"}`, requestContext);
    deps.sendT8(response, result);
    return true;
  }

  if (url.pathname === "/api/admin/runninghub/analyze" && request.method === "POST") {
    const body = await readJsonBody<RunningHubCatalogAnalyzeBody>(request);
    const draft = await deps.analyzeRunningHubCatalogDraft(body);
    await deps.appendAudit(
      adminUser,
      "runninghub.item.analyze",
      "runninghub",
      safeText(body.providerId || "runninghub"),
      `分析 RunningHub ${safeText(body.kind || "workflow")} 条目草案`,
      requestContext,
    );
    deps.sendT8(response, draft);
    return true;
  }

  return false;
}
