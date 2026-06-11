import { create } from 'zustand';
import * as api from '../services/api';
import type { PublicModelCatalog } from '../services/api';

interface ModelCatalogState {
  catalog: PublicModelCatalog;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  load: () => Promise<void>;
}

const EMPTY: PublicModelCatalog = {
  all: [],
  chatModels: [],
  imageModels: [],
  videoModels: [],
  audioModels: [],
};

export const useModelCatalogStore = create<ModelCatalogState>((set) => ({
  catalog: EMPTY,
  loading: false,
  error: null,
  loaded: false,

  async load() {
    set({ loading: true, error: null });
    try {
      const catalog = await api.getModelCatalog();
      set({ catalog: { ...EMPTY, ...catalog }, loading: false, loaded: true });
    } catch (error: any) {
      set({ catalog: EMPTY, loading: false, loaded: true, error: error?.message || '模型目录加载失败' });
    }
  },
}));
