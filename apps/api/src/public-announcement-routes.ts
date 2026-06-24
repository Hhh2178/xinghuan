import type { IncomingMessage, ServerResponse } from "node:http";
import type { AnnouncementRecord } from "@xinghuan/shared";
import { attachAnnouncementStream } from "./announcement-sse.js";

interface CurrentUserShape {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
}

interface PublicAnnouncementRouteDeps {
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number) => void;
  announcementStore: {
    listForUser: (user: CurrentUserShape) => Promise<AnnouncementRecord[]>;
    unreadCount: (user: CurrentUserShape) => Promise<number>;
    markRead: (id: string, user: CurrentUserShape) => Promise<number>;
  };
}

export async function handlePublicAnnouncementRoutes(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  currentUser: CurrentUserShape;
  deps: PublicAnnouncementRouteDeps;
}) {
  const { request, response, url, currentUser, deps } = input;
  if (!url.pathname.startsWith("/api/announcements")) return false;

  if (url.pathname === "/api/announcements" && request.method === "GET") {
    deps.sendT8(response, await deps.announcementStore.listForUser(currentUser));
    return true;
  }

  if (url.pathname === "/api/announcements/unread-count" && request.method === "GET") {
    deps.sendT8(response, { unreadCount: await deps.announcementStore.unreadCount(currentUser) });
    return true;
  }

  if (url.pathname === "/api/announcements/stream" && request.method === "GET") {
    attachAnnouncementStream(response, `${currentUser.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);
    return true;
  }

  const readMatch = url.pathname.match(/^\/api\/announcements\/([^/]+)\/read$/);
  if (readMatch && request.method === "POST") {
    const id = decodeURIComponent(readMatch[1]);
    const readAt = await deps.announcementStore.markRead(id, currentUser);
    deps.sendT8(response, { announcementId: id, readAt });
    return true;
  }

  return false;
}
