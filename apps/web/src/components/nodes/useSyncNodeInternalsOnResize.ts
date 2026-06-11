import { useCallback, useLayoutEffect, useRef } from 'react';
import { useUpdateNodeInternals } from '@xyflow/react';

export function useSyncNodeInternalsOnResize(id: string) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const rafRef = useRef<{ first?: number; second?: number }>({});

  const syncNodeInternals = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (rafRef.current.first) window.cancelAnimationFrame(rafRef.current.first);
    if (rafRef.current.second) window.cancelAnimationFrame(rafRef.current.second);

    rafRef.current.first = window.requestAnimationFrame(() => {
      updateNodeInternals(id);
      rafRef.current.second = window.requestAnimationFrame(() => updateNodeInternals(id));
    });
  }, [id, updateNodeInternals]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    syncNodeInternals();
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => syncNodeInternals());
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (rafRef.current.first) window.cancelAnimationFrame(rafRef.current.first);
      if (rafRef.current.second) window.cancelAnimationFrame(rafRef.current.second);
      rafRef.current = {};
    };
  }, [syncNodeInternals]);

  return { rootRef, syncNodeInternals };
}
