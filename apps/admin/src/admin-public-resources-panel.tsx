import { Image as ImageIcon, Library, Music, RefreshCw, Search, Upload, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { adminSharedResourceApi } from "./admin-api-client";
import { AdminMediaPreviewModal } from "./admin-media-preview-modal";
import { AdminPublicResourceCard } from "./admin-public-resource-card";
import { AdminPublicResourceCategorySidebar } from "./admin-public-resource-category-sidebar";
import type {
  AdminSharedResourceDraft,
  AdminSharedResourcePreviewKind,
  ResourceCategory,
  ResourceKind,
  ResourceMediaKind,
  SharedResourceItem,
} from "./admin-types";

const KIND_META: Record<ResourceKind, { label: string; icon: typeof ImageIcon }> = {
  image: { label: "图像", icon: ImageIcon },
  video: { label: "视频", icon: Video },
  audio: { label: "音频", icon: Music },
  set: { label: "素材集", icon: Library },
  pose: { label: "姿势", icon: Library },
  workflow: { label: "工作流", icon: Library },
};

function createDraft(item: SharedResourceItem): AdminSharedResourceDraft {
  return {
    title: item.title || "",
    categoryId: item.categoryId || "",
    tagsText: (item.tags || []).join(", "),
    note: item.note || "",
  };
}

function getPreviewKind(item: SharedResourceItem): AdminSharedResourcePreviewKind {
  if (item.kind === "image" || item.kind === "video" || item.kind === "audio") return item.kind;
  return "other";
}

export function AdminPublicResourcesPanel() {
  const [kind, setKind] = useState<ResourceKind>("image");
  const [categoryId, setCategoryId] = useState("all");
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [items, setItems] = useState<SharedResourceItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AdminSharedResourceDraft>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [previewItem, setPreviewItem] = useState<SharedResourceItem | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const canUpload = kind === "image" || kind === "video" || kind === "audio";
  const activeMeta = KIND_META[kind];

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [nextCategories, nextItems] = await Promise.all([
        adminSharedResourceApi.listCategories(kind),
        adminSharedResourceApi.listItems({ kind, categoryId, q }),
      ]);
      setCategories(nextCategories);
      setItems(nextItems);
      setDrafts(Object.fromEntries(nextItems.map((item) => [item.id, createDraft(item)])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [kind, categoryId]);

  const categoryNameById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);

  function updateDraft(id: string, patch: Partial<AdminSharedResourceDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function createCategory() {
    const name = window.prompt(`新建${activeMeta.label}公共分类`);
    if (!name?.trim()) return;
    try {
      await adminSharedResourceApi.createCategory({ kind, name: name.trim() });
      setMessage(`已创建分类：${name.trim()}`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function renameCategory(category: ResourceCategory) {
    const name = window.prompt("重命名公共分类", category.name);
    if (!name?.trim() || name.trim() === category.name) return;
    try {
      await adminSharedResourceApi.renameCategory(category.id, { name: name.trim(), revision: category.revision });
      setMessage("分类已重命名");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function deleteCategory(category: ResourceCategory) {
    if (!window.confirm(`删除公共分类“${category.name}”？分类内资源会移到未分类。`)) return;
    try {
      await adminSharedResourceApi.deleteCategory(category.id, category.revision);
      if (categoryId === category.id) setCategoryId("all");
      setMessage("分类已删除");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveItem(item: SharedResourceItem) {
    const draft = drafts[item.id] || createDraft(item);
    try {
      await adminSharedResourceApi.updateItem(item.id, {
        title: draft.title.trim() || item.title,
        categoryId: draft.categoryId,
        tags: draft.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
        note: draft.note.trim(),
        revision: item.revision,
      });
      setMessage(`已保存：${draft.title || item.title}`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function deleteItem(item: SharedResourceItem) {
    if (!window.confirm(`删除公共资源“${item.title}”？`)) return;
    try {
      await adminSharedResourceApi.deleteItem(item.id, item.revision);
      setMessage("资源已删除");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || !canUpload) return;
    setLoading(true);
    let uploadedCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.type && !file.type.startsWith(`${kind}/`)) continue;
        const uploaded = await adminSharedResourceApi.uploadFile(file);
        await adminSharedResourceApi.createItem({
          kind: kind as ResourceMediaKind,
          url: uploaded.url,
          title: file.name,
          originalName: file.name,
          mime: uploaded.mime || file.type,
          size: uploaded.size || file.size,
          categoryId: categoryId === "all" ? undefined : categoryId,
          tags: ["公共资源"],
        });
        uploadedCount += 1;
      }
      setMessage(uploadedCount ? `已上传 ${uploadedCount} 个公共资源` : `请选择${activeMeta.label}文件`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-public-resources-page">
      <div className="admin-public-resources-hero">
        <div>
          <span>Shared Resource Governance</span>
          <strong>公共资源管理</strong>
          <p>把公共图像、视频、音频与其他治理条目收在同一个卡片工作区里，确保预览完整可见、管理动作稳定可读。</p>
        </div>
        <div className="admin-public-resources-hero__actions">
          <button type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw aria-hidden="true" />
            刷新
          </button>
          <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={!canUpload || loading}>
            <Upload aria-hidden="true" />
            上传本地资源
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            className="admin-public-resources-file-input"
            accept={kind === "image" ? "image/*" : kind === "video" ? "video/*" : kind === "audio" ? "audio/*" : undefined}
            onChange={(event) => {
              void uploadFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      <div className="admin-public-resources-toolbar">
        <div className="admin-public-resources-toolbar__kinds">
          {(Object.keys(KIND_META) as ResourceKind[]).map((nextKind) => {
            const Icon = KIND_META[nextKind].icon;
            return (
              <button
                key={nextKind}
                type="button"
                className={kind === nextKind ? "active" : ""}
                onClick={() => {
                  setKind(nextKind);
                  setCategoryId("all");
                }}
              >
                <Icon aria-hidden="true" />
                {KIND_META[nextKind].label}
              </button>
            );
          })}
        </div>
        <label className="admin-public-resources-toolbar__search">
          <Search aria-hidden="true" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load();
            }}
            placeholder="搜索名称 / 标签 / 备注"
          />
        </label>
      </div>

      {message ? <div className="error-banner">{message}</div> : null}

      <div className="admin-public-resources-layout">
        <AdminPublicResourceCategorySidebar
          categories={categories}
          activeCategoryId={categoryId}
          itemCount={items.length}
          loading={loading}
          onSelectCategory={setCategoryId}
          onCreateCategory={() => void createCategory()}
          onRenameCategory={(category) => void renameCategory(category)}
          onDeleteCategory={(category) => void deleteCategory(category)}
        />

        <section className="data-panel admin-public-resources-workspace">
          <header>
            <div className="admin-public-resources-workspace__title">
              <Library aria-hidden="true" />
              <div>
                <h2>{activeMeta.label}公共资源</h2>
                <span>{loading ? "加载中" : `${items.length} 项资源`}</span>
              </div>
            </div>
          </header>

          <div className="admin-public-resources-grid">
            {items.map((item) => (
              <AdminPublicResourceCard
                key={item.id}
                item={item}
                draft={drafts[item.id] || createDraft(item)}
                categories={categories}
                categoryNameById={categoryNameById}
                onDraftChange={(patch) => updateDraft(item.id, patch)}
                onSave={() => void saveItem(item)}
                onDelete={() => void deleteItem(item)}
                onOpenPreview={() => setPreviewItem(item)}
              />
            ))}

            {!loading && !items.length ? (
              <div className="admin-public-resources-empty">
                <Library aria-hidden="true" />
                <span>暂无公共资源</span>
                <small>保留上传、分类与治理动作，等第一条资源进来后这里会自动切换成卡片网格。</small>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <AdminMediaPreviewModal
        open={Boolean(previewItem)}
        title={previewItem?.title || ""}
        url={previewItem?.fileUrl || previewItem?.url}
        mime={previewItem?.mime}
        kind={previewItem ? getPreviewKind(previewItem) : "other"}
        onClose={() => setPreviewItem(null)}
      />
    </section>
  );
}
