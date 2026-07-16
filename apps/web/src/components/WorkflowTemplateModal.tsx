import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, LayoutGrid, Loader2, Search, Workflow, X } from 'lucide-react';
import type { ResourceCategory, ResourceItem } from '../services/api';
import * as sharedResourceApi from '../services/sharedResourceApi';
import { useThemeStore } from '../stores/theme';
import { summarizeWorkflowResource } from '../utils/workflowResource';
import { WorkflowTopologyCard } from './resource-library/WorkflowTopologyCard';

interface WorkflowTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (item: ResourceItem) => Promise<void> | void;
}

export default function WorkflowTemplateModal({ open, onClose, onInsert }: WorkflowTemplateModalProps) {
  const { theme, style } = useThemeStore();
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [categoryId, setCategoryId] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [insertingId, setInsertingId] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      sharedResourceApi.getSharedResourceCategories('workflow'),
      sharedResourceApi.getSharedResourceItems({ kind: 'workflow', categoryId, q: query }),
    ]).then(([categoryResult, itemResult]) => {
      if (cancelled) return;
      if (categoryResult.success) setCategories(categoryResult.data);
      if (itemResult.success) setItems(itemResult.data);
      if (!categoryResult.success || !itemResult.success) {
        setError((!itemResult.success && itemResult.error) || (!categoryResult.success && categoryResult.error) || '模板加载失败');
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [categoryId, open, query]);

  const activeCategory = useMemo(() => categories.find((item) => item.id === categoryId), [categories, categoryId]);
  if (!open) return null;

  const panel = isPixel
    ? 'border-2 border-[var(--px-ink)] bg-[var(--px-surface)] text-[var(--px-ink)] shadow-[6px_6px_0_var(--px-ink)]'
    : isDark
      ? 'border border-white/10 bg-zinc-950 text-zinc-100 shadow-2xl'
      : 'border border-black/10 bg-white text-zinc-900 shadow-2xl';
  const muted = isPixel ? 'text-[var(--px-ink-soft)]' : isDark ? 'text-white/45' : 'text-zinc-500';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`grid h-[min(840px,92dvh)] w-[min(1440px,94vw)] grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg sm:grid-cols-[200px_minmax(0,1fr)] sm:grid-rows-1 lg:grid-cols-[220px_minmax(0,1fr)] ${panel}`} aria-modal="true" role="dialog" aria-label="工作流模板">
        <aside className={`flex min-h-0 flex-col border-b sm:border-b-0 sm:border-r ${isDark ? 'border-white/10 bg-white/[0.025]' : 'border-black/10 bg-black/[0.025]'}`}>
          <div className="flex h-14 items-center gap-2 border-b border-inherit px-4">
            <Workflow size={18} className="text-cyan-300" />
            <span className="text-sm font-semibold">工作流模板</span>
          </div>
          <nav className="flex min-h-0 flex-1 gap-1 overflow-x-auto p-2 sm:block sm:overflow-y-auto sm:p-3" aria-label="模板分类">
            <button type="button" onClick={() => setCategoryId('all')} className={`flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-left text-xs sm:mb-1 sm:w-full ${categoryId === 'all' ? 'bg-cyan-400 text-zinc-950' : 'hover:bg-white/5'}`}>
              <LayoutGrid size={14} /> 全部模板
              <span className="ml-auto tabular-nums">{items.length}</span>
            </button>
            {categories.map((category) => (
              <button key={category.id} type="button" onClick={() => setCategoryId(category.id)} className={`flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-left text-xs sm:mb-1 sm:w-full ${categoryId === category.id ? 'bg-cyan-400 text-zinc-950' : 'hover:bg-white/5'}`}>
                <FolderOpen size={14} /> <span className="truncate">{category.name}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col">
          <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-inherit px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-5">
            <div className="relative max-w-xl flex-1">
              <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工作流模板" className="h-9 w-full rounded-md border border-white/10 bg-white/5 pl-9 pr-3 text-xs outline-none focus:border-cyan-400/60" autoFocus />
            </div>
            <div className={`hidden text-xs sm:block ${muted}`}>{activeCategory?.name || '全部模板'} · {items.length}</div>
            <button type="button" onClick={onClose} className="t8-mini-icon-button h-9 w-9" title="关闭模板"><X size={17} /></button>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
            {error ? <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div> : null}
            {loading ? <div className={`flex h-64 items-center justify-center gap-2 text-xs ${muted}`}><Loader2 size={16} className="animate-spin" />加载模板</div> : null}
            {!loading && !error && items.length === 0 ? <div className={`flex h-64 flex-col items-center justify-center gap-2 text-xs ${muted}`}><Workflow size={30} />暂无公共工作流模板</div> : null}
            {!loading && items.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-3 sm:gap-4">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={Boolean(insertingId)}
                    onClick={async () => {
                      setInsertingId(item.id);
                      setError('');
                      try {
                        await onInsert(item);
                        onClose();
                      } catch (cause: any) {
                        setError(cause?.message || '模板插入失败');
                      } finally {
                        setInsertingId('');
                      }
                    }}
                    className={`group overflow-hidden rounded-md border text-left transition-colors disabled:opacity-50 ${isDark ? 'border-white/10 bg-white/[0.035] hover:border-cyan-300/50 hover:bg-white/[0.06]' : 'border-black/10 bg-black/[0.025] hover:border-cyan-500/40'}`}
                  >
                    <div className="aspect-[16/9] overflow-hidden bg-gradient-to-br from-cyan-950 via-zinc-900 to-emerald-950">
                      <WorkflowTopologyCard item={item} accent="#67e8f9" />
                    </div>
                    <div className="p-3">
                      <div className="truncate text-sm font-semibold" title={item.title}>{item.title}</div>
                      <div className={`mt-1 text-[11px] ${muted}`}>{summarizeWorkflowResource(item)}</div>
                      {item.tags?.length ? <div className={`mt-2 truncate text-[10px] ${muted}`}>{item.tags.slice(0, 4).join(' · ')}</div> : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </main>
        </div>
      </section>
    </div>
  );
}
