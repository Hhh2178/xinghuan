import { useCallback, type MutableRefObject } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { findNodeBySerialId, parseNodeSerialInput } from '../../utils/nodeSerialIds';
import { rectOf } from '../../utils/nodePlacement';
import { logBus } from '../../stores/logs';
import { matchesAnyShortcut, type ShortcutMap } from '../../utils/keyboardShortcuts';

interface UseCanvasViewportHotkeysArgs {
  activeId: string | null;
  loaded: boolean;
  loadedCanvasId: string | null;
  nodes: Node[];
  nodesRef: MutableRefObject<Node[]>;
  selectedCount: number;
  bulkPhantomId: string;
  shortcuts: ShortcutMap;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  getViewport: () => { zoom: number };
  setCenter: (x: number, y: number, options?: { zoom?: number; duration?: number }) => void;
  fitView: (options?: { padding?: number; duration?: number; minZoom?: number; maxZoom?: number }) => void;
  isShortcutBlocked: (target: EventTarget | null) => boolean;
}

function findNearestNavigableNode(
  nodes: Node[],
  center: { x: number; y: number },
  bulkPhantomId: string,
): Node | null {
  const valid = (node: Node, includeGroups: boolean) => {
    if (!node.id || node.id === bulkPhantomId) return false;
    if ((node as any).hidden) return false;
    if (!includeGroups && node.type === 'groupBox') return false;
    return true;
  };
  const candidates = nodes.filter((node) => valid(node, false));
  const fallbackCandidates = candidates.length > 0 ? candidates : nodes.filter((node) => valid(node, true));
  let best: Node | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  fallbackCandidates.forEach((node) => {
    const rect = rectOf(node);
    const nodeCenter = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    const dx = nodeCenter.x - center.x;
    const dy = nodeCenter.y - center.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  });
  return best;
}

function pulseNearestNode(nodeId: string) {
  window.setTimeout(() => {
    const css = (window as any).CSS;
    const safeId = typeof css?.escape === 'function'
      ? css.escape(nodeId)
      : nodeId.replace(/["\\]/g, '\\$&');
    const el = document.querySelector(`.react-flow__node[data-id="${safeId}"]`) as HTMLElement | null;
    if (!el) return;
    el.classList.remove('t8-nearest-node-pulse');
    void el.offsetWidth;
    el.classList.add('t8-nearest-node-pulse');
    window.setTimeout(() => el.classList.remove('t8-nearest-node-pulse'), 1300);
  }, 460);
}

export function useCanvasViewportHotkeys({
  activeId,
  loaded,
  loadedCanvasId,
  nodes,
  nodesRef,
  selectedCount,
  bulkPhantomId,
  shortcuts,
  screenToFlowPosition,
  getViewport,
  setCenter,
  fitView,
  isShortcutBlocked,
}: UseCanvasViewportHotkeysArgs) {
  const focusNearestNodeToViewport = useCallback(() => {
    if (!loaded || loadedCanvasId !== activeId) return;
    const flowEl = document.querySelector('.react-flow') as HTMLElement | null;
    if (!flowEl) return;
    const bounds = flowEl.getBoundingClientRect();
    const viewportCenter = screenToFlowPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    });
    const nearest = findNearestNavigableNode(nodes, viewportCenter, bulkPhantomId);
    if (!nearest) {
      logBus.warn('当前画布没有可定位节点', '快捷键 G');
      return;
    }
    const rect = rectOf(nearest);
    const currentZoom = getViewport().zoom || 1;
    const zoom = Math.min(Math.max(currentZoom, 0.55), 1.15);
    setCenter(rect.x + rect.w / 2, rect.y + rect.h / 2, { zoom, duration: 450 });
    pulseNearestNode(nearest.id);
  }, [activeId, bulkPhantomId, getViewport, loaded, loadedCanvasId, nodes, screenToFlowPosition, setCenter]);

  const focusNodeBySerialId = useCallback(() => {
    if (!loaded || loadedCanvasId !== activeId) return;
    const raw = window.prompt('输入要查找的 NodeID');
    if (raw === null) return;
    const serialId = parseNodeSerialInput(raw);
    if (!serialId) {
      logBus.warn('请输入有效的 NodeID 数字', '查找 NodeID');
      return;
    }
    const target = findNodeBySerialId(nodesRef.current, serialId);
    if (!target) {
      logBus.warn(`没有找到 NodeID #${serialId}`, '查找 NodeID');
      return;
    }
    const rect = rectOf(target);
    const currentZoom = getViewport().zoom || 1;
    const zoom = Math.min(Math.max(currentZoom, 0.55), 1.15);
    setCenter(rect.x + rect.w / 2, rect.y + rect.h / 2, { zoom, duration: 450 });
    pulseNearestNode(target.id);
  }, [activeId, getViewport, loaded, loadedCanvasId, nodesRef, setCenter]);

  const handleViewportHotkeys = useCallback((event: KeyboardEvent) => {
    const isOverviewShortcut = matchesAnyShortcut(shortcuts['canvas.overview'], event);
    const isNearestShortcut = matchesAnyShortcut(shortcuts['canvas.nearest-node'], event);
    if (!isOverviewShortcut && !isNearestShortcut) return false;
    if (isNearestShortcut && selectedCount > 0) return false;
    const activeEl = document.activeElement as HTMLElement | null;
    if (
      isShortcutBlocked(event.target) ||
      isShortcutBlocked(activeEl) ||
      document.querySelector(
        [
          '[data-canvas-floating-ui="image-compare-modal"]',
          '[data-canvas-floating-ui="portrait-master-editor"]',
          '[data-canvas-floating-ui="send-materials-modal"]',
          '[data-canvas-floating-ui="picker-menu"]',
          '[data-canvas-floating-ui="node-menu"]',
          '[data-canvas-floating-ui="pane-menu"]',
        ].join(','),
      )
    ) {
      return false;
    }
    event.preventDefault();
    if (isNearestShortcut) {
      focusNearestNodeToViewport();
      return true;
    }
    fitView({ padding: 0.18, duration: 420, minZoom: 0.05, maxZoom: 1.15 });
    return true;
  }, [fitView, focusNearestNodeToViewport, isShortcutBlocked, selectedCount, shortcuts]);

  return {
    focusNearestNodeToViewport,
    focusNodeBySerialId,
    handleViewportHotkeys,
  };
}
