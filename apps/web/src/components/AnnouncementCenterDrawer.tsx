import { Bell, Pin, X } from "lucide-react";
import type { AnnouncementRecord } from "@xinghuan/shared";

function formatAnnouncementTime(value?: number) {
  if (!value) return "刚刚";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function priorityText(record: AnnouncementRecord) {
  if (record.priority === "strong-reminder") return "强提醒";
  if (record.priority === "important") return "重要";
  return "普通";
}

export function AnnouncementCenterDrawer({
  open,
  items,
  unreadCount,
  loading,
  error,
  onClose,
  onMarkRead,
}: {
  open: boolean;
  items: AnnouncementRecord[];
  unreadCount: number;
  loading: boolean;
  error: string;
  onClose: () => void;
  onMarkRead: (id: string) => Promise<void> | void;
}) {
  if (!open) return null;

  return (
    <div className="xh-announcement-drawer-wrap" data-canvas-floating-ui="announcement-center">
      <button type="button" className="xh-announcement-backdrop" aria-label="关闭公告中心" onClick={onClose} />
      <aside className="xh-announcement-drawer">
        <header className="xh-announcement-drawer__header">
          <div>
            <strong>公告中心</strong>
            <span>{unreadCount > 0 ? `还有 ${unreadCount} 条未读` : "当前没有未读公告"}</span>
          </div>
          <button type="button" className="xh-announcement-icon-button" onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </header>

        {error ? <div className="xh-announcement-banner">{error}</div> : null}

        <div className="xh-announcement-drawer__body">
          {loading ? (
            <div className="xh-announcement-empty">
              <Bell size={20} />
              <span>公告同步中...</span>
            </div>
          ) : null}

          {!loading && !items.length ? (
            <div className="xh-announcement-empty">
              <Bell size={20} />
              <span>暂时没有公告，稍后再来看。</span>
            </div>
          ) : null}

          {!loading
            ? items.map((item) => (
                <article key={item.id} className={item.readAt ? "xh-announcement-card" : "xh-announcement-card unread"}>
                  <div className="xh-announcement-card__head">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.summary}</span>
                    </div>
                    <div className="xh-announcement-card__badges">
                      {item.pinned ? (
                        <span>
                          <Pin size={12} />
                          置顶
                        </span>
                      ) : null}
                      <span>{priorityText(item)}</span>
                    </div>
                  </div>
                  <p>{item.content}</p>
                  <div className="xh-announcement-card__footer">
                    <span>{formatAnnouncementTime(item.publishedAt || item.updatedAt || item.createdAt)}</span>
                    {item.versionTag ? <span>{item.versionTag}</span> : null}
                    {!item.readAt ? (
                      <button type="button" onClick={() => void onMarkRead(item.id)}>
                        标记已读
                      </button>
                    ) : (
                      <span>已读</span>
                    )}
                  </div>
                </article>
              ))
            : null}
        </div>
      </aside>
    </div>
  );
}
