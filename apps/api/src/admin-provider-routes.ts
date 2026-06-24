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

interface AdminTaskRecordShape {
  providerId?: string;
  modelId?: string;
}

interface AdminModelRecordShape {
  id: string;
  providerId: string;
}

interface AdminDbShape {
  providers: AdminProviderRecordShape[];
  models: AdminModelRecordShape[];
  tasks: AdminTaskRecordShape[];
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
  readAdminDb: () => Promise<AdminDbShape>;
  writeAdminDb: (db: AdminDbShape) => Promise<void>;
  usePostgresRepository: () => boolean;
  insertProviderRecordPostgres: (provider: AdminProviderRecordShape) => Promise<void>;
  upsertProviderRecordPostgres: (provider: AdminProviderRecordShape) => Promise<void>;
  deleteProviderRecordPostgres: (providerId: string) => Promise<void>;
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
    const db = await deps.readAdminDb();
    if (request.method === "GET") {
      await deps.appendAudit(adminUser, "providers.read", "provider", "providers-list", "查看 Provider 列表", requestContext);
      deps.sendT8(response, db.providers.map(deps.toPublicProvider));
      return true;
    }
    if (request.method === "POST") {
      const body = await readJsonBody<Partial<AdminProviderRecordShape>>(request);
      const now = Date.now();
      const apiKey = safeText(body.apiKey);
      const provider: AdminProviderRecordShape = {
        id: safeSlug(body.id, `provider-${now}`),
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
      if (db.providers.some((item) => item.id === provider.id)) throw new Error("Provider ID 已存在");
      if (deps.usePostgresRepository()) {
        await deps.insertProviderRecordPostgres(provider);
      } else {
        await deps.writeAdminDb({ ...db, providers: [provider, ...db.providers] });
      }
      await deps.appendAudit(adminUser, "provider.create", "provider", provider.id, `创建 Provider ${provider.name}`, requestContext);
      deps.sendT8(response, deps.toPublicProvider(provider));
      return true;
    }
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
    const db = await deps.readAdminDb();
    const provider = db.providers.find((item) => item.id === id);
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
    const db = await deps.readAdminDb();
    const provider = db.providers.find((item) => item.id === id);
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
    const db = await deps.readAdminDb();
    let updated: AdminProviderRecordShape | undefined;
    const providers = db.providers.map((provider) => {
      if (provider.id !== id) return provider;
      const next: AdminProviderRecordShape = {
        ...provider,
        name: body.name === undefined ? provider.name : safeText(body.name, provider.name),
        baseUrl: body.baseUrl === undefined ? provider.baseUrl : safeText(body.baseUrl),
        protocol: body.protocol === undefined ? provider.protocol : deps.normalizeProviderProtocol(body.protocol),
        enabled: body.enabled === undefined ? provider.enabled : Boolean(body.enabled),
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
      updated = next;
      return next;
    });
    if (!updated) throw new Error("Provider 不存在");
    if (deps.usePostgresRepository()) {
      await deps.upsertProviderRecordPostgres(updated);
    } else {
      await deps.writeAdminDb({ ...db, providers });
    }
    await deps.appendAudit(adminUser, "provider.update", "provider", id, `更新 Provider ${updated.name}`, requestContext);
    deps.sendT8(response, deps.toPublicProvider(updated));
    return true;
  }

  if (providerMatch && request.method === "DELETE") {
    const id = decodeURIComponent(providerMatch[1]);
    const db = await deps.readAdminDb();
    const provider = db.providers.find((item) => item.id === id);
    if (!provider) throw new Error("Provider 不存在");
    if (deps.usePostgresRepository()) {
      await deps.deleteProviderRecordPostgres(id);
    } else {
      const removedModelIds = new Set(db.models.filter((item) => item.providerId === id).map((item) => item.id));
      await deps.writeAdminDb({
        ...db,
        providers: db.providers.filter((item) => item.id !== id),
        models: db.models.filter((item) => item.providerId !== id),
        tasks: db.tasks.map((task) =>
          task.providerId === id || (task.modelId && removedModelIds.has(task.modelId))
            ? { ...task, providerId: "", modelId: removedModelIds.has(task.modelId || "") ? "" : task.modelId }
            : task,
        ),
      });
    }
    await deps.appendAudit(adminUser, "provider.delete", "provider", id, `删除 Provider ${provider.name}`, requestContext);
    deps.sendT8(response, null);
    return true;
  }

  return false;
}
