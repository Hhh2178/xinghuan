import type { AnnouncementRecord, AnnouncementScope, AnnouncementStatus, AnnouncementType } from "@xinghuan/shared";

interface CurrentUserShape {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
}

interface AnnouncementStorageShape {
  announcements?: AnnouncementRecord[];
}

export interface AnnouncementUpsertPayload {
  title: string;
  summary: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementRecord["priority"];
  status?: AnnouncementStatus;
  scope: AnnouncementScope;
  pinned: boolean;
  strongReminder: boolean;
  popupEnabled: boolean;
  versionTag?: string;
  publishedAt?: number;
  expireAt?: number;
}

interface AnnouncementStoreDeps {
  usePostgresRepository: () => boolean;
  getPostgresPool: () => Promise<{
    query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }>;
  }>;
  readAnnouncements: () => Promise<AnnouncementRecord[]>;
  writeAnnouncements: (announcements: AnnouncementRecord[]) => Promise<void>;
  safeText: (value: unknown, fallback?: string) => string;
  millisToDate: (value: number | undefined) => Date | null;
  dateToMillis: (value: unknown) => number;
}

interface ListAdminInput {
  status?: string;
  type?: string;
  q?: string;
}

function normalizeStatus(value: unknown): AnnouncementStatus | undefined {
  return value === "draft" || value === "published" || value === "archived" ? value : undefined;
}

function normalizeType(value: unknown): AnnouncementType | undefined {
  return value === "manual" || value === "release-note" || value === "system" ? value : undefined;
}

function normalizeScope(value: unknown): AnnouncementScope {
  return value === "admins-only" ? "admins-only" : "all-users";
}

function nowId() {
  return `announcement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAnnouncementRecord(input: Partial<AnnouncementRecord>, now = Date.now()): AnnouncementRecord {
  return {
    id: String(input.id || nowId()),
    title: String(input.title || "").trim(),
    summary: String(input.summary || "").trim(),
    content: String(input.content || "").trim(),
    type: normalizeType(input.type) || "manual",
    priority: input.priority === "important" || input.priority === "strong-reminder" ? input.priority : "normal",
    status: normalizeStatus(input.status) || "draft",
    scope: normalizeScope(input.scope),
    pinned: Boolean(input.pinned),
    strongReminder: Boolean(input.strongReminder),
    popupEnabled: input.popupEnabled !== false,
    versionTag: String(input.versionTag || "").trim(),
    publishedAt: Number.isFinite(Number(input.publishedAt)) ? Number(input.publishedAt) : undefined,
    expireAt: Number.isFinite(Number(input.expireAt)) ? Number(input.expireAt) : undefined,
    createdBy: String(input.createdBy || "").trim(),
    createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : now,
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : now,
    readAt: Number.isFinite(Number(input.readAt)) ? Number(input.readAt) : undefined,
  };
}

function matchesAdminFilter(record: AnnouncementRecord, input: ListAdminInput) {
  if (input.status && record.status !== input.status) return false;
  if (input.type && record.type !== input.type) return false;
  const q = String(input.q || "").trim().toLowerCase();
  if (!q) return true;
  return `${record.title}\n${record.summary}\n${record.content}`.toLowerCase().includes(q);
}

function isVisibleForUser(record: AnnouncementRecord, user: CurrentUserShape, now = Date.now()) {
  if (record.status !== "published") return false;
  if (record.expireAt && record.expireAt <= now) return false;
  if (record.scope === "admins-only" && user.role !== "admin") return false;
  return true;
}

export function createAnnouncementStore(deps: AnnouncementStoreDeps) {
  async function listAdmin(input: ListAdminInput): Promise<AnnouncementRecord[]> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const where: string[] = [];
      const params: unknown[] = [];
      if (normalizeStatus(input.status)) {
        params.push(input.status);
        where.push(`status = $${params.length}`);
      }
      if (normalizeType(input.type)) {
        params.push(input.type);
        where.push(`type = $${params.length}`);
      }
      if (deps.safeText(input.q)) {
        params.push(`%${deps.safeText(input.q).toLowerCase()}%`);
        where.push(`lower(title || ' ' || summary || ' ' || content) like $${params.length}`);
      }
      const sql = `select id, title, summary, content, type, priority, status, scope, pinned, strong_reminder, popup_enabled, version_tag, published_at, expire_at, created_by, created_at, updated_at
        from xh_announcements
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by pinned desc, coalesce(published_at, created_at) desc, created_at desc`;
      const result = await pool.query(sql, params);
      return result.rows.map((row) =>
        normalizeAnnouncementRecord({
          id: row.id,
          title: row.title,
          summary: row.summary,
          content: row.content,
          type: row.type,
          priority: row.priority,
          status: row.status,
          scope: row.scope,
          pinned: row.pinned,
          strongReminder: row.strong_reminder,
          popupEnabled: row.popup_enabled,
          versionTag: row.version_tag,
          publishedAt: row.published_at ? deps.dateToMillis(row.published_at) : undefined,
          expireAt: row.expire_at ? deps.dateToMillis(row.expire_at) : undefined,
          createdBy: row.created_by,
          createdAt: deps.dateToMillis(row.created_at),
          updatedAt: deps.dateToMillis(row.updated_at),
        }),
      );
    }

    const list = await deps.readAnnouncements();
    return list.map((item) => normalizeAnnouncementRecord(item)).filter((item) => matchesAdminFilter(item, input));
  }

  async function create(input: AnnouncementUpsertPayload, user: CurrentUserShape): Promise<AnnouncementRecord> {
    const now = Date.now();
    const record = normalizeAnnouncementRecord({
      ...input,
      id: nowId(),
      createdBy: user.email,
      createdAt: now,
      updatedAt: now,
    }, now);

    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query(
        `insert into xh_announcements
         (id, title, summary, content, type, priority, status, scope, pinned, strong_reminder, popup_enabled, version_tag, published_at, expire_at, created_by, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          record.id,
          record.title,
          record.summary,
          record.content,
          record.type,
          record.priority,
          record.status,
          record.scope,
          record.pinned,
          record.strongReminder,
          record.popupEnabled,
          record.versionTag || null,
          deps.millisToDate(record.publishedAt),
          deps.millisToDate(record.expireAt),
          record.createdBy,
          deps.millisToDate(record.createdAt),
          deps.millisToDate(record.updatedAt),
        ],
      );
      return record;
    }

    const announcements = await deps.readAnnouncements();
    await deps.writeAnnouncements([record, ...announcements]);
    return record;
  }

  async function update(id: string, input: AnnouncementUpsertPayload, user: CurrentUserShape): Promise<AnnouncementRecord> {
    const existing = await getById(id);
    if (!existing) throw new Error("公告不存在");
    const updated = normalizeAnnouncementRecord({
      ...existing,
      ...input,
      id: existing.id,
      createdBy: existing.createdBy || user.email,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    });

    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query(
        `update xh_announcements
         set title = $2, summary = $3, content = $4, type = $5, priority = $6, status = $7, scope = $8, pinned = $9,
             strong_reminder = $10, popup_enabled = $11, version_tag = $12, published_at = $13, expire_at = $14, updated_at = $15
         where id = $1`,
        [
          updated.id,
          updated.title,
          updated.summary,
          updated.content,
          updated.type,
          updated.priority,
          updated.status,
          updated.scope,
          updated.pinned,
          updated.strongReminder,
          updated.popupEnabled,
          updated.versionTag || null,
          deps.millisToDate(updated.publishedAt),
          deps.millisToDate(updated.expireAt),
          deps.millisToDate(updated.updatedAt),
        ],
      );
      return updated;
    }

    const announcements = (await deps.readAnnouncements()).map((item) => item.id === id ? updated : item);
    await deps.writeAnnouncements(announcements);
    return updated;
  }

  async function publish(id: string, user: CurrentUserShape): Promise<AnnouncementRecord> {
    const existing = await getById(id);
    if (!existing) throw new Error("公告不存在");
    return update(id, {
      title: existing.title,
      summary: existing.summary,
      content: existing.content,
      type: existing.type,
      priority: existing.priority,
      status: "published",
      scope: existing.scope,
      pinned: existing.pinned,
      strongReminder: existing.strongReminder,
      popupEnabled: existing.popupEnabled,
      versionTag: existing.versionTag,
      publishedAt: Date.now(),
      expireAt: existing.expireAt,
    }, user);
  }

  async function archive(id: string, user: CurrentUserShape): Promise<AnnouncementRecord> {
    const existing = await getById(id);
    if (!existing) throw new Error("公告不存在");
    return update(id, {
      title: existing.title,
      summary: existing.summary,
      content: existing.content,
      type: existing.type,
      priority: existing.priority,
      status: "archived",
      scope: existing.scope,
      pinned: existing.pinned,
      strongReminder: existing.strongReminder,
      popupEnabled: existing.popupEnabled,
      versionTag: existing.versionTag,
      publishedAt: existing.publishedAt,
      expireAt: existing.expireAt,
    }, user);
  }

  async function remove(id: string): Promise<void> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query("delete from xh_announcements where id = $1", [id]);
      return;
    }
    const announcements = (await deps.readAnnouncements()).filter((item) => item.id !== id);
    await deps.writeAnnouncements(announcements);
  }

  async function listForUser(user: CurrentUserShape): Promise<AnnouncementRecord[]> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query(
        `select a.id, a.title, a.summary, a.content, a.type, a.priority, a.status, a.scope, a.pinned, a.strong_reminder, a.popup_enabled, a.version_tag,
                a.published_at, a.expire_at, a.created_by, a.created_at, a.updated_at, r.read_at
         from xh_announcements a
         left join xh_announcement_reads r on r.announcement_id = a.id and r.user_id = $1
         where a.status = 'published'
         order by a.pinned desc, coalesce(a.published_at, a.created_at) desc, a.created_at desc`,
        [user.id],
      );
      return result.rows
        .map((row) =>
          normalizeAnnouncementRecord({
            id: row.id,
            title: row.title,
            summary: row.summary,
            content: row.content,
            type: row.type,
            priority: row.priority,
            status: row.status,
            scope: row.scope,
            pinned: row.pinned,
            strongReminder: row.strong_reminder,
            popupEnabled: row.popup_enabled,
            versionTag: row.version_tag,
            publishedAt: row.published_at ? deps.dateToMillis(row.published_at) : undefined,
            expireAt: row.expire_at ? deps.dateToMillis(row.expire_at) : undefined,
            createdBy: row.created_by,
            createdAt: deps.dateToMillis(row.created_at),
            updatedAt: deps.dateToMillis(row.updated_at),
            readAt: row.read_at ? deps.dateToMillis(row.read_at) : undefined,
          }),
        )
        .filter((item) => isVisibleForUser(item, user));
    }

    return (await deps.readAnnouncements())
      .map((item) => normalizeAnnouncementRecord(item))
      .filter((item) => isVisibleForUser(item, user));
  }

  async function unreadCount(user: CurrentUserShape): Promise<number> {
    const items = await listForUser(user);
    return items.filter((item) => !item.readAt).length;
  }

  async function markRead(id: string, user: CurrentUserShape): Promise<number> {
    const now = Date.now();
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query(
        `insert into xh_announcement_reads (announcement_id, user_id, read_at)
         values ($1, $2, $3)
         on conflict (announcement_id, user_id) do update set read_at = excluded.read_at`,
        [id, user.id, deps.millisToDate(now)],
      );
      return now;
    }

    const announcements = (await deps.readAnnouncements()).map((item) =>
      item.id === id ? { ...item, readAt: now } : item,
    );
    await deps.writeAnnouncements(announcements);
    return now;
  }

  async function getById(id: string): Promise<AnnouncementRecord | null> {
    const adminItems = await listAdmin({});
    return adminItems.find((item) => item.id === id) || null;
  }

  return {
    listAdmin,
    create,
    update,
    publish,
    archive,
    remove,
    listForUser,
    unreadCount,
    markRead,
  };
}
