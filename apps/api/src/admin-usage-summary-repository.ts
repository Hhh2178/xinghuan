import type { Pool, QueryResultRow } from "pg";
import type { AdminUsageSummaryQuery } from "./admin-audit-routes.js";
import type { AdminUsageTaskRecord } from "./admin-usage-analytics.js";

export interface AdminUsageSummaryRecordSet {
  tasks: AdminUsageTaskRecord[];
  groupMemberCounts: Map<string, number>;
}

export interface AdminUsageSummaryRepositoryDeps {
  readAdminDb: () => Promise<{
    tasks: AdminUsageSummaryReadableTaskRecord[];
    providers: Array<{ id: string; name: string }>;
    models: Array<{ id: string; providerId: string; modelId: string; displayName: string }>;
  }>;
  readAuthDb: () => Promise<{
    users: Array<{ id: string; email: string; name: string; groupId?: string; remark?: string }>;
    userGroups: Array<{ id: string; name: string }>;
  }>;
  usePostgresRepository: () => boolean;
  getPostgresPool: () => Promise<Pool>;
  millisToDate: (value: number) => Date;
  dateToMillis: (value: unknown) => number;
  normalizeTaskStatus: (value: unknown) => string;
  safeText: (value: unknown, fallback?: string) => string;
  plainObject: (value: unknown) => Record<string, unknown>;
}

export interface AdminUsageSummaryReadableTaskRecord {
  id: string;
  status: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRemark?: string;
  ownerGroupId?: string;
  ownerGroupName?: string;
  providerId?: string;
  modelId?: string;
  payload?: unknown;
  result?: unknown;
  createdAt?: number;
  updatedAt?: number;
}

interface AdminUsageSummaryTaskPostgresRow extends QueryResultRow {
  id: string;
  status: unknown;
  owner_id: string | null;
  provider_id: string | null;
  provider_name: unknown;
  model_id: string | null;
  model_record_id: string | null;
  model_native_id: unknown;
  model_display_name: unknown;
  payload: unknown;
  result: unknown;
  created_at: unknown;
  owner_name: unknown;
  owner_email: unknown;
  owner_remark: unknown;
  owner_group_id: unknown;
  owner_group_name: unknown;
  owner_deleted: unknown;
}

interface AdminUsageSummaryGroupCountPostgresRow extends QueryResultRow {
  id: unknown;
  member_count: unknown;
}

export function createAdminUsageSummaryRepository(deps: AdminUsageSummaryRepositoryDeps) {
  return {
    readAdminUsageSummaryRecords,
  };

  async function readAdminUsageSummaryRecords(query: AdminUsageSummaryQuery): Promise<AdminUsageSummaryRecordSet> {
    if (deps.usePostgresRepository()) return readAdminUsageSummaryRecordsPostgres(query);
    return readAdminUsageSummaryRecordsFile();
  }

  async function readAdminUsageSummaryRecordsPostgres(query: AdminUsageSummaryQuery): Promise<AdminUsageSummaryRecordSet> {
    const pool = await deps.getPostgresPool();
    const [tasksResult, groupsResult] = await Promise.all([
      pool.query<AdminUsageSummaryTaskPostgresRow>(
        `select t.id,
                t.status,
                t.owner_id,
                t.provider_id,
                p.name as provider_name,
                t.model_id,
                m.id as model_record_id,
                m.model_id as model_native_id,
                m.display_name as model_display_name,
                jsonb_build_object(
                  'protocol', t.payload -> 'protocol',
                  'taskCapability', t.payload -> 'taskCapability',
                  'targetType', t.payload -> 'targetType',
                  'providerId', t.payload -> 'providerId',
                  'providerName', t.payload -> 'providerName',
                  'rhCatalogId', t.payload -> 'rhCatalogId',
                  'rhCatalogTitle', t.payload -> 'rhCatalogTitle',
                  'rhCatalogKind', t.payload -> 'rhCatalogKind',
                  'runTargetId', t.payload -> 'runTargetId',
                  'webappId', t.payload -> 'webappId',
                  'workflowId', t.payload -> 'workflowId',
                  'modelRecordId', t.payload -> 'modelRecordId',
                  'providerModel', t.payload -> 'providerModel',
                  'model', t.payload -> 'model',
                  'modelDisplayName', t.payload -> 'modelDisplayName'
                ) as payload,
                jsonb_build_object(
                  'protocol', t.result -> 'protocol',
                  'adapter', t.result -> 'adapter',
                  'capability', t.result -> 'capability',
                  'rhTargetType', t.result -> 'rhTargetType',
                  'providerId', t.result -> 'providerId',
                  'providerName', t.result -> 'providerName',
                  'rhCatalogId', t.result -> 'rhCatalogId',
                  'rhCatalogTitle', t.result -> 'rhCatalogTitle',
                  'rhCatalogKind', t.result -> 'rhCatalogKind',
                  'rhRunTargetId', t.result -> 'rhRunTargetId',
                  'webappId', t.result -> 'webappId',
                  'workflowId', t.result -> 'workflowId',
                  'modelId', t.result -> 'modelId',
                  'modelDisplayName', t.result -> 'modelDisplayName',
                  'raw', jsonb_build_object(
                    'capability', t.result #> '{raw,capability}',
                    'providerId', t.result #> '{raw,providerId}',
                    'modelRecordId', t.result #> '{raw,modelRecordId}',
                    'modelId', t.result #> '{raw,modelId}'
                  )
                ) as result,
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
        [deps.millisToDate(query.from), deps.millisToDate(query.to)],
      ),
      pool.query<AdminUsageSummaryGroupCountPostgresRow>(
        `select g.id, count(u.id)::int as member_count
         from xh_user_groups g
         left join xh_users u on u.group_id = g.id
         group by g.id`,
      ),
    ]);

    const groupMemberCounts = new Map<string, number>([["ungrouped", 0]]);
    for (const row of groupsResult.rows) {
      groupMemberCounts.set(deps.safeText(row.id), Number(row.member_count || 0));
    }
    const ungroupedCountResult = await pool.query<AdminUsageSummaryGroupCountPostgresRow>(`select count(*)::int as member_count from xh_users where group_id is null`);
    groupMemberCounts.set("ungrouped", Number(ungroupedCountResult.rows?.[0]?.member_count || 0));

    return {
      tasks: tasksResult.rows.map((row) => ({
        id: row.id,
        status: deps.normalizeTaskStatus(row.status),
        ownerId: row.owner_id || undefined,
        ownerName: deps.safeText(row.owner_name) || undefined,
        ownerEmail: deps.safeText(row.owner_email) || undefined,
        ownerRemark: deps.safeText(row.owner_remark) || undefined,
        ownerGroupId: deps.safeText(row.owner_group_id) || undefined,
        ownerGroupName: deps.safeText(row.owner_group_name) || undefined,
        ownerDeleted: Boolean(row.owner_deleted),
        providerId: row.provider_id || undefined,
        providerName: deps.safeText(row.provider_name) || undefined,
        modelId: deps.safeText(row.model_native_id || row.model_id) || undefined,
        modelRecordId: deps.safeText(row.model_record_id || row.model_id) || undefined,
        modelDisplayName: deps.safeText(row.model_display_name) || undefined,
        payload: deps.plainObject(row.payload),
        result: deps.plainObject(row.result),
        createdAt: deps.dateToMillis(row.created_at),
      })),
      groupMemberCounts,
    };
  }

  async function readAdminUsageSummaryRecordsFile(): Promise<AdminUsageSummaryRecordSet> {
    const [adminDb, authDb] = await Promise.all([deps.readAdminDb(), deps.readAuthDb()]);
    const usersById = new Map(authDb.users.map((user) => [user.id, user]));
    const groupsById = new Map(authDb.userGroups.map((group) => [group.id, group]));
    const providersById = new Map(adminDb.providers.map((provider) => [provider.id, provider]));
    const modelsById = new Map(adminDb.models.map((model) => [model.id, model]));
    const groupMemberCounts = new Map<string, number>([["ungrouped", 0]]);

    for (const group of authDb.userGroups) {
      groupMemberCounts.set(group.id, authDb.users.filter((user) => user.groupId === group.id).length);
    }
    groupMemberCounts.set("ungrouped", authDb.users.filter((user) => !user.groupId).length);

    return {
      tasks: adminDb.tasks
        .filter((task) => task.status === "succeeded")
        .map((task) => {
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
            ownerRemark: deps.safeText(owner?.remark || task.ownerRemark) || undefined,
            ownerGroupId: owner?.groupId || task.ownerGroupId,
            ownerGroupName: ownerGroup?.name || task.ownerGroupName,
            ownerDeleted: Boolean(task.ownerId && !owner),
            providerId: task.providerId,
            providerName: provider?.name,
            modelId: model?.modelId || task.modelId,
            modelRecordId: model?.id || task.modelId,
            modelDisplayName: model?.displayName,
            payload: deps.plainObject(task.payload),
            result: deps.plainObject(task.result),
            createdAt: task.createdAt || task.updatedAt || 0,
          };
        }),
      groupMemberCounts,
    };
  }
}
