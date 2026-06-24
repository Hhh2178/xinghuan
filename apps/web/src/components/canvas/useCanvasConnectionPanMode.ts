import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { Connection, Viewport } from '@xyflow/react';
import { formatShortcutList, matchesAnyShortcut, type ShortcutMap } from '../../utils/keyboardShortcuts';

interface ReactFlowHandleInfo {
  nodeId: string;
  handleType: 'source' | 'target';
  handleId: string | null;
}

interface UseCanvasConnectionPanModeArgs {
  shortcuts: ShortcutMap;
  isConnectionDraggingRef: MutableRefObject<boolean>;
  connectionPanModeRef: MutableRefObject<boolean>;
  connectingFromRef: MutableRefObject<{
    nodeId: string;
    handleType: 'source' | 'target';
  } | null>;
  connectionPanPointerRef: MutableRefObject<{ x: number; y: number } | null>;
  onConnect: (connection: Connection) => void;
  getViewport: () => Viewport;
  setViewport: (
    viewport: Viewport,
    options?: {
      duration?: number;
    },
  ) => void | Promise<boolean>;
  setConnectionPanMode: (enabled: boolean) => void;
  resetConnectionPanMode: () => void;
  isTextEditingTarget: (target: EventTarget | null) => boolean;
  getReactFlowHandleInfo: (target: EventTarget | null) => ReactFlowHandleInfo | null;
}

export function useCanvasConnectionPanMode({
  shortcuts,
  isConnectionDraggingRef,
  connectionPanModeRef,
  connectingFromRef,
  connectionPanPointerRef,
  onConnect,
  getViewport,
  setViewport,
  setConnectionPanMode,
  resetConnectionPanMode,
  isTextEditingTarget,
  getReactFlowHandleInfo,
}: UseCanvasConnectionPanModeArgs) {
  useEffect(() => {
    const stopNativePointer = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      (event as any).stopImmediatePropagation?.();
    };

    const connectPendingToHandle = (handle: ReactFlowHandleInfo | null) => {
      const from = connectingFromRef.current;
      if (!from || !handle || from.nodeId === handle.nodeId || from.handleType === handle.handleType) return false;
      const params: Connection =
        from.handleType === 'source'
          ? {
              source: from.nodeId,
              sourceHandle: null,
              target: handle.nodeId,
              targetHandle: handle.handleId,
            }
          : {
              source: handle.nodeId,
              sourceHandle: handle.handleId,
              target: from.nodeId,
              targetHandle: null,
            };
      connectingFromRef.current = null;
      onConnect(params);
      return true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isConnectionDraggingRef.current) return;
      if (!matchesAnyShortcut(shortcuts['connection.pan-mode'], event)) return;
      if (isTextEditingTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (connectionPanModeRef.current) {
        connectingFromRef.current = null;
        resetConnectionPanMode();
        return;
      }
      setConnectionPanMode(true);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!isConnectionDraggingRef.current || !connectionPanModeRef.current) return;
      const target = event.target as Element | null;
      if (target?.closest('[data-canvas-floating-ui], .t8-context-menu, input, textarea, select, [contenteditable="true"]')) return;

      const handle = getReactFlowHandleInfo(event.target);
      if (handle) {
        stopNativePointer(event);
        connectPendingToHandle(handle);
        return;
      }

      if (event.button !== 0) return;
      connectionPanPointerRef.current = { x: event.clientX, y: event.clientY };
      stopNativePointer(event);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isConnectionDraggingRef.current || !connectionPanModeRef.current) return;
      if (event.buttons === 0) {
        connectionPanPointerRef.current = null;
        return;
      }
      const current = { x: event.clientX, y: event.clientY };
      const last = connectionPanPointerRef.current;
      connectionPanPointerRef.current = current;
      if (!last) return;
      const dx = current.x - last.x;
      const dy = current.y - last.y;
      if (dx === 0 && dy === 0) return;
      const viewport = getViewport();
      void setViewport({ x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom }, { duration: 0 });
      stopNativePointer(event);
    };

    const onPointerUp = () => {
      connectionPanPointerRef.current = null;
    };
    const onBlur = () => resetConnectionPanMode();

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('blur', onBlur);
      document.body.classList.remove('connection-pan-mode');
    };
  }, [
    connectingFromRef,
    connectionPanModeRef,
    connectionPanPointerRef,
    getReactFlowHandleInfo,
    getViewport,
    isConnectionDraggingRef,
    isTextEditingTarget,
    onConnect,
    resetConnectionPanMode,
    setConnectionPanMode,
    setViewport,
    shortcuts,
  ]);

  return {
    connectionPanShortcutLabel: formatShortcutList(shortcuts['connection.pan-mode']),
  };
}
