import { AlertTriangle, BellRing, X } from "lucide-react";
import type { AnnouncementRecord } from "@xinghuan/shared";

export function AnnouncementStrongReminderModal({
  announcement,
  onAcknowledge,
  onViewDetail,
  onClose,
}: {
  announcement: AnnouncementRecord | null;
  onAcknowledge: (id: string) => Promise<void> | void;
  onViewDetail: (id: string) => Promise<void> | void;
  onClose: (id: string) => Promise<void> | void;
}) {
  if (!announcement) return null;

  return (
    <div className="xh-announcement-modal-wrap" data-canvas-floating-ui="announcement-strong-reminder">
      <div className="xh-announcement-modal-backdrop" />
      <section className="xh-announcement-modal" role="dialog" aria-modal="true" aria-labelledby="xh-announcement-modal-title">
        <header className="xh-announcement-modal__header">
          <div className="xh-announcement-modal__eyebrow">
            <BellRing size={14} />
            <span>实时公告提醒</span>
          </div>
          <button type="button" className="xh-announcement-icon-button" onClick={() => void onClose(announcement.id)} title="关闭即已读">
            <X size={16} />
          </button>
        </header>

        <div className="xh-announcement-modal__body">
          <div className="xh-announcement-modal__icon">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h2 id="xh-announcement-modal-title">{announcement.title}</h2>
            <p className="xh-announcement-modal__summary">{announcement.summary}</p>
          </div>
          <article className="xh-announcement-modal__content">{announcement.content}</article>
        </div>

        <footer className="xh-announcement-modal__actions">
          <button type="button" className="ghost" onClick={() => void onAcknowledge(announcement.id)}>
            我知道了
          </button>
          <button type="button" onClick={() => void onViewDetail(announcement.id)}>
            查看详情
          </button>
        </footer>
      </section>
    </div>
  );
}
