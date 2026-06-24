import type { IncomingMessage, ServerResponse } from "node:http";
import type { AnnouncementRecord } from "@xinghuan/shared";
import { readJsonBody } from "./http-session-utils.js";
import type { AnnouncementUpsertPayload } from "./announcement-store.js";

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

interface AdminAnnouncementRouteDeps {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number) => void;
  appendAudit: (
    actor: CurrentUserShape,
    action: string,
    targetType: string,
    targetId: string,
    summary: string,
    requestContext: RequestContextShape,
  ) => Promise<void>;
  announcementStore: {
    listAdmin: (input: { status?: string; type?: string; q?: string }) => Promise<AnnouncementRecord[]>;
    create: (input: AnnouncementUpsertPayload, user: CurrentUserShape) => Promise<AnnouncementRecord>;
    update: (id: string, input: AnnouncementUpsertPayload, user: CurrentUserShape) => Promise<AnnouncementRecord>;
    publish: (id: string, user: CurrentUserShape) => Promise<AnnouncementRecord>;
    archive: (id: string, user: CurrentUserShape) => Promise<AnnouncementRecord>;
    remove: (id: string) => Promise<void>;
  };
  broadcastAnnouncement: (event: "announcement.published" | "announcement.updated", payload: AnnouncementRecord) => void;
}

interface AnnouncementPublishConfirmPayload {
  confirmTitle?: string;
  confirmStrongReminder?: boolean;
  confirmPinned?: boolean;
}

export async function handleAdminAnnouncementRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  adminUser: CurrentUserShape;
  requestContext: RequestContextShape;
  deps: AdminAnnouncementRouteDeps;
}) {
  const { request, response, url, adminUser, requestContext, deps } = input;
  if (!url.pathname.startsWith("/api/admin/announcements")) return false;

  if (url.pathname === "/api/admin/announcements" && request.method === "GET") {
    const items = await deps.announcementStore.listAdmin({
      status: url.searchParams.get("status") || "",
      type: url.searchParams.get("type") || "",
      q: url.searchParams.get("q") || "",
    });
    await deps.appendAudit(adminUser, "announcement.read", "announcement", "announcements", "查看公告列表", requestContext);
    deps.sendT8(response, items);
    return true;
  }

  if (url.pathname === "/api/admin/announcements" && request.method === "POST") {
    const body = await readJsonBody<AnnouncementUpsertPayload>(request);
    const created = await deps.announcementStore.create(body, adminUser);
    await deps.appendAudit(adminUser, "announcement.create", "announcement", created.id, `创建公告 ${created.title}`, requestContext);
    deps.sendT8(response, created, 201);
    return true;
  }

  const itemMatch = url.pathname.match(/^\/api\/admin\/announcements\/([^/]+)$/);
  if (itemMatch && request.method === "PATCH") {
    const id = decodeURIComponent(itemMatch[1]);
    const body = await readJsonBody<AnnouncementUpsertPayload>(request);
    const updated = await deps.announcementStore.update(id, body, adminUser);
    deps.broadcastAnnouncement("announcement.updated", updated);
    await deps.appendAudit(adminUser, "announcement.update", "announcement", updated.id, `更新公告 ${updated.title}`, requestContext);
    deps.sendT8(response, updated);
    return true;
  }

  if (itemMatch && request.method === "DELETE") {
    const id = decodeURIComponent(itemMatch[1]);
    await deps.announcementStore.remove(id);
    await deps.appendAudit(adminUser, "announcement.delete", "announcement", id, `删除公告 ${id}`, requestContext);
    deps.sendT8(response, { deleted: true, id });
    return true;
  }

  const publishMatch = url.pathname.match(/^\/api\/admin\/announcements\/([^/]+)\/publish$/);
  if (publishMatch && request.method === "POST") {
    const id = decodeURIComponent(publishMatch[1]);
    const body = await readJsonBody<AnnouncementPublishConfirmPayload>(request);
    const items = await deps.announcementStore.listAdmin({});
    const existing = items.find((item) => item.id === id);
    if (!existing) throw new Error("公告不存在");
    if (String(body.confirmTitle || "").trim() !== existing.title.trim()) {
      throw new Error("公告标题确认不一致");
    }
    if (Boolean(body.confirmStrongReminder) !== Boolean(existing.strongReminder)) {
      throw new Error("强提醒确认不一致");
    }
    if (Boolean(body.confirmPinned) !== Boolean(existing.pinned)) {
      throw new Error("置顶确认不一致");
    }
    const updated = await deps.announcementStore.publish(id, adminUser);
    deps.broadcastAnnouncement("announcement.published", updated);
    await deps.appendAudit(adminUser, "announcement.publish", "announcement", updated.id, `发布公告 ${updated.title}`, requestContext);
    deps.sendT8(response, updated);
    return true;
  }

  const archiveMatch = url.pathname.match(/^\/api\/admin\/announcements\/([^/]+)\/archive$/);
  if (archiveMatch && request.method === "POST") {
    const id = decodeURIComponent(archiveMatch[1]);
    const updated = await deps.announcementStore.archive(id, adminUser);
    deps.broadcastAnnouncement("announcement.updated", updated);
    await deps.appendAudit(adminUser, "announcement.archive", "announcement", updated.id, `归档公告 ${updated.title}`, requestContext);
    deps.sendT8(response, updated);
    return true;
  }

  return false;
}
