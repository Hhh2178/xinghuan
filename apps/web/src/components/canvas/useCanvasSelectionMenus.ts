import { useCallback, useRef, useState, type Dispatch, type MouseEvent as ReactMouseEvent, type RefObject, type SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';

export interface CanvasContextMenuState {
  x: number;
  y: number;
  ids: string[];
}

export interface CanvasPaneMenuState {
  x: number;
  y: number;
}

interface UseCanvasSelectionMenusArgs {
  bulkPhantomId: string;
  nodesRef: RefObject<Node[]>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
}

export function useCanvasSelectionMenus({
  bulkPhantomId,
  nodesRef,
  setNodes,
}: UseCanvasSelectionMenusArgs) {
  const [contextMenu, setContextMenu] = useState<CanvasContextMenuState | null>(null);
  const [paneMenu, setPaneMenu] = useState<CanvasPaneMenuState | null>(null);
  const lastSelectedIdsRef = useRef<string[]>([]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const closePaneMenu = useCallback(() => setPaneMenu(null), []);

  const openNodeContextMenuAt = useCallback(
    (clientX: number, clientY: number, nodeId: string) => {
      const currentNodes = nodesRef.current || [];
      let ids: string[];
      const currentSelected = currentNodes.filter((node) => node.selected).map((node) => node.id);
      if (currentSelected.includes(nodeId) && currentSelected.length > 1) {
        ids = currentSelected;
      } else {
        setNodes((prev) => prev.map((node) => ({ ...node, selected: node.id === nodeId })));
        ids = [nodeId];
      }
      setPaneMenu(null);
      setContextMenu({ x: clientX, y: clientY, ids });
    },
    [nodesRef, setNodes],
  );

  const onSelectionContextMenu = useCallback((event: ReactMouseEvent, selections: Node[]) => {
    event.preventDefault();
    const ids = selections.map((node) => node.id);
    if (ids.length === 0) return;
    setContextMenu({ x: event.clientX, y: event.clientY, ids });
  }, []);

  const onNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      event.preventDefault();
      openNodeContextMenuAt(event.clientX, event.clientY, node.id);
    },
    [openNodeContextMenuAt],
  );

  const onCanvasContextMenuCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      if (target.closest('[data-resource-context-menu]')) return;
      if (target.closest('[data-drag-source]')) return;
      const nodeEl = target.closest('.react-flow__node') as HTMLElement | null;
      const nodeId = nodeEl?.getAttribute('data-id') || '';
      if (!nodeId || nodeId === bulkPhantomId) return;
      if (!(nodesRef.current || []).some((node) => node.id === nodeId)) return;
      event.preventDefault();
      event.stopPropagation();
      openNodeContextMenuAt(event.clientX, event.clientY, nodeId);
    },
    [bulkPhantomId, nodesRef, openNodeContextMenuAt],
  );

  const onPaneContextMenu = useCallback((event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault();
    setContextMenu(null);
    const x = (event as MouseEvent).clientX;
    const y = (event as MouseEvent).clientY;
    setPaneMenu({ x, y });
  }, []);

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[]; edges: Edge[] }) => {
    lastSelectedIdsRef.current = nodes.map((node) => node.id);
  }, []);

  const onSelectionEnd = useCallback((event: ReactMouseEvent) => {
    const ids = lastSelectedIdsRef.current;
    if (!ids || ids.length < 2) return;
    const x = (event as ReactMouseEvent & { clientX?: number }).clientX ?? 0;
    const y = (event as ReactMouseEvent & { clientY?: number }).clientY ?? 0;
    if (!x && !y) return;
    setContextMenu({ x, y, ids });
  }, []);

  return {
    closeContextMenu,
    closePaneMenu,
    contextMenu,
    onCanvasContextMenuCapture,
    onNodeContextMenu,
    onPaneContextMenu,
    onSelectionChange,
    onSelectionContextMenu,
    onSelectionEnd,
    paneMenu,
  };
}
