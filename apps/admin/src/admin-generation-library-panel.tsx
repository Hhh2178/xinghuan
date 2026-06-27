import { Clock3, Image as ImageIcon, Music, RefreshCw, Search, Sparkles, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adminGenerationLibraryApi } from "./admin-api-client";
import { AdminGenerationLibraryCard } from "./admin-generation-library-card";
import { AdminMediaPreviewModal } from "./admin-media-preview-modal";
import type { AdminSharedResourcePreviewKind, GenerationLibraryItem, GenerationLibraryKind } from "./admin-types";

const KIND_META: Record<GenerationLibraryKind, { label: string; icon: typeof ImageIcon }> = {
  image: { label: "图像", icon: ImageIcon },
  video: { label: "视频", icon: Video },
  audio: { label: "音频", icon: Music },
};

function previewKind(item: GenerationLibraryItem): AdminSharedResourcePreviewKind {
  return item.kind;
}

function previewUrl(item: GenerationLibraryItem) {
  return item.fileUrl || item.url || item.previewUrl || "";
}

function hoursUntilExpiry(item: GenerationLibraryItem) {
  return Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 3_600_000));
}

export function AdminGenerationLibraryPanel() {
  const [kind, setKind] = useState<GenerationLibraryKind>("image");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<GenerationLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [previewItem, setPreviewItem] = useState<GenerationLibraryItem | null>(null);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const nextItems = await adminGenerationLibraryApi.listItems({ kind, q });
      setItems(nextItems);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [kind]);

  const totals = useMemo(() => {
    const total = items.length;
    const expiringSoon = items.filter((item) => hoursUntilExpiry(item) <= 24).length;
    const fromTasks = items.filter((item) => item.taskId).length;
    const withModel = items.filter((item) => item.modelId).length;
    return { total, expiringSoon, fromTasks, withModel };
  }, [items]);

  async function handleDelete(item: GenerationLibraryItem) {
    if (!window.confirm(`删除生成素材“${item.title}”？`)) return;
    try {
      await adminGenerationLibraryApi.deleteItem(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setMessage("生成素材已删除");
      if (previewItem?.id === item.id) setPreviewItem(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSendToShared(item: GenerationLibraryItem) {
    try {
      await adminGenerationLibraryApi.createSharedResourceItem({
        kind: item.kind,
        url: item.fileUrl || item.url,
        title: item.title,
        originalName: item.filename || item.title,
        mime: item.mime,
        size: item.size,
        tags: ["生成库转入", item.kind === "image" ? "图像生成" : item.kind === "video" ? "视频生成" : "音频生成"],
        note: `由生成库转入公共资源。来源任务：${item.taskId || "-"}；Provider：${item.providerId || "-"}；模型：${item.modelId || "-"}`,
      });
      setMessage(`已转入公共资源：${item.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="admin-public-resources-page admin-generation-library-page">
      <div className="admin-public-resources-hero admin-generation-library-hero">
        <div>
          <span>Generation Result Governance</span>
          <strong>生成库后台治理</strong>
          <p>统一查看当前账号生成库里的图像、视频和音频结果，保持完整预览、自适应比例和可治理的转公共资源链路。</p>
        </div>
        <div className="admin-public-resources-hero__actions">
          <button type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw aria-hidden="true" />
            刷新
          </button>
        </div>
      </div>

      <div className="admin-public-resources-toolbar admin-generation-library-toolbar">
        <div className="admin-public-resources-toolbar__kinds">
          {(Object.keys(KIND_META) as GenerationLibraryKind[]).map((nextKind) => {
            const Icon = KIND_META[nextKind].icon;
            return (
              <button
                key={nextKind}
                type="button"
                className={kind === nextKind ? "active" : ""}
                onClick={() => setKind(nextKind)}
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
            placeholder="搜索标题 / mime / 文件地址 / taskId"
          />
        </label>
      </div>

      <div className="admin-public-resources-inspector admin-generation-library-inspector" aria-label="生成库概览">
        <div>
          <span>当前类型</span>
          <strong>{KIND_META[kind].label}</strong>
        </div>
        <div>
          <span>当前结果总数</span>
          <strong>{loading ? "同步中" : totals.total}</strong>
        </div>
        <div>
          <span>24 小时内到期</span>
          <strong>{totals.expiringSoon}</strong>
        </div>
        <div>
          <span>带模型记录</span>
          <strong>{totals.withModel}</strong>
        </div>
      </div>

      <div className="admin-generation-library-summary-grid">
        <article className="admin-generation-library-summary-card">
          <Sparkles aria-hidden="true" />
          <div>
            <strong>结果素材工作台</strong>
            <span>卡片上半区只负责完整预览，下半区负责来源信息和治理动作。</span>
          </div>
        </article>
        <article className="admin-generation-library-summary-card">
          <Clock3 aria-hidden="true" />
          <div>
            <strong>生命周期可见</strong>
            <span>明确展示剩余保留时间，方便及时转公共资源或清理。</span>
          </div>
        </article>
        <article className="admin-generation-library-summary-card">
          <Search aria-hidden="true" />
          <div>
            <strong>来源可追踪</strong>
            <span>保留任务、Provider、模型等关键信息，便于回查生成链路。</span>
          </div>
        </article>
      </div>

      {message ? <div className="error-banner">{message}</div> : null}

      <section className="data-panel admin-public-resources-workspace admin-generation-library-workspace">
        <header>
          <div className="admin-public-resources-workspace__title">
            <Sparkles aria-hidden="true" />
            <div>
              <h2>{KIND_META[kind].label}生成结果</h2>
              <span>{loading ? "加载中" : `${items.length} 项临时生成素材`}</span>
            </div>
          </div>
        </header>

        <div className="admin-public-resources-grid admin-generation-library-grid">
          {items.map((item) => (
            <AdminGenerationLibraryCard
              key={item.id}
              item={item}
              onOpenPreview={() => setPreviewItem(item)}
              onDelete={() => void handleDelete(item)}
              onSendToShared={() => void handleSendToShared(item)}
            />
          ))}

          {!loading && !items.length ? (
            <div className="admin-public-resources-empty">
              <Sparkles aria-hidden="true" />
              <span>当前没有生成素材</span>
              <small>等图像、视频或音频任务成功落库后，这里会自动进入完整预览卡片工作台。</small>
            </div>
          ) : null}
        </div>
      </section>

      <AdminMediaPreviewModal
        open={Boolean(previewItem)}
        title={previewItem?.title || ""}
        url={previewItem ? previewUrl(previewItem) : ""}
        mime={previewItem?.mime}
        kind={previewItem ? previewKind(previewItem) : "other"}
        onClose={() => setPreviewItem(null)}
      />
    </section>
  );
}
