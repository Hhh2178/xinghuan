import { Clock3, Download, ExternalLink, Library, Music, Plus, Trash2, Video } from "lucide-react";
import type { GenerationLibraryItem } from "./admin-types";

type AdminGenerationLibraryCardProps = {
  item: GenerationLibraryItem;
  onOpenPreview: () => void;
  onDelete: () => void;
  onSendToShared: () => void;
};

function formatSize(size?: number) {
  if (!Number.isFinite(size || 0) || !size) return "-";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatRemaining(expiresAt: number) {
  const ms = Math.max(0, expiresAt - Date.now());
  const hours = Math.ceil(ms / 3_600_000);
  if (hours <= 1) return "不足 1 小时";
  if (hours < 24) return `${hours} 小时`;
  return `${Math.ceil(hours / 24)} 天`;
}

function previewUrl(item: GenerationLibraryItem) {
  return item.previewUrl || item.fileUrl || item.url || "";
}

function originalUrl(item: GenerationLibraryItem) {
  return item.fileUrl || item.url || item.previewUrl || "";
}

function getPreviewText(item: GenerationLibraryItem) {
  if (item.kind === "video") return "查看完整视频";
  if (item.kind === "audio") return "试听完整音频";
  return "查看完整素材";
}

function renderPreview(item: GenerationLibraryItem) {
  const url = previewUrl(item);
  if (item.kind === "image" && url) {
    return <img src={url} alt={item.title} />;
  }
  if (item.kind === "video" && url) {
    return <video src={url} muted playsInline preload="metadata" aria-label={item.title} />;
  }
  if (item.kind === "audio") {
    return (
      <div className="admin-public-resource-card__audio-preview">
        <div className="admin-public-resource-card__preview-state">
          <Music aria-hidden="true" />
          <span>{item.mime || "audio"}</span>
        </div>
        {url ? <audio src={url} controls preload="metadata" /> : null}
      </div>
    );
  }
  return (
    <div className="admin-public-resource-card__preview-state">
      {item.kind === "video" ? <Video aria-hidden="true" /> : <Library aria-hidden="true" />}
      <span>{item.mime || item.kind}</span>
    </div>
  );
}

export function AdminGenerationLibraryCard({
  item,
  onOpenPreview,
  onDelete,
  onSendToShared,
}: AdminGenerationLibraryCardProps) {
  const fileHref = originalUrl(item);
  const downloadHref = item.downloadUrl || fileHref;
  const canPreview = item.kind === "image" || item.kind === "video" || item.kind === "audio";

  return (
    <article className="admin-public-resource-card admin-generation-library-card">
      <div className="admin-public-resource-card__preview-shell">
        <div className="admin-public-resource-card__preview-stage">
          <div className="admin-public-resource-card__preview-frame">{renderPreview(item)}</div>
        </div>
        <div className="admin-public-resource-card__preview-actions">
          <div className="admin-public-resource-card__action-row">
            {canPreview ? (
              <button type="button" onClick={onOpenPreview}>
                <ExternalLink aria-hidden="true" />
                {getPreviewText(item)}
              </button>
            ) : null}
            {downloadHref ? (
              <a href={downloadHref} target="_blank" rel="noreferrer" className="admin-public-resource-card__preview-link">
                <Download aria-hidden="true" />
                下载原件
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="admin-public-resource-card__management">
        <div className="admin-generation-library-card__title-block">
          <strong>{item.title || "未命名生成素材"}</strong>
          <span>{item.filename || item.mime || item.kind}</span>
        </div>

        <div className="admin-public-resource-card__meta admin-generation-library-card__meta">
          <span>{item.kind === "image" ? "图像" : item.kind === "video" ? "视频" : "音频"}</span>
          <span>{formatSize(item.size)}</span>
          <span>
            <Clock3 aria-hidden="true" />
            剩余 {formatRemaining(item.expiresAt)}
          </span>
        </div>

        <div className="admin-generation-library-card__detail-grid">
          <div>
            <span>来源任务</span>
            <strong>{item.taskId || "-"}</strong>
          </div>
          <div>
            <span>Provider</span>
            <strong>{item.providerId || "-"}</strong>
          </div>
          <div>
            <span>模型</span>
            <strong>{item.modelId || "-"}</strong>
          </div>
          <div>
            <span>更新时间</span>
            <strong>{new Date(item.updatedAt).toLocaleString()}</strong>
          </div>
        </div>

        <div className="admin-public-resource-card__actions">
          <div className="admin-public-resource-card__action-row">
            <button type="button" onClick={onSendToShared}>
              <Plus aria-hidden="true" />
              转公共资源
            </button>
            <button type="button" className="danger-button" onClick={onDelete}>
              <Trash2 aria-hidden="true" />
              删除
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
