import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, Image as ImageIcon, Music, Plus, Search, Sparkles, Trash2, Video, X } from 'lucide-react';
import { useThemeStore } from '../stores/theme';
import * as api from '../services/api';
import type { GenerationLibraryItem, GenerationLibraryKind } from '../services/api';
import LoopingVideo from './LoopingVideo';

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
  const panelCls = isPixel
    ? 'border-l-2 border-[var(--px-ink)] bg-[var(--px-bg)] text-[var(--px-ink)]'
    : isDark
      ? 'border-l border-white/10 bg-zinc-950/95 text-zinc-100'
      : 'border-l border-black/10 bg-white/95 text-zinc-900';
  const subtle = isPixel ? 'text-[var(--px-ink-soft)]' : isDark ? 'text-white/55' : 'text-zinc-500';
  const inputCls = isPixel
    ? 'px-input h-9 text-xs'
    : `h-9 rounded-md border px-2 text-xs outline-none ${isDark ? 'border-white/10 bg-zinc-900 text-white' : 'border-black/10 bg-white text-zinc-900'}`;
  const itemBtn = isPixel
    ? 'px-btn px-btn--sm'
    : `rounded-md border px-2 py-1 text-xs transition ${isDark ? 'border-white/10 hover:bg-white/10' : 'border-black/10 hover:bg-black/5'}`;

  const insertItem = async (item: GenerationLibraryItem) => {
    await onInsertMaterial(item);
  };

  const deleteItem = async (item: GenerationLibraryItem) => {
    const res = await api.deleteGenerationLibraryItem(item.id);
    if (res.success) {
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      window.dispatchEvent(new CustomEvent('penguin:generation-library-changed'));
    } else {
      setMsg(res.error || '删除失败');
    }
  };

  if (!open) return null;

  return (
    <div className={`generation-library-drawer fixed top-0 right-0 z-50 h-screen w-[420px] max-w-[calc(100vw-18px)] shadow-2xl flex flex-col ${panelCls}`}>
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
            <article
              key={item.id}
              className={`generation-card overflow-hidden transition-transform ${isPixel ? 'border-2 border-[var(--px-ink)] bg-[var(--px-surface)] shadow-[3px_3px_0_var(--px-ink)]' : isDark ? 'rounded-lg border border-white/10 bg-white/[0.04]' : 'rounded-lg border border-black/10 bg-black/[0.03]'}`}
              data-drag-source
              data-drag-kind={item.kind}
              data-drag-url={item.fileUrl}
              data-drag-preview={item.fileUrl}
              data-drag-node-id="generation-library"
              title="Ctrl+拖拽到节点，或点击插入画布"
            >
              <div className="relative h-28 overflow-hidden bg-black/80">
                {item.kind === 'image' && <img src={item.fileUrl} alt={item.title} className="h-full w-full object-cover" draggable={false} />}
                {item.kind === 'video' && (
                  <LoopingVideo
                    src={item.fileUrl}
                    muted
                    className="h-full w-full object-cover"
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
              <div className="p-2 space-y-1.5">
                <div className="text-xs font-medium truncate" title={item.title}>{item.title}</div>
                <div className={`text-[10px] truncate ${subtle}`}>{formatSize(item.size) || item.mime || item.kind}</div>
                {item.kind === 'audio' && <audio src={item.fileUrl} controls className="h-8 w-full" />}
                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                  <button onClick={() => insertItem(item)} className={`${itemBtn} flex items-center gap-1`} title="插入画布">
                    <Plus size={13} /> 插入
                  </button>
                  <button onClick={() => deleteItem(item)} className={`${itemBtn} flex items-center gap-1 text-rose-300`} title="删除">
                    <Trash2 size={13} /> 删除
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
