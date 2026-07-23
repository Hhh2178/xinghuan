import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import {
  ASSISTANT_COMPACT_MAX_WIDTH,
  DEFAULT_ASSISTANT_ANCHOR,
  DEFAULT_ASSISTANT_SIZE,
  normalizeAssistantAnchor,
  normalizeAssistantSize,
  resolveAssistantLayout,
  snapAssistantAnchor,
  type AssistantAnchor,
  type AssistantRect,
  type AssistantSize,
} from './assistant-geometry';

interface StoredAssistantGeometry {
  anchor: AssistantAnchor;
  size: AssistantSize;
}

interface DragState {
  kind: 'launcher' | 'panel';
  pointerId: number;
  startX: number;
  startY: number;
  anchor: AssistantAnchor;
  moved: boolean;
}

export function useAssistantGeometry(ownerId: string, open: boolean) {
  const [viewport, setViewport] = useState(readViewport);
  const [geometry, setGeometry] = useState<StoredAssistantGeometry>(() => readStored(ownerId, readViewport()));
  const [supervisionRect, setSupervisionRect] = useState<AssistantRect | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressLauncherClickRef = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const nextViewport = readViewport();
    setViewport(nextViewport);
    setGeometry(readStored(ownerId, nextViewport));
  }, [ownerId]);

  useEffect(() => {
    const update = () => setViewport(readViewport());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey(ownerId), JSON.stringify(geometry));
  }, [geometry, ownerId]);

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    const readSupervision = () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      const element = document.querySelector<HTMLElement>('.canvas-supervision-panel');
      if (!element) {
        setSupervisionRect(null);
        return;
      }
      const update = () => {
        const rect = element.getBoundingClientRect();
        const next = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        setSupervisionRect((current) => sameRect(current, next) ? current : next);
      };
      update();
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(element);
    };
    readSupervision();
    const mutationObserver = new MutationObserver(readSupervision);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', readSupervision);
    return () => {
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', readSupervision);
    };
  }, []);

  useEffect(() => {
    if (!open || !panelRef.current || viewport.width <= ASSISTANT_COMPACT_MAX_WIDTH) return;
    const observer = new ResizeObserver(([entry]) => {
      const target = entry.target as HTMLElement;
      const width = target.offsetWidth;
      const height = target.offsetHeight;
      setGeometry((current) => {
        const expected = resolveAssistantLayout({
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          anchor: current.anchor,
          size: current.size,
          supervisionRect,
        }).panel;
        if (Math.abs(width - expected.width) < 2 && Math.abs(height - expected.height) < 2) return current;
        const size = normalizeAssistantSize({ width, height }, viewport);
        return Math.abs(size.width - current.size.width) < 2 && Math.abs(size.height - current.size.height) < 2
          ? current
          : { ...current, size };
      });
    });
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [open, supervisionRect, viewport]);

  const layout = useMemo(() => resolveAssistantLayout({
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    anchor: geometry.anchor,
    size: geometry.size,
    supervisionRect,
  }), [geometry, supervisionRect, viewport]);

  const beginLauncherDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: 'launcher',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      anchor: geometry.anchor,
      moved: false,
    };
  };

  const beginPanelDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button,input,textarea,select,a')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: 'panel',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      anchor: geometry.anchor,
      moved: false,
    };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    drag.moved ||= Math.abs(deltaX) + Math.abs(deltaY) > 5;
    if (drag.kind === 'launcher') {
      setGeometry((current) => ({
        ...current,
        anchor: snapAssistantAnchor({
          pointerX: event.clientX,
          pointerY: event.clientY,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          offsetX: current.anchor.offsetX,
          offsetY: current.anchor.offsetY,
        }),
      }));
      return;
    }
    setGeometry((current) => ({
      ...current,
      anchor: normalizeAssistantAnchor({
        ...current.anchor,
        offsetX: drag.anchor.offsetX + deltaX,
        offsetY: drag.anchor.offsetY + deltaY,
      }, viewport),
    }));
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    suppressLauncherClickRef.current = drag.kind === 'launcher' && drag.moved;
    dragRef.current = null;
  };

  const consumeLauncherClick = () => {
    const suppressed = suppressLauncherClickRef.current;
    suppressLauncherClickRef.current = false;
    return suppressed;
  };

  return {
    layout,
    panelRef,
    beginLauncherDrag,
    beginPanelDrag,
    moveDrag,
    endDrag,
    consumeLauncherClick,
  };
}

function readStored(ownerId: string, viewport: { width: number; height: number }): StoredAssistantGeometry {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(ownerId)) || '{}');
    return {
      anchor: normalizeAssistantAnchor(stored.anchor || DEFAULT_ASSISTANT_ANCHOR, viewport),
      size: normalizeAssistantSize(stored.size || DEFAULT_ASSISTANT_SIZE, viewport),
    };
  } catch {
    return {
      anchor: normalizeAssistantAnchor(DEFAULT_ASSISTANT_ANCHOR, viewport),
      size: normalizeAssistantSize(DEFAULT_ASSISTANT_SIZE, viewport),
    };
  }
}

function readViewport() {
  return {
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
  };
}

function storageKey(ownerId: string) {
  return `xinghuan.canvas-assistant.geometry:${ownerId || 'anonymous'}`;
}

function sameRect(left: AssistantRect | null, right: AssistantRect) {
  return Boolean(left)
    && Math.abs(left!.x - right.x) < 1
    && Math.abs(left!.y - right.y) < 1
    && Math.abs(left!.width - right.width) < 1
    && Math.abs(left!.height - right.height) < 1;
}
