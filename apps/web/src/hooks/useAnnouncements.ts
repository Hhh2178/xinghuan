import { useEffect, useMemo, useState } from "react";
import type { AnnouncementRecord } from "@xinghuan/shared";
import {
  getAnnouncementUnreadCount,
  listAnnouncements,
  markAnnouncementRead,
  subscribeAnnouncementStream,
} from "../services/announcements";

function sortAnnouncements(items: AnnouncementRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.publishedAt || left.updatedAt || left.createdAt || 0;
    const rightTime = right.publishedAt || right.updatedAt || right.createdAt || 0;
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return rightTime - leftTime;
  });
}

function mergeAnnouncementItems(items: AnnouncementRecord[], next: AnnouncementRecord) {
  const existing = items.find((item) => item.id === next.id);
  if (!existing) return sortAnnouncements([next, ...items]);
  return sortAnnouncements(items.map((item) => (item.id === next.id ? { ...item, ...next, readAt: item.readAt ?? next.readAt } : item)));
}

export function useAnnouncements(enabled: boolean) {
  const [items, setItems] = useState<AnnouncementRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [strongReminderQueue, setStrongReminderQueue] = useState<AnnouncementRecord[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    Promise.all([listAnnouncements(), getAnnouncementUnreadCount()])
      .then(([announcementItems, unread]) => {
        if (!alive) return;
        setItems(sortAnnouncements(announcementItems));
        setUnreadCount(unread);
        setError("");
      })
      .catch((nextError) => {
        if (!alive) return;
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    return subscribeAnnouncementStream({
      onPublished: (record) => {
        setItems((current) => mergeAnnouncementItems(current, record));
        setUnreadCount((current) => current + (record.readAt ? 0 : 1));
        if (record.status === "published" && record.strongReminder && record.popupEnabled) {
          setStrongReminderQueue((current) =>
            current.some((item) => item.id === record.id) ? current : [...current, record],
          );
        }
      },
      onUpdated: (record) => {
        setItems((current) => mergeAnnouncementItems(current, record));
      },
    });
  }, [enabled]);

  const strongReminder = useMemo(
    () => strongReminderQueue[0] || null,
    [strongReminderQueue],
  );

  async function markRead(id: string) {
    const result = await markAnnouncementRead(id);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, readAt: result.readAt } : item)),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
    return result;
  }

  async function dismissStrongReminder(id: string) {
    await markRead(id);
    setStrongReminderQueue((current) => current.filter((item) => item.id !== id));
  }

  return {
    items,
    unreadCount,
    drawerOpen,
    strongReminder,
    loading,
    error,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
    markRead,
    dismissStrongReminder,
    setDrawerOpen,
  };
}
