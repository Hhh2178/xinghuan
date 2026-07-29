import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CanvasPresentation = 'legacy' | 'modern';

interface CanvasPresentationState {
  byUser: Record<string, CanvasPresentation>;
  setPresentation: (userId: string, presentation: CanvasPresentation) => void;
}

export function resolveCanvasPresentation(
  userId: string | undefined,
  byUser: Record<string, CanvasPresentation | string>,
): CanvasPresentation {
  return userId && byUser[userId] === 'modern' ? 'modern' : 'legacy';
}

export const useCanvasPresentationStore = create<CanvasPresentationState>()(
  persist(
    (set) => ({
      byUser: {},
      setPresentation: (userId, presentation) => set((state) => ({
        byUser: {
          ...state.byUser,
          [userId]: presentation,
        },
      })),
    }),
    {
      name: 'xinghuan-canvas-presentation-v1',
      partialize: (state) => ({ byUser: state.byUser }),
    },
  ),
);
