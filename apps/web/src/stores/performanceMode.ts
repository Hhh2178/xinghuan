import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PerformanceMode = 'normal' | 'optimized';

interface PerformanceModeState {
  mode: PerformanceMode;
  setMode: (mode: PerformanceMode) => void;
}

export const usePerformanceModeStore = create<PerformanceModeState>()(
  persist(
    (set) => ({
      mode: 'normal',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'xinghuan-canvas-performance-mode-v1',
      partialize: (state) => ({ mode: state.mode }),
    },
  ),
);
