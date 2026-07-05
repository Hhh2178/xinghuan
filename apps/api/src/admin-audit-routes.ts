import { buildAdminUsageSummary, type AdminUsageSummary, type AdminUsageTaskRecord, type UsageCapability } from "./admin-usage-analytics.js";
import type { RhCatalogItem } from "@xinghuan/shared";

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
  readAdminUsageSummary?: never;
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

  async function readAdminUsageSummary(query: AdminUsageSummaryQuery): Promise<AdminUsageSummary> {
    const runningHubCatalog = await publicRunningHubCatalog();
    const runningHubByCatalogId = new Map(runningHubCatalog.items.map((item) => [item.catalogId, item]));
    const runningHubByTarget = new Map(runningHubCatalog.items.map((item) => [`${item.providerId}::${item.kind}::${item.runTargetId}`, item]));
    const resolver = {
      byCatalogId(catalogId: string) {
        return runningHubByCatalogId.get(catalogId) || null;
      },
      byTarget(providerId: string, kind: "app" | "workflow", runTargetId: string) {
        return runningHubByTarget.get(`${providerId}::${kind}::${runTargetId}`) || null;
      },
    };

    if (usePostgresRepository()) {
      const pool = await getPostgresPool();
      const [tasksResult, groupsResult] = await Promise.all([
        pool.query(
          `select t.id,
                  t.status,
                  t.owner_id,
                  t.provider_id,
                  p.name as provider_name,
                  t.model_id,
                  m.id as model_record_id,
                  m.model_id as model_native_id,
                  m.display_name as model_display_name,
                  t.payload,
                  t.result,
                  t.created_at,
                  u.name as owner_name,
                  u.email as owner_email,
                  u.remark as owner_remark,
                  u.group_id as owner_group_id,
                  g.name as owner_group_name,
                  case when t.owner_id is not null and u.id is null then true else false end as owner_deleted
           from xh_tasks t
           left join xh_users u on u.id = t.owner_id
           left join xh_user_groups g on g.id = u.group_id
           left join xh_models m on m.id = t.model_id
           left join xh_providers p on p.id = coalesce(m.provider_id, t.provider_id)
           where t.status = 'succeeded'
             and t.created_at >= $1
             and t.created_at <= $2
           order by t.created_at desc`,
          [millisToDate(query.from), millisToDate(query.to)],
        ),
        pool.query(
          `select g.id, count(u.id)::int as member_count
           from xh_user_groups g
           left join xh_users u on u.group_id = g.id
           group by g.id`,
        ),
      ]);

      const groupMemberCounts = new Map<string, number>([["ungrouped", 0]]);
      for (const row of groupsResult.rows) {
        groupMemberCounts.set(safeText(row.id), Number(row.member_count || 0));
      }
      const ungroupedCountResult = await pool.query(`select count(*)::int as member_count from xh_users where group_id is null`);
      groupMemberCounts.set("ungrouped", Number(ungroupedCountResult.rows?.[0]?.member_count || 0));

      const tasks: AdminUsageTaskRecord[] = tasksResult.rows.map((row: any) => ({
        id: row.id,
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
        modelId: safeText(row.model_native_id || row.model_id) || undefined,
        modelRecordId: safeText(row.model_record_id || row.model_id) || undefined,
        modelDisplayName: safeText(row.model_display_name) || undefined,
        payload: plainObject(row.payload),
        result: plainObject(row.result),
        createdAt: dateToMillis(row.created_at),
      }));

      return buildAdminUsageSummary({
        tasks,
        filters: query,
        groupMemberCounts,
        runningHubResolver: resolver,
      });
    }

    const [adminDb, authDb] = await Promise.all([readAdminDb(), readAuthDb()]);
    const usersById = new Map(authDb.users.map((user: any) => [user.id, user]));
    const groupsById = new Map(authDb.userGroups.map((group: any) => [group.id, group]));
    const providersById = new Map(adminDb.providers.map((provider: any) => [provider.id, provider]));
    const modelsById = new Map(adminDb.models.map((model: any) => [model.id, model]));
    const groupMemberCounts = new Map<string, number>([["ungrouped", 0]]);

    for (const group of authDb.userGroups) {
      groupMemberCounts.set(group.id, authDb.users.filter((user: any) => user.groupId === group.id).length);
    }
    groupMemberCounts.set("ungrouped", authDb.users.filter((user: any) => !user.groupId).length);

    const tasks: AdminUsageTaskRecord[] = adminDb.tasks
      .filter((task: any) => task.status === "succeeded")
      .map((task: any) => {
        const owner = task.ownerId ? usersById.get(task.ownerId) : undefined;
        const ownerGroup = owner?.groupId ? groupsById.get(owner.groupId) : undefined;
        const model = task.modelId ? modelsById.get(task.modelId) : undefined;
        const provider = providersById.get(model?.providerId || task.providerId || "");
        return {
          id: task.id,
          status: task.status,
          ownerId: task.ownerId,
          ownerName: owner?.name || task.ownerName,
          ownerEmail: owner?.email || task.ownerEmail,
          ownerRemark: safeText(owner?.remark || task.ownerRemark) || undefined,
          ownerGroupId: owner?.groupId || task.ownerGroupId,
          ownerGroupName: ownerGroup?.name || task.ownerGroupName,
          ownerDeleted: Boolean(task.ownerId && !owner),
          providerId: task.providerId,
          providerName: provider?.name,
          modelId: model?.modelId || task.modelId,
          modelRecordId: model?.id || task.modelId,
          modelDisplayName: model?.displayName,
          payload: plainObject(task.payload),
          result: plainObject(task.result),
          createdAt: task.createdAt || task.updatedAt,
        };
      });

    return buildAdminUsageSummary({
      tasks,
      filters: query,
      groupMemberCounts,
      runningHubResolver: resolver,
    });
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
      sendT8(response, auditLogs.slice(0, 200));
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
