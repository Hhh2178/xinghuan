import { create } from 'zustand';
import * as api from '../services/api';
import type { PublicModelCatalog } from '../services/api';

interface ModelCatalogState {
  catalog: PublicModelCatalog;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  lastLoadedAt: number;
  inFlight: Promise<void> | null;
  load: () => Promise<void>;
}

const EMPTY: PublicModelCatalog = {
  all: [],
  chatModels: [],
  imageModels: [],
  videoModels: [],
  audioModels: [],
};

export const useModelCatalogStore = create<ModelCatalogState>((set, get) => ({
  catalog: EMPTY,
  loading: false,
  error: null,
  loaded: false,
  lastLoadedAt: 0,
  inFlight: null,

  async load() {
    const current = get();
    if (current.inFlight) return current.inFlight;
    if (current.loaded && current.lastLoadedAt > 0 && Date.now() - current.lastLoadedAt < 5_000) return;
    set({ loading: true, error: null });
    const request = (async () => {
      try {
        const catalog = await api.getModelCatalog();
        set({ catalog: { ...EMPTY, ...catalog }, loading: false, loaded: true, lastLoadedAt: Date.now() });
      } catch (error: any) {
        set({ catalog: EMPTY, loading: false, loaded: true, lastLoadedAt: 0, error: error?.message || '模型目录加载失败' });
      } finally {
        set({ inFlight: null });
      }
    })();
    set({ inFlight: request });
    return request;
  },
}));
