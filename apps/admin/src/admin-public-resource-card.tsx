import { ExternalLink, Library, Music, Save, Trash2, Video } from "lucide-react";
import type {
  AdminSharedResourceDraft,
  AdminSharedResourcePreviewKind,
  ResourceCategory,
  SharedResourceItem,
} from "./admin-types";

type AdminPublicResourceCardProps = {
  item: SharedResourceItem;
  draft: AdminSharedResourceDraft;
  categories: ResourceCategory[];
  categoryNameById: Map<string, string>;
  onDraftChange: (patch: Partial<AdminSharedResourceDraft>) => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenPreview: () => void;
};

function formatSize(size?: number) {
  if (!Number.isFinite(size || 0) || !size) return "-";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getPreviewKind(item: SharedResourceItem): AdminSharedResourcePreviewKind {
  if (item.kind === "image" || item.kind === "video" || item.kind === "audio") return item.kind;
  return "other";
}

function getPreviewUrl(item: SharedResourceItem) {
  return item.fileUrl || item.url || "";
}

function getPreviewText(item: SharedResourceItem) {
  if (item.kind === "video") return "完整预览";
  if (item.kind === "audio") return "试听";
  if (item.kind === "image") return "查看原图";
  return "查看资源";
}

function renderPreview(item: SharedResourceItem) {
  const previewUrl = getPreviewUrl(item);
  const previewKind = getPreviewKind(item);

  if (previewKind === "image" && previewUrl) {
    return <img src={previewUrl} alt={item.title} />;
  }

  if (previewKind === "video" && previewUrl) {
    return <video src={previewUrl} muted playsInline preload="metadata" aria-label={item.title} />;
  }

  if (previewKind === "video") {
    return (
      <div className="admin-public-resource-card__preview-state">
        <Video aria-hidden="true" />
        <span>{item.mime || "video"}</span>
      </div>
    );
  }

  if (previewKind === "audio" && previewUrl) {
    return (
      <div className="admin-public-resource-card__audio-preview">
        <div className="admin-public-resource-card__preview-state">
          <Music aria-hidden="true" />
          <span>{item.mime || "audio"}</span>
        </div>
        <audio src={previewUrl} controls preload="metadata" />
      </div>
    );
  }

  if (previewKind === "audio") {
    return (
      <div className="admin-public-resource-card__preview-state">
        <Music aria-hidden="true" />
        <span>{item.mime || "audio"}</span>
      </div>
    );
  }

  return (
    <div className="admin-public-resource-card__preview-state">
      <Library aria-hidden="true" />
      <span>{item.kind}</span>
    </div>
  );
}

export function AdminPublicResourceCard({
  item,
  draft,
  categories,
  categoryNameById,
  onDraftChange,
  onSave,
  onDelete,
  onOpenPreview,
}: AdminPublicResourceCardProps) {
  const previewUrl = getPreviewUrl(item);
  const previewKind = getPreviewKind(item);
  const missingCategory = item.categoryId && !categoryNameById.has(item.categoryId);

  return (
    <article className="admin-public-resource-card">
      <div className="admin-public-resource-card__preview-shell">
        <div className="admin-public-resource-card__preview-frame">{renderPreview(item)}</div>
        <div className="admin-public-resource-card__preview-actions">
          <button type="button" onClick={onOpenPreview}>
            <ExternalLink aria-hidden="true" />
            {getPreviewText(item)}
          </button>
          {previewUrl ? (
            <a href={previewUrl} target="_blank" rel="noreferrer" className="admin-public-resource-card__preview-link">
              原始链接
            </a>
          ) : null}
        </div>
      </div>

      <div className="admin-public-resource-card__management">
        <div className="admin-public-resource-card__fields">
          <label className="admin-public-resource-card__field">
            <span>资源名称</span>
            <input value={draft.title} onChange={(event) => onDraftChange({ title: event.target.value })} placeholder="资源名称" />
          </label>
          <label className="admin-public-resource-card__field">
            <span>分类</span>
            <select value={draft.categoryId} onChange={(event) => onDraftChange({ categoryId: event.target.value })}>
              <option value="">未分类</option>
              {missingCategory ? <option value={item.categoryId}>缺失分类：{item.categoryId}</option> : null}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-public-resource-card__field admin-public-resource-card__field--span-2">
            <span>标签</span>
            <input
              value={draft.tagsText}
              onChange={(event) => onDraftChange({ tagsText: event.target.value })}
              placeholder="标签，用英文逗号分隔"
            />
          </label>
          <label className="admin-public-resource-card__field admin-public-resource-card__field--span-2">
            <span>备注</span>
            <textarea value={draft.note} onChange={(event) => onDraftChange({ note: event.target.value })} rows={3} placeholder="备注" />
          </label>
        </div>

        <div className="admin-public-resource-card__meta">
          <span>{item.mime || previewKind}</span>
          <span>{formatSize(item.size)}</span>
          <span>{new Date(item.updatedAt).toLocaleString()}</span>
        </div>

        <div className="admin-public-resource-card__actions">
          <button type="button" onClick={onSave}>
            <Save aria-hidden="true" />
            保存
          </button>
          <button type="button" className="danger-button" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            删除
          </button>
        </div>
      </div>
    </article>
  );
}
