import type { AnnouncementRecord, TaskQueueSettings, TaskStatus } from "@xinghuan/shared";

export interface AdminProviderSummaryRecord {
  enabled: boolean;
}

export interface AdminModelSummaryRecord {
  enabled: boolean;
}

export interface AdminTaskSummaryRecord {
  status: TaskStatus;
  updatedAt?: number;
}

export interface AdminAuditRecord {
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

export interface AdminDbShape {
  providers: AdminProviderSummaryRecord[];
  models: AdminModelSummaryRecord[];
  tasks: AdminTaskSummaryRecord[];
  announcements?: AnnouncementRecord[];
  auditLogs?: AdminAuditRecord[];
  taskQueueSettings?: TaskQueueSettings;
  taskQueueSettingsRevision?: number;
  taskQueueSettingsUpdatedAt?: number;
}

export interface AdminStorageStats {
  users: number;
  canvases: number;
  resources: number;
  inputFiles: number;
  outputFiles: number;
}

export interface AdminUserSummary {
  users: number;
  enabledUsers: number;
}

export interface AdminSummary {
  users: number;
  enabledUsers: number;
  providers: number;
  enabledProviders: number;
  models: number;
  enabledModels: number;
  tasks: number;
  runningTasks: number;
  auditLogs: number;
  storage: AdminStorageStats;
}

export interface AdminRepositoryDeps {
  usePostgresRepository: () => boolean;
  getPostgresPool: () => Promise<{
    query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
    connect: () => Promise<{
      query: (sql: string, params?: unknown[]) => Promise<unknown>;
      release: () => void;
    }>;
  }>;
  readAdminDb: () => Promise<AdminDbShape>;
  writeAdminDb: (db: AdminDbShape, options?: { allowPostgresFullReplace?: boolean; reason?: string }) => Promise<void>;
  dateToMillis: (value: unknown) => number;
  millisToDate: (value: number | undefined) => Date;
  safeText: (value: unknown, fallback?: string) => string;
}

export function createAdminRepository(deps: AdminRepositoryDeps) {
  return {
    readAdminSummary,
    readAnnouncementRecords,
    writeAnnouncementRecords,
    readAuditRecords,
    appendAuditRecord,
  };

  async function readAdminSummary(userSummary: AdminUserSummary, storage: AdminStorageStats): Promise<AdminSummary> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query(`
        with provider_summary as (
          select count(*)::int as providers,
                 count(*) filter (where enabled = true)::int as enabled_providers
          from xh_providers
        ),
        model_summary as (
          select count(*)::int as models,
                 count(*) filter (where enabled = true)::int as enabled_models
          from xh_models
        ),
        task_summary as (
          select count(*)::int as tasks,
                 count(*) filter (where status in ('queued', 'running'))::int as running_tasks
          from xh_tasks
        ),
        audit_summary as (
          select count(*)::int as audit_logs
          from xh_audit_logs
        )
        select *
        from provider_summary
        cross join model_summary
        cross join task_summary
        cross join audit_summary
      `);
      const row = result.rows[0] || {};
      return {
        users: userSummary.users,
        enabledUsers: userSummary.enabledUsers,
        providers: toCount(row.providers),
        enabledProviders: toCount(row.enabled_providers),
        models: toCount(row.models),
        enabledModels: toCount(row.enabled_models),
        tasks: toCount(row.tasks),
        runningTasks: toCount(row.running_tasks),
        auditLogs: toCount(row.audit_logs),
        storage,
      };
    }

    const db = await deps.readAdminDb();
    const providers = Array.isArray(db.providers) ? db.providers : [];
    const models = Array.isArray(db.models) ? db.models : [];
    const tasks = Array.isArray(db.tasks) ? db.tasks : [];
    return {
      users: userSummary.users,
      enabledUsers: userSummary.enabledUsers,
      providers: providers.length,
      enabledProviders: providers.filter((provider) => provider.enabled).length,
      models: models.length,
      enabledModels: models.filter((model) => model.enabled).length,
      tasks: tasks.length,
      runningTasks: tasks.filter((task) => task.status === "queued" || task.status === "running").length,
      auditLogs: Array.isArray(db.auditLogs) ? db.auditLogs.length : 0,
      storage,
    };
  }

  async function readAnnouncementRecords(): Promise<AnnouncementRecord[]> {
    if (deps.usePostgresRepository()) return readAnnouncementRecordsPostgres();
    const db = await deps.readAdminDb();
    return Array.isArray(db.announcements) ? db.announcements : [];
  }

  async function writeAnnouncementRecords(announcements: AnnouncementRecord[]) {
    if (deps.usePostgresRepository()) {
      await writeAnnouncementRecordsPostgres(announcements);
      return;
    }
    const db = await deps.readAdminDb();
    await deps.writeAdminDb(
      {
        ...db,
        announcements,
      },
      {
        allowPostgresFullReplace: true,
        reason: "announcement.write",
      },
    );
  }

  async function readAnnouncementRecordsPostgres(): Promise<AnnouncementRecord[]> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select id, title, summary, content, type, priority, status, scope, pinned, strong_reminder, popup_enabled, version_tag, published_at, expire_at, created_by, created_at, updated_at
       from xh_announcements
       order by pinned desc, coalesce(published_at, created_at) desc, created_at desc`,
    );
    return result.rows.map((row) => ({
      id: deps.safeText(row.id),
      title: deps.safeText(row.title),
      summary: deps.safeText(row.summary),
      content: deps.safeText(row.content),
      type: row.type === "release-note" || row.type === "system" ? row.type : "manual",
      priority: row.priority === "important" || row.priority === "strong-reminder" ? row.priority : "normal",
      status: row.status === "published" || row.status === "archived" ? row.status : "draft",
      scope: row.scope === "admins-only" ? "admins-only" : "all-users",
      pinned: Boolean(row.pinned),
      strongReminder: Boolean(row.strong_reminder),
      popupEnabled: row.popup_enabled !== false,
      versionTag: row.version_tag ? deps.safeText(row.version_tag) : undefined,
      publishedAt: row.published_at ? deps.dateToMillis(row.published_at) : undefined,
      expireAt: row.expire_at ? deps.dateToMillis(row.expire_at) : undefined,
      createdBy: deps.safeText(row.created_by),
      createdAt: row.created_at ? deps.dateToMillis(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? deps.dateToMillis(row.updated_at) : Date.now(),
    }));
  }

  async function writeAnnouncementRecordsPostgres(announcements: AnnouncementRecord[]) {
    const pool = await deps.getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from xh_announcements");
      for (const announcement of announcements) {
        await client.query(
          `insert into xh_announcements (id, title, summary, content, type, priority, status, scope, pinned, strong_reminder, popup_enabled, version_tag, published_at, expire_at, created_by, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            announcement.id,
            announcement.title,
            announcement.summary,
            announcement.content,
            announcement.type,
            announcement.priority,
            announcement.status,
            announcement.scope,
            Boolean(announcement.pinned),
            Boolean(announcement.strongReminder),
            announcement.popupEnabled !== false,
            announcement.versionTag || null,
            announcement.publishedAt ? deps.millisToDate(announcement.publishedAt) : null,
            announcement.expireAt ? deps.millisToDate(announcement.expireAt) : null,
            announcement.createdBy,
            deps.millisToDate(announcement.createdAt),
            deps.millisToDate(announcement.updatedAt),
          ],
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

  async function readAuditRecords(limit = 500): Promise<AdminAuditRecord[]> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query(
        `select id, actor_id, actor_email, action, target_type, target_id, summary, request_id, ip, user_agent, created_at
         from xh_audit_logs
         order by created_at desc
         limit $1`,
        [limit],
      );
      return result.rows.map((row) => ({
        id: deps.safeText(row.id),
        actorId: deps.safeText(row.actor_id),
        actorEmail: deps.safeText(row.actor_email),
        action: deps.safeText(row.action),
        targetType: deps.safeText(row.target_type),
        targetId: deps.safeText(row.target_id),
        summary: deps.safeText(row.summary),
        requestId: row.request_id ? deps.safeText(row.request_id) : undefined,
        ip: row.ip ? deps.safeText(row.ip) : undefined,
        userAgent: row.user_agent ? deps.safeText(row.user_agent) : undefined,
        createdAt: row.created_at ? deps.dateToMillis(row.created_at) : Date.now(),
      }));
    }
    const db = await deps.readAdminDb();
    return (Array.isArray(db.auditLogs) ? db.auditLogs : []).slice(0, limit);
  }

  async function appendAuditRecord(record: AdminAuditRecord) {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query(
        `insert into xh_audit_logs (id, actor_id, actor_email, action, target_type, target_id, summary, request_id, ip, user_agent, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          record.id,
          record.actorId || null,
          record.actorEmail,
          record.action,
          record.targetType,
          record.targetId,
          record.summary,
          record.requestId || null,
          record.ip || null,
          record.userAgent || null,
          deps.millisToDate(record.createdAt),
        ],
      );
      return;
    }
    const db = await deps.readAdminDb();
    await deps.writeAdminDb({
      ...db,
      auditLogs: [record, ...(db.auditLogs || [])].slice(0, 1000),
    });
  }
}

function toCount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}
