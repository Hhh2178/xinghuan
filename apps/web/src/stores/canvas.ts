import { create } from 'zustand';
import type { CanvasListItem } from '../types/canvas';
import * as api from '../services/api';

interface CanvasStoreState {
  canvases: CanvasListItem[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  lastLoadedAt: number;
  inFlight: Promise<void> | null;

  loadCanvases: (options?: { force?: boolean }) => Promise<void>;
  createCanvas: (name?: string) => Promise<CanvasListItem | null>;
  deleteCanvas: (id: string) => Promise<void>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  setActive: (id: string) => void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  canvases: [],
  activeId: null,
  loading: false,
  error: null,
  lastLoadedAt: 0,
  inFlight: null,

  async loadCanvases(options = {}) {
    const current = get();
    if (!options.force && current.inFlight) return current.inFlight;
    if (!options.force && current.lastLoadedAt > 0 && Date.now() - current.lastLoadedAt < 5_000) return;
    set({ loading: true, error: null });
    const request = (async () => {
      try {
        const list = await api.listCanvases();
        const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
        set({
          canvases: sorted,
          loading: false,
          lastLoadedAt: Date.now(),
          // 若无激活画布,默认选中最新一个
          activeId: get().activeId || sorted[0]?.id || null,
        });
      } catch (e: any) {
        set({ loading: false, error: e?.message || '加载画布列表失败' });
      } finally {
        set({ inFlight: null });
      }
    })();
    set({ inFlight: request });
    return request;
  },

  async createCanvas(name) {
    try {
      const item = await api.createCanvas(name);
      set((s) => ({ canvases: [item, ...s.canvases], activeId: item.id, lastLoadedAt: Date.now() }));
      return item;
    } catch (e: any) {
      set({ error: e?.message || '创建画布失败' });
      return null;
    }
  },

  async deleteCanvas(id) {
    try {
      await api.deleteCanvas(id);
      set((s) => {
        const list = s.canvases.filter((x) => x.id !== id);
        const activeId = s.activeId === id ? list[0]?.id || null : s.activeId;
        return { canvases: list, activeId, lastLoadedAt: Date.now() };
      });
    } catch (e: any) {
      set({ error: e?.message || '删除失败' });
    }
  },

  async renameCanvas(id, name) {
    try {
      const updated = await api.renameCanvas(id, name);
      set((s) => ({
        canvases: s.canvases.map((x) => (x.id === id ? updated : x)),
        lastLoadedAt: Date.now(),
      }));
    } catch (e: any) {
      set({ error: e?.message || '重命名失败' });
    }
  },

  setActive(id) {
    set({ activeId: id });
  },
}));
