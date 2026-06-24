import type { AnnouncementRecord } from "@xinghuan/shared";

interface AnnouncementEnvelope<T> {
  success?: boolean;
  data: T;
  error?: string;
}

async function requestAnnouncement<T>(pathname: string, init?: RequestInit): Promise<T> {
  const response = await fetch(pathname, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as AnnouncementEnvelope<T>) : ({ data: undefined } as AnnouncementEnvelope<T>);
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `${pathname} ${response.status}`);
  }
  return payload.data;
}

export async function listAnnouncements() {
  return requestAnnouncement<AnnouncementRecord[]>("/api/announcements");
}

export async function getAnnouncementUnreadCount() {
  const result = await requestAnnouncement<{ unreadCount: number }>("/api/announcements/unread-count");
  return result.unreadCount;
}

export async function markAnnouncementRead(id: string) {
  return requestAnnouncement<{ announcementId: string; readAt: number }>(
    `/api/announcements/${encodeURIComponent(id)}/read`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function subscribeAnnouncementStream(handlers: {
  onPublished: (record: AnnouncementRecord) => void;
  onUpdated: (record: AnnouncementRecord) => void;
}) {
  const source = new EventSource("/api/announcements/stream", { withCredentials: true });
  source.addEventListener("announcement.published", (event) => {
    const payload = JSON.parse((event as MessageEvent<string>).data) as AnnouncementRecord;
    handlers.onPublished(payload);
  });
  source.addEventListener("announcement.updated", (event) => {
    const payload = JSON.parse((event as MessageEvent<string>).data) as AnnouncementRecord;
    handlers.onUpdated(payload);
  });
  return () => source.close();
}
