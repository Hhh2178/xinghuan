import { FolderPlus, Image as ImageIcon, Library, Music, RefreshCw, Save, Search, Trash2, Upload, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { adminSharedResourceApi } from "./admin-api-client";
import type { ResourceCategory, ResourceKind, ResourceMediaKind, SharedResourceItem } from "./admin-types";

const KIND_META: Record<ResourceKind, { label: string; icon: typeof ImageIcon }> = {
  image: { label: "图像", icon: ImageIcon },
  video: { label: "视频", icon: Video },
  audio: { label: "音频", icon: Music },
  set: { label: "素材集", icon: Library },
  pose: { label: "姿势", icon: Library },
  workflow: { label: "工作流", icon: Library },
};

type Draft = {
  title: string;
  categoryId: string;
  tagsText: string;
  note: string;
};

function createDraft(item: SharedResourceItem): Draft {
  return {
    title: item.title || "",
    categoryId: item.categoryId || "",
    tagsText: (item.tags || []).join(", "),
    note: item.note || "",
  };
}

function formatSize(size?: number) {
  if (!Number.isFinite(size || 0) || !size) return "-";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function AdminPublicResourcesPanel() {
  const [kind, setKind] = useState<ResourceKind>("image");
  const [categoryId, setCategoryId] = useState("all");
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [items, setItems] = useState<SharedResourceItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
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

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  function updateDraft(id: string, patch: Partial<Draft>) {
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
          <p>集中维护公共图像、视频、音频、素材集、姿势和工作流，前台用户可浏览并另存为个人资源。</p>
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
        {(Object.keys(KIND_META) as ResourceKind[]).map((nextKind) => {
          const Icon = KIND_META[nextKind].icon;
          return (
            <button key={nextKind} type="button" className={kind === nextKind ? "active" : ""} onClick={() => {
              setKind(nextKind);
              setCategoryId("all");
            }}>
              <Icon aria-hidden="true" />
              {KIND_META[nextKind].label}
            </button>
          );
        })}
        <label>
          <Search aria-hidden="true" />
          <input value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter") void load();
          }} placeholder="搜索名称 / 标签 / 备注" />
        </label>
      </div>

      {message ? <div className="error-banner">{message}</div> : null}

      <div className="admin-public-resources-layout">
        <aside className="data-panel admin-public-resources-categories">
          <header>
            <FolderPlus aria-hidden="true" />
            <h2>分类</h2>
            <button type="button" onClick={createCategory}>新增</button>
          </header>
          <div className="admin-public-resources-category-list">
            <button type="button" className={categoryId === "all" ? "active" : ""} onClick={() => setCategoryId("all")}>
              全部
            </button>
            {categories.map((category) => (
              <div key={category.id} className={categoryId === category.id ? "active" : ""}>
                <button type="button" onClick={() => setCategoryId(category.id)}>{category.name}</button>
                <button type="button" onClick={() => void renameCategory(category)}>改名</button>
                <button type="button" className="danger-button" onClick={() => void deleteCategory(category)}>删除</button>
              </div>
            ))}
          </div>
        </aside>

        <section className="data-panel admin-public-resources-list">
          <header>
            <Library aria-hidden="true" />
            <h2>{activeMeta.label}公共资源</h2>
            <span>{loading ? "加载中" : `${items.length} 项`}</span>
          </header>
          <div className="admin-public-resources-table">
            {items.map((item) => {
              const draft = drafts[item.id] || createDraft(item);
              return (
                <article key={item.id} className="admin-public-resource-row">
                  <div className="admin-public-resource-row__preview">
                    {item.kind === "image" && (item.fileUrl || item.url) ? <img src={item.fileUrl || item.url} alt={item.title} /> : null}
                    {item.kind === "video" ? <Video aria-hidden="true" /> : null}
                    {item.kind === "audio" ? <Music aria-hidden="true" /> : null}
                    {item.kind !== "image" && item.kind !== "video" && item.kind !== "audio" ? <Library aria-hidden="true" /> : null}
                  </div>
                  <div className="admin-public-resource-row__fields">
                    <input value={draft.title} onChange={(event) => updateDraft(item.id, { title: event.target.value })} placeholder="资源名称" />
                    <select value={draft.categoryId} onChange={(event) => updateDraft(item.id, { categoryId: event.target.value })}>
                      <option value="">未分类</option>
                      {item.categoryId && !categoryNameById.has(item.categoryId) ? (
                        <option value={item.categoryId}>缺失分类：{item.categoryId}</option>
                      ) : null}
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    <input value={draft.tagsText} onChange={(event) => updateDraft(item.id, { tagsText: event.target.value })} placeholder="标签，用英文逗号分隔" />
                    <input value={draft.note} onChange={(event) => updateDraft(item.id, { note: event.target.value })} placeholder="备注" />
                  </div>
                  <div className="admin-public-resource-row__meta">
                    <span>{item.mime || item.kind}</span>
                    <span>{formatSize(item.size)}</span>
                    <span>{new Date(item.updatedAt).toLocaleString()}</span>
                  </div>
                  <div className="admin-public-resource-row__actions">
                    <button type="button" onClick={() => void saveItem(item)}>
                      <Save aria-hidden="true" />
                      保存
                    </button>
                    <button type="button" className="danger-button" onClick={() => void deleteItem(item)}>
                      <Trash2 aria-hidden="true" />
                      删除
                    </button>
                  </div>
                </article>
              );
            })}
            {!loading && !items.length ? (
              <div className="admin-public-resources-empty">
                <Library aria-hidden="true" />
                <span>暂无公共资源</span>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
