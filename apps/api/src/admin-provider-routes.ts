import type { IncomingMessage, ServerResponse } from "node:http";
import { safeText, safeSlug } from "./api-sanitizers.js";
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

export interface AdminProviderRecordShape {
  id: string;
  sortOrder?: number;
  name: string;
  baseUrl: string;
  protocol?: unknown;
  enabled: boolean;
  apiKey?: string;
  apiKeyPreview?: string;
  lastProbeStatus?: string;
  lastProbeMessage?: string;
  lastFetchedAt?: number;
  rhApps?: unknown;
  rhWorkflows?: unknown;
  rhKeyPool?: unknown;
  msLoras?: unknown;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

interface ProviderProbeResultShape {
  ok?: boolean;
  message?: string;
}

interface ProviderFetchModelsResultShape {
  total: number;
}

export interface AdminProviderRouteDeps {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number) => void;
  appendAudit: (
    actor: CurrentUserShape,
    action: string,
    targetType: string,
    targetId: string,
    summary: string,
    requestContext: RequestContextShape,
  ) => Promise<void>;
  readProviderRecords: () => Promise<AdminProviderRecordShape[]>;
  findProviderRecordById: (providerId: string) => Promise<AdminProviderRecordShape | null>;
  insertProviderRecord: (provider: AdminProviderRecordShape) => Promise<AdminProviderRecordShape>;
  updateProviderRecord: (providerId: string, transform: (provider: AdminProviderRecordShape) => AdminProviderRecordShape) => Promise<AdminProviderRecordShape>;
  deleteProviderRecord: (providerId: string) => Promise<AdminProviderRecordShape>;
  afterDeleteProvider?: () => Promise<void>;
  reorderProviderRecords: (orderedIds: string[]) => Promise<AdminProviderRecordShape[]>;
  normalizeProviderProtocol: (value: unknown) => string;
  normalizeRunningHubEntries: (value: unknown, kind: "app" | "workflow") => unknown;
  normalizeRunningHubKeyPool: (value: unknown) => unknown;
  normalizeModelScopeLoras: (value: unknown) => unknown;
  encryptSecret: (value: string) => string;
  secretPreview: (value: string) => string;
  toPublicProvider: (provider: AdminProviderRecordShape) => unknown;
  probeProviderDraft: (provider: any) => Promise<ProviderProbeResultShape>;
  fetchProviderModelsDraft: (provider: any) => Promise<ProviderFetchModelsResultShape>;
  updateProviderProbeResult: (providerId: string, result: ProviderProbeResultShape, now: number) => Promise<void>;
  updateProviderLastFetchedAt: (providerId: string, now: number) => Promise<void>;
}

const PROVIDER_PATH = "/api/admin/providers";

export async function handleAdminProviderRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  adminUser: CurrentUserShape;
  requestContext: RequestContextShape;
  deps: AdminProviderRouteDeps;
}) {
  const { request, response, url, adminUser, requestContext, deps } = input;

  if (url.pathname === PROVIDER_PATH) {
    if (request.method === "GET") {
      const providers = await deps.readProviderRecords();
      await deps.appendAudit(adminUser, "providers.read", "provider", "providers-list", "查看 Provider 列表", requestContext);
      deps.sendT8(response, providers.map(deps.toPublicProvider));
      return true;
    }
    if (request.method === "POST") {
      const body = await readJsonBody<Partial<AdminProviderRecordShape>>(request);
      const now = Date.now();
      const apiKey = safeText(body.apiKey);
      const providers = await deps.readProviderRecords();
      const nextSortOrder = providers.reduce((max, provider) => Math.max(max, Number(provider.sortOrder) || 0), -10) + 10;
      const provider: AdminProviderRecordShape = {
        id: safeSlug(body.id, `provider-${now}`),
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : nextSortOrder,
        name: safeText(body.name, "新服务商"),
        baseUrl: safeText(body.baseUrl),
        protocol: deps.normalizeProviderProtocol(body.protocol),
        enabled: Boolean(body.enabled),
        apiKey: deps.encryptSecret(apiKey),
        apiKeyPreview: deps.secretPreview(apiKey),
        rhApps: deps.normalizeRunningHubEntries(body.rhApps, "app"),
        rhWorkflows: deps.normalizeRunningHubEntries(body.rhWorkflows, "workflow"),
        rhKeyPool: deps.normalizeRunningHubKeyPool(body.rhKeyPool),
        msLoras: deps.normalizeModelScopeLoras(body.msLoras),
        note: safeText(body.note),
        createdAt: now,
        updatedAt: now,
      };
      await deps.insertProviderRecord(provider);
      await deps.appendAudit(adminUser, "provider.create", "provider", provider.id, `创建 Provider ${provider.name}`, requestContext);
      deps.sendT8(response, deps.toPublicProvider(provider));
      return true;
    }
  }

  if (url.pathname === `${PROVIDER_PATH}/reorder` && request.method === "POST") {
    const body = await readJsonBody<{ orderedIds?: string[] }>(request);
    const providers = await deps.reorderProviderRecords(Array.isArray(body.orderedIds) ? body.orderedIds : []);
    await deps.appendAudit(adminUser, "providers.reorder", "provider", "providers-list", "调整 Provider 前台展示顺序", requestContext);
    deps.sendT8(response, providers.map(deps.toPublicProvider));
    return true;
  }

  if (url.pathname === `${PROVIDER_PATH}/probe` && request.method === "POST") {
    const body = await readJsonBody<Partial<AdminProviderRecordShape> & { apiKey?: string }>(request);
    deps.sendT8(response, await deps.probeProviderDraft(body));
    return true;
  }

  if (url.pathname === `${PROVIDER_PATH}/fetch-models` && request.method === "POST") {
    const body = await readJsonBody<Partial<AdminProviderRecordShape> & { apiKey?: string }>(request);
    deps.sendT8(response, await deps.fetchProviderModelsDraft(body));
    return true;
  }

  const providerProbeMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/probe$/);
  if (providerProbeMatch && request.method === "POST") {
    const id = decodeURIComponent(providerProbeMatch[1]);
    const body = await readJsonBody<Partial<AdminProviderRecordShape> & { apiKey?: string }>(request);
    const provider = await deps.findProviderRecordById(id);
    if (!provider) throw new Error("Provider 不存在");
    const result = await deps.probeProviderDraft({ ...provider, ...body });
    const now = Date.now();
    await deps.updateProviderProbeResult(id, result, now);
    await deps.appendAudit(adminUser, "provider.probe", "provider", id, `验证 Provider ${provider.name}: ${result.ok ? "ok" : "error"}`, requestContext);
    deps.sendT8(response, result);
    return true;
  }

  const providerFetchModelsMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/fetch-models$/);
  if (providerFetchModelsMatch && request.method === "POST") {
    const id = decodeURIComponent(providerFetchModelsMatch[1]);
    const body = await readJsonBody<Partial<AdminProviderRecordShape> & { apiKey?: string }>(request);
    const provider = await deps.findProviderRecordById(id);
    if (!provider) throw new Error("Provider 不存在");
    const result = await deps.fetchProviderModelsDraft({ ...provider, ...body });
    const now = Date.now();
    await deps.updateProviderLastFetchedAt(id, now);
    await deps.appendAudit(adminUser, "provider.fetchModels", "provider", id, `拉取 Provider ${provider.name} 模型 ${result.total}`, requestContext);
    deps.sendT8(response, result);
    return true;
  }

  const providerMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)$/);
  if (providerMatch && request.method === "PATCH") {
    const id = decodeURIComponent(providerMatch[1]);
    const body = await readJsonBody<Partial<AdminProviderRecordShape> & { clearApiKey?: boolean }>(request);
    const updated = await deps.updateProviderRecord(id, (provider) => {
      const next: AdminProviderRecordShape = {
        ...provider,
        name: body.name === undefined ? provider.name : safeText(body.name, provider.name),
        baseUrl: body.baseUrl === undefined ? provider.baseUrl : safeText(body.baseUrl),
        protocol: body.protocol === undefined ? provider.protocol : deps.normalizeProviderProtocol(body.protocol),
        enabled: body.enabled === undefined ? provider.enabled : Boolean(body.enabled),
        sortOrder: body.sortOrder === undefined || !Number.isFinite(Number(body.sortOrder))
          ? provider.sortOrder
          : Math.trunc(Number(body.sortOrder)),
        rhApps: body.rhApps === undefined ? provider.rhApps : deps.normalizeRunningHubEntries(body.rhApps, "app"),
        rhWorkflows: body.rhWorkflows === undefined ? provider.rhWorkflows : deps.normalizeRunningHubEntries(body.rhWorkflows, "workflow"),
        rhKeyPool: body.rhKeyPool === undefined ? provider.rhKeyPool : deps.normalizeRunningHubKeyPool(body.rhKeyPool),
        msLoras: body.msLoras === undefined ? provider.msLoras : deps.normalizeModelScopeLoras(body.msLoras),
        note: body.note === undefined ? provider.note : safeText(body.note),
        updatedAt: Date.now(),
      };
      if (body.clearApiKey) {
        delete next.apiKey;
        delete next.apiKeyPreview;
      }
      if (body.apiKey) {
        const apiKey = safeText(body.apiKey);
        next.apiKey = deps.encryptSecret(apiKey);
        next.apiKeyPreview = deps.secretPreview(apiKey);
      }
      return next;
    });
    await deps.appendAudit(adminUser, "provider.update", "provider", id, `更新 Provider ${updated.name}`, requestContext);
    deps.sendT8(response, deps.toPublicProvider(updated));
    return true;
  }

  if (providerMatch && request.method === "DELETE") {
    const id = decodeURIComponent(providerMatch[1]);
    const provider = await deps.deleteProviderRecord(id);
    await deps.afterDeleteProvider?.();
    await deps.appendAudit(adminUser, "provider.delete", "provider", id, `删除 Provider ${provider.name}`, requestContext);
    deps.sendT8(response, null);
    return true;
  }

  return false;
}
