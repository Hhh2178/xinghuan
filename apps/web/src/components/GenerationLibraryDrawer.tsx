import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, Download, Eye, Image as ImageIcon, Music, Plus, Search, Sparkles, Trash2, Video, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useThemeStore } from '../stores/theme';
import * as api from '../services/api';
import type { GenerationLibraryItem, GenerationLibraryKind } from '../services/api';
import LoopingVideo from './LoopingVideo';
import GenerationLibraryPreviewOverlay from './GenerationLibraryPreviewOverlay';
import { ResourceMediaCard } from './resource-library/ResourceMediaCard';

const KIND_META: Record<GenerationLibraryKind, { label: string; icon: typeof ImageIcon; accent: string }> = {
  image: { label: '图片', icon: ImageIcon, accent: '#fbbf24' },
  video: { label: '视频', icon: Video, accent: '#fb7185' },
  audio: { label: '音频', icon: Music, accent: '#a78bfa' },
};

interface GenerationLibraryDrawerProps {
  open: boolean;
  onClose: () => void;
  onInsertMaterial: (item: GenerationLibraryItem) => void | Promise<void>;
}

function resultData<T>(r: api.Result<T> | any): T | null {
  return r?.success ? (r.data as T) : null;
}

function formatSize(size?: number) {
  if (!Number.isFinite(size || 0) || !size) return '';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatRemaining(expiresAt: number) {
  const ms = Math.max(0, expiresAt - Date.now());
  const hours = Math.ceil(ms / 3_600_000);
  if (hours <= 1) return '不足 1 小时';
  if (hours < 24) return `${hours} 小时`;
  return `${Math.ceil(hours / 24)} 天`;
}

export default function GenerationLibraryDrawer({ open, onClose, onInsertMaterial }: GenerationLibraryDrawerProps) {
  const { theme, style } = useThemeStore();
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';
  const [kind, setKind] = useState<GenerationLibraryKind>('image');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<GenerationLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!open) return;
    if (!silent) setLoading(true);
    const res = await api.getGenerationLibraryItems({ kind, q });
    const nextItems = resultData<GenerationLibraryItem[]>(res);
    if (nextItems) {
      setItems(nextItems);
      setMsg('');
    } else {
      setMsg((res as any)?.error || '生成库加载失败');
    }
    if (!silent) setLoading(false);
  }, [kind, open, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onChanged = () => void load({ silent: true });
    window.addEventListener('penguin:generation-library-changed', onChanged);
    return () => window.removeEventListener('penguin:generation-library-changed', onChanged);
  }, [load, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void load({ silent: true });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load, open]);

  const activeMeta = KIND_META[kind];
  const ActiveIcon = activeMeta.icon;
  const totalText = useMemo(() => `${items.length} 个临时素材`, [items.length]);
  const previewableItems = useMemo(
    () => items.filter((item) => item.kind === 'image' || item.kind === 'video'),
    [items],
  );
  const activePreviewItem = previewIndex === null ? null : previewableItems[previewIndex] || null;
  const panelCls = isPixel
    ? 'border-l-2 border-[var(--px-ink)] bg-[var(--px-bg)] text-[var(--px-ink)]'
    : isDark
      ? 'border-l border-white/10 bg-zinc-950/95 text-zinc-100'
      : 'border-l border-black/10 bg-white/95 text-zinc-900';
  const subtle = isPixel ? 'text-[var(--px-ink-soft)]' : isDark ? 'text-white/55' : 'text-zinc-500';
  const inputCls = isPixel
    ? 'px-input h-9 text-xs'
    : `h-9 rounded-md border px-2 text-xs outline-none ${isDark ? 'border-white/10 bg-zinc-900 text-white' : 'border-black/10 bg-white text-zinc-900'}`;
  const miniActionBase: CSSProperties = {
    width: 28,
    height: 28,
    minWidth: 28,
    padding: 0,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 28px',
    border: isPixel ? '2px solid var(--px-ink, #1A1410)' : `1px solid ${isDark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.22)'}`,
    background: isPixel ? 'var(--px-surface, #fff)' : isDark ? 'rgba(255,255,255,.06)' : '#fffdf6',
    color: isPixel ? 'var(--px-ink, #1A1410)' : isDark ? '#f8fafc' : '#1f2937',
    boxShadow: isPixel ? '2px 2px 0 var(--px-ink, #1A1410)' : '0 1px 2px rgba(0,0,0,.12)',
    lineHeight: 1,
  };
  const miniInsertStyle: CSSProperties = {
    ...miniActionBase,
    background: isPixel ? 'var(--px-candy-mint, #A8E6C9)' : activeMeta.accent,
    color: isPixel ? 'var(--px-ink, #1A1410)' : '#08111f',
  };
  const miniDeleteStyle: CSSProperties = {
    ...miniActionBase,
    color: '#dc2626',
  };

  const insertItem = async (item: GenerationLibraryItem) => {
    await onInsertMaterial(item);
  };

  const openPreview = (item: GenerationLibraryItem) => {
    const index = previewableItems.findIndex((entry) => entry.id === item.id);
    if (index >= 0) setPreviewIndex(index);
  };

  const closePreview = () => setPreviewIndex(null);
  const showPrev = () => setPreviewIndex((current) => (current === null ? current : Math.max(0, current - 1)));
  const showNext = () =>
    setPreviewIndex((current) => (current === null ? current : Math.min(previewableItems.length - 1, current + 1)));

  const deleteItem = async (item: GenerationLibraryItem) => {
    const res = await api.deleteGenerationLibraryItem(item.id);
    if (res.success) {
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      setPreviewIndex((current) => {
        if (current === null) return current;
        const nextPreviewItems = previewableItems.filter((entry) => entry.id !== item.id);
        if (nextPreviewItems.length === 0) return null;
        return Math.min(current, nextPreviewItems.length - 1);
      });
      window.dispatchEvent(new CustomEvent('penguin:generation-library-changed'));
    } else {
      setMsg(res.error || '删除失败');
    }
  };

  if (!open) return null;

  return (
    <div className={`generation-library-drawer fixed inset-y-0 right-0 z-50 h-dvh w-[min(420px,100vw)] max-w-[100vw] overflow-hidden shadow-2xl flex flex-col ${panelCls}`}>
      <div className={`h-[52px] px-4 py-3 flex items-center justify-between shrink-0 ${isPixel ? 'border-b-2 border-[var(--px-ink)] bg-[var(--px-muted)]' : isDark ? 'border-b border-white/10' : 'border-b border-black/10'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={18} style={{ color: activeMeta.accent }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-none">生成库</div>
            <div className={`text-[11px] mt-1 ${subtle}`}>{totalText} · 最多保留 3 天</div>
          </div>
        </div>
        <button onClick={onClose} className={isPixel ? 't8-mini-icon-button px-btn px-btn--icon px-btn--ghost' : `t8-mini-icon-button h-9 w-9 p-0 rounded-md ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`} title="关闭">
          <X size={16} />
        </button>
      </div>

      <div className={`px-3 py-2 flex items-center gap-1.5 shrink-0 ${isPixel ? 'border-b-2 border-[var(--px-ink)]' : isDark ? 'border-b border-white/10' : 'border-b border-black/10'}`}>
        {(Object.keys(KIND_META) as GenerationLibraryKind[]).map((nextKind) => {
          const meta = KIND_META[nextKind];
          const Icon = meta.icon;
          const active = kind === nextKind;
          return (
            <button
              key={nextKind}
              onClick={() => setKind(nextKind)}
              className={isPixel ? `px-btn px-btn--sm ${active ? 'px-btn--yellow' : ''}` : `flex-1 h-8 rounded-md text-xs flex items-center justify-center gap-1.5 ${active ? 'text-zinc-950' : subtle}`}
              style={!isPixel && active ? { background: meta.accent } : undefined}
            >
              <Icon size={13} /> {meta.label}
            </button>
          );
        })}
      </div>

      <div className={`px-3 py-2 shrink-0 ${isPixel ? 'border-b-2 border-[var(--px-ink)]' : isDark ? 'border-b border-white/10' : 'border-b border-black/10'}`}>
        <div className="relative">
          <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${subtle}`} />
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索生成素材" className={`${inputCls} w-full pl-8`} />
        </div>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto p-3">
        {msg && (
          <div className={`mb-2 text-[11px] px-2 py-1 rounded ${isPixel ? 'bg-[var(--px-yellow)] border-2 border-[var(--px-ink)]' : isDark ? 'bg-white/10 text-white/70' : 'bg-black/5 text-zinc-600'}`}>
            {msg}
          </div>
        )}
        {loading && <div className={`text-xs ${subtle}`}>加载中...</div>}
        {!loading && items.length === 0 && (
          <div className={`h-56 flex flex-col items-center justify-center text-xs ${subtle}`}>
            <ActiveIcon size={28} style={{ color: activeMeta.accent }} />
            <span className="mt-2">暂无生成素材</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <ResourceMediaCard
              key={item.id}
              className={`generation-card ${isPixel ? 'border-2 border-[var(--px-ink)] bg-[var(--px-surface)] shadow-[3px_3px_0_var(--px-ink)]' : isDark ? 'bg-white/[0.04]' : 'border-black/10 bg-black/[0.03]'}`}
              title={item.title}
              subtitle={formatSize(item.size) || item.mime || item.kind}
              media={
                <div
                  data-drag-source
                  data-drag-kind={item.kind}
                  data-drag-url={item.fileUrl}
                  data-drag-preview={item.previewUrl || item.fileUrl}
                  data-drag-node-id="generation-library"
                  title="Ctrl+拖拽到节点，或点击插入画布"
                  className="relative h-full w-full"
                  onClick={() => (item.kind === 'image' || item.kind === 'video') && openPreview(item)}
                >
                  {item.kind === 'image' && (
                    <img
                      src={item.previewUrl || item.fileUrl}
                      alt={item.title}
                      className="h-full w-full cursor-zoom-in object-contain"
                      draggable={false}
                    />
                  )}
                  {item.kind === 'video' && (
                    <LoopingVideo
                      src={item.previewUrl || item.fileUrl}
                      muted
                      className="h-full w-full cursor-zoom-in object-contain"
                      onMouseEnter={(event) => event.currentTarget.play().catch(() => {})}
                      onMouseLeave={(event) => {
                        event.currentTarget.pause();
                        event.currentTarget.currentTime = 0;
                      }}
                    />
                  )}
                  {item.kind === 'audio' && (
                    <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(135deg,#155e75,#7c3aed,#db2777)' }}>
                      <Music size={34} className="text-white drop-shadow" />
                    </div>
                  )}
                  <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Clock3 size={11} />
                    {formatRemaining(item.expiresAt)}
                  </div>
                </div>
              }
              actions={
                <>
                  {(item.kind === 'image' || item.kind === 'video') && (
                    <button
                      onClick={() => openPreview(item)}
                      className="nodrag nopan t8-mini-icon-button resource-card-action"
                      style={miniActionBase}
                      title="查看"
                      aria-label="查看"
                    >
                      <Eye size={13} />
                    </button>
                  )}
                  {item.downloadUrl && item.canDownload !== false && (
                    <a
                      href={item.downloadUrl}
                      className="nodrag nopan t8-mini-icon-button resource-card-action"
                      style={miniActionBase}
                      title="下载"
                      aria-label="下载"
                    >
                      <Download size={13} />
                    </a>
                  )}
                  <button
                    onClick={() => insertItem(item)}
                    className="nodrag nopan t8-mini-icon-button resource-card-action"
                    style={miniInsertStyle}
                    title="插入画布"
                    aria-label="插入画布"
                  >
                    <Plus size={15} />
                  </button>
                  <button
                    onClick={() => deleteItem(item)}
                    className="nodrag nopan t8-mini-icon-button resource-card-action"
                    style={miniDeleteStyle}
                    title="删除"
                    aria-label="删除"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              }
            >
              {item.kind === 'audio' && <audio src={item.fileUrl} controls className="h-8 w-full" />}
            </ResourceMediaCard>
          ))}
        </div>
      </main>
      {activePreviewItem && (
        <GenerationLibraryPreviewOverlay
          item={activePreviewItem}
          hasPrev={previewIndex !== null && previewIndex > 0}
          hasNext={previewIndex !== null && previewIndex < previewableItems.length - 1}
          onPrev={showPrev}
          onNext={showNext}
          onClose={closePreview}
        />
      )}
    </div>
  );
}
