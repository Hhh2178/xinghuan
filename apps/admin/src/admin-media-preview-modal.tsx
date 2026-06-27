import { Library, Music, Video, X } from "lucide-react";
import type { AdminSharedResourcePreviewKind } from "./admin-types";

type AdminMediaPreviewModalProps = {
  open: boolean;
  title: string;
  url?: string;
  mime?: string;
  kind: AdminSharedResourcePreviewKind;
  onClose: () => void;
};

function renderFallback(kind: AdminSharedResourcePreviewKind, title: string) {
  const Icon = kind === "video" ? Video : kind === "audio" ? Music : Library;
  const label =
    kind === "video" ? "当前资源为视频，请使用浏览器播放器查看完整画面。" :
    kind === "audio" ? "当前资源为音频，请使用播放器完整试听。" :
    "当前资源没有可内嵌预览的媒体内容。";

  return (
    <div className="admin-media-preview-modal__fallback">
      <Icon aria-hidden="true" />
      <strong>{title}</strong>
      <span>{label}</span>
    </div>
  );
}

export function AdminMediaPreviewModal({ open, title, url, mime, kind, onClose }: AdminMediaPreviewModalProps) {
  if (!open) return null;

  const canPreviewImage = kind === "image" && !!url;
  const canPreviewVideo = kind === "video" && !!url;
  const canPreviewAudio = kind === "audio" && !!url;

  return (
    <div
      className="admin-modal-backdrop admin-media-preview-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="admin-media-preview-modal admin-media-preview-modal--starlight"
        role="dialog"
        aria-modal="true"
        aria-label={`预览 ${title}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-media-preview-modal__header">
          <div>
            <strong>{title}</strong>
            <span>{mime || kind}</span>
          </div>
          <button type="button" aria-label="关闭预览" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="admin-media-preview-modal__stage">
          {canPreviewImage ? <img className="admin-media-preview-modal__media" src={url} alt={title} /> : null}
          {canPreviewVideo ? <video className="admin-media-preview-modal__media" src={url} controls playsInline preload="metadata" /> : null}
          {canPreviewAudio ? <audio src={url} controls preload="metadata" /> : null}
          {!canPreviewImage && !canPreviewVideo && !canPreviewAudio ? renderFallback(kind, title) : null}
        </div>
      </section>
    </div>
  );
}
