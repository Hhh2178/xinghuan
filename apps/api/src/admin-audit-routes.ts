import type { AdminUsageSummary } from "./admin-usage-analytics.js";
import type { UsageCapability } from "./admin-usage-analytics.js";
import type { RhCatalogItem } from "@xinghuan/shared";
import { projectAuditForAdministrator } from "./admin-user-visibility.js";

type SendT8 = (
  response: import("node:http").ServerResponse,
  data: unknown,
  statusCode?: number,
  headers?: Record<string, string>,
) => void;

type AppendAudit = (
  actor: any,
  action: string,
  targetType: string,
  targetId: string,
  summary: string,
  context?: any,
) => Promise<void>;

type HttpErrorLike = new (statusCode: number, message: string, payload?: Record<string, unknown>) => Error;

export interface AdminUsageSummaryQuery {
  from: number;
  to: number;
  groupId?: string;
  userId?: string;
  capability?: UsageCapability;
  providerId?: string;
  modelId?: string;
  rhCatalogId?: string;
}

export function parseAdminUsageSummaryQuery(url: URL): AdminUsageSummaryQuery {
  const safeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const range = safeText(url.searchParams.get("range")).toLowerCase();
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  let from = now - 30 * oneDay;
  if (range === "today") from = now - oneDay;
  if (range === "7d") from = now - 7 * oneDay;
  if (range === "30d") from = now - 30 * oneDay;
  const explicitFrom = Number(url.searchParams.get("from"));
  const explicitTo = Number(url.searchParams.get("to"));
  const capabilityText = safeText(url.searchParams.get("capability")).toLowerCase();
  const capability =
    capabilityText === "image"
    || capabilityText === "video"
    || capabilityText === "runninghub_app"
    || capabilityText === "runninghub_workflow"
    || capabilityText === "llm"
    || capabilityText === "audio"
    || capabilityText === "unknown"
      ? capabilityText as UsageCapability
      : undefined;
  return {
    from: Number.isFinite(explicitFrom) && explicitFrom > 0 ? explicitFrom : from,
    to: Number.isFinite(explicitTo) && explicitTo > 0 ? explicitTo : now,
    groupId: safeText(url.searchParams.get("groupId")) || undefined,
    userId: safeText(url.searchParams.get("userId")) || undefined,
    capability,
    providerId: safeText(url.searchParams.get("providerId")) || undefined,
    modelId: safeText(url.searchParams.get("modelId")) || undefined,
    rhCatalogId: safeText(url.searchParams.get("rhCatalogId")) || undefined,
  };
}

export function createAdminAuditRouteHandler(deps: {
  sendT8: SendT8;
  HttpError: HttpErrorLike;
  readAdminDb: () => Promise<{
    auditLogs?: any[];
    tasks: any[];
    providers: any[];
    models: any[];
  }>;
  readAuditRecords?: (limit?: number) => Promise<any[]>;
  readAuthDb: () => Promise<{
    users: any[];
    userGroups: any[];
  }>;
  readAdminUsageSummary: (query: AdminUsageSummaryQuery) => Promise<AdminUsageSummary>;
  publicRunningHubCatalog: () => Promise<{ items: RhCatalogItem[] }>;
  usePostgresRepository: () => boolean;
  getPostgresPool: () => Promise<any>;
  millisToDate: (value: number) => Date;
  dateToMillis: (value: unknown) => number;
  normalizeTaskStatus: (value: unknown) => string;
  safeText: (value: unknown, fallback?: string) => string;
  plainObject: (value: unknown) => Record<string, unknown>;
  appendAudit: AppendAudit;
}) {
  const {
    sendT8,
    HttpError,
    readAdminDb,
    readAuditRecords,
    readAuthDb,
    readAdminUsageSummary,
    publicRunningHubCatalog,
    usePostgresRepository,
    getPostgresPool,
    millisToDate,
    dateToMillis,
    normalizeTaskStatus,
    safeText,
    plainObject,
    appendAudit,
  } = deps;

  function requireAdmin(currentUser: any) {
    if (!currentUser || currentUser.role !== "admin") {
      throw new HttpError(403, "ADMIN_REQUIRED");
    }
    return currentUser;
  }

  return async function handleAdminAuditRoutes({
    request,
    response,
    url,
    currentUser,
    requestContext,
  }: {
    request: import("node:http").IncomingMessage;
    response: import("node:http").ServerResponse;
    url: URL;
    currentUser: any;
    requestContext?: any;
  }) {
    const actor = requireAdmin(currentUser);

    if (url.pathname === "/api/admin/audit" && request.method === "GET") {
      const auditLogs = readAuditRecords ? await readAuditRecords(200) : (await readAdminDb()).auditLogs || [];
      const authDb = await readAuthDb();
      const rootUserIds = authDb.users
        .filter((user) => user.role === "admin" && user.administratorTier !== "operator")
        .map((user) => user.id);
      sendT8(response, auditLogs
        .map((audit) => projectAuditForAdministrator(actor, audit, rootUserIds))
        .filter(Boolean)
        .slice(0, 200));
      return true;
    }

    if (url.pathname === "/api/admin/audit/usage-summary" && request.method === "GET") {
      await appendAudit(actor, "audit.usage_summary.read", "audit", "usage-summary", "查看成功用量统计驾驶舱", requestContext);
      sendT8(response, await readAdminUsageSummary(parseAdminUsageSummaryQuery(url)));
      return true;
    }

    return false;
  };
}
