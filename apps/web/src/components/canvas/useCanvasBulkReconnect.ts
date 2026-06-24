import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';
import {
  getNodeInputs,
  getNodeOutputs,
  PORT_COLOR,
} from '../../config/portTypes';

interface BulkReconnectState {
  fromNodeId: string;
  handleType: 'source' | 'target';
  edges: Edge[];
}

interface UseCanvasBulkReconnectArgs {
  bulkPhantomId: string;
  edges: Edge[];
  edgesRef: RefObject<Edge[]>;
  nodesRef: RefObject<Node[]>;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
}

function detectHandleType(element: HTMLElement): 'source' | 'target' | null {
  const dataHandleType = element.getAttribute('data-handletype');
  if (dataHandleType === 'target' || dataHandleType === 'source') return dataHandleType;
  if (element.classList.contains('react-flow__handle-left')) return 'target';
  if (element.classList.contains('react-flow__handle-right')) return 'source';
  const position = element.getAttribute('data-handlepos');
  if (position === 'left' || position === 'top') return 'target';
  if (position === 'right' || position === 'bottom') return 'source';
  return null;
}

export function useCanvasBulkReconnect({
  bulkPhantomId,
  edges,
  edgesRef,
  nodesRef,
  screenToFlowPosition,
  setEdges,
  setNodes,
}: UseCanvasBulkReconnectArgs) {
  const bulkReconnectRef = useRef<BulkReconnectState | null>(null);

  const hasPendingBulkReconnect = useCallback(() => bulkReconnectRef.current !== null, []);

  const handleBulkReconnectConnectStart = useCallback((event: MouseEvent, params: { nodeId: string | null; handleType: 'source' | 'target' | null }) => {
    if (!params.nodeId || !params.handleType || !event.shiftKey) return;
    if (params.handleType === 'target') {
      const incoming = edges.filter((edge) => edge.target === params.nodeId);
      if (incoming.length > 0) {
        bulkReconnectRef.current = {
          fromNodeId: params.nodeId,
          handleType: 'target',
          edges: JSON.parse(JSON.stringify(incoming)),
        };
      }
      return;
    }
    const outgoing = edges.filter((edge) => edge.source === params.nodeId);
    if (outgoing.length > 0) {
      bulkReconnectRef.current = {
        fromNodeId: params.nodeId,
        handleType: 'source',
        edges: JSON.parse(JSON.stringify(outgoing)),
      };
    }
  }, [edges]);

  const handleBulkReconnectConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    if (!bulkReconnectRef.current) return false;
    const bulk = bulkReconnectRef.current;
    bulkReconnectRef.current = null;

    const targetEl = event.target as HTMLElement | null;
    if (!targetEl) return true;
    const handleEl = targetEl.closest('.react-flow__handle') as HTMLElement | null;
    if (!handleEl) return true;

    const newNodeId =
      handleEl.getAttribute('data-nodeid')
      || handleEl.closest('.react-flow__node')?.getAttribute('data-id')
      || '';
    const dropHandleType = handleEl.getAttribute('data-handletype');
    if (!newNodeId || newNodeId === bulk.fromNodeId) return true;

    if (bulk.handleType === 'target' && dropHandleType === 'target') {
      const bulkIds = new Set(bulk.edges.map((edge) => edge.id));
      setEdges((prev) => {
        const filtered = prev.filter((edge) => !bulkIds.has(edge.id));
        const newTarget = (nodesRef.current || []).find((node) => node.id === newNodeId);
        const newEdges = bulk.edges.map((old) => {
          const sourceNode = (nodesRef.current || []).find((node) => node.id === old.source);
          const outs = sourceNode ? getNodeOutputs(sourceNode) : [];
          const ins = newTarget ? getNodeInputs(newTarget) : [];
          const matched = outs.find((port) => ins.includes(port) || port === 'any' || ins.includes('any'));
          const color = matched && matched !== 'any' ? PORT_COLOR[matched] : undefined;
          return {
            ...old,
            id: `e-${old.source}-${newNodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            target: newNodeId,
            targetHandle: null,
            ...(color ? { style: { stroke: color, strokeWidth: 2 } } : {}),
            data: { ...((old.data as any) || {}), portType: matched ?? 'any' },
          };
        });
        return [...filtered, ...newEdges];
      });
      return true;
    }

    if (bulk.handleType === 'source' && dropHandleType === 'source') {
      const bulkIds = new Set(bulk.edges.map((edge) => edge.id));
      setEdges((prev) => {
        const filtered = prev.filter((edge) => !bulkIds.has(edge.id));
        const newSource = (nodesRef.current || []).find((node) => node.id === newNodeId);
        const newEdges = bulk.edges.map((old) => {
          const targetNode = (nodesRef.current || []).find((node) => node.id === old.target);
          const outs = newSource ? getNodeOutputs(newSource) : [];
          const ins = targetNode ? getNodeInputs(targetNode) : [];
          const matched = outs.find((port) => ins.includes(port) || port === 'any' || ins.includes('any'));
          const color = matched && matched !== 'any' ? PORT_COLOR[matched] : undefined;
          return {
            ...old,
            id: `e-${newNodeId}-${old.target}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            source: newNodeId,
            sourceHandle: null,
            ...(color ? { style: { stroke: color, strokeWidth: 2 } } : {}),
            data: { ...((old.data as any) || {}), portType: matched ?? 'any' },
          };
        });
        return [...filtered, ...newEdges];
      });
      return true;
    }

    return true;
  }, [nodesRef, setEdges]);

  useEffect(() => {
    const onMouseDownCapture = (event: MouseEvent) => {
      if (!event.shiftKey || event.button !== 0) return;
      const targetEl = event.target as HTMLElement | null;
      if (!targetEl) return;
      const handleEl = targetEl.closest('.react-flow__handle') as HTMLElement | null;
      if (!handleEl) return;

      const nodeEl = handleEl.closest('.react-flow__node') as HTMLElement | null;
      const nodeId = handleEl.getAttribute('data-nodeid') || nodeEl?.getAttribute('data-id') || '';
      if (!nodeId) return;

      const handleType = detectHandleType(handleEl);
      if (!handleType) return;

      const relatedEdges =
        handleType === 'target'
          ? (edgesRef.current || []).filter((edge) => edge.target === nodeId)
          : (edgesRef.current || []).filter((edge) => edge.source === nodeId);
      if (relatedEdges.length === 0) return;

      event.stopPropagation();
      event.stopImmediatePropagation();
      event.preventDefault();

      const startNodeId = nodeId;
      const startHandleType = handleType;
      const stashed: Edge[] = JSON.parse(JSON.stringify(relatedEdges));
      const stashedIds = new Set(stashed.map((edge) => edge.id));
      const initFlowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      setNodes((prev) => {
        if (prev.some((node) => node.id === bulkPhantomId)) return prev;
        return [
          ...prev,
          {
            id: bulkPhantomId,
            type: 'bulkPhantom',
            position: initFlowPos,
            data: {},
            draggable: false,
            selectable: false,
            deletable: false,
            zIndex: 9999,
            style: { pointerEvents: 'none' },
          } as Node,
        ];
      });

      setEdges((prev) =>
        prev.map((edge) => {
          if (!stashedIds.has(edge.id)) return edge;
          if (startHandleType === 'target') {
            return { ...edge, target: bulkPhantomId, targetHandle: null };
          }
          return { ...edge, source: bulkPhantomId, sourceHandle: null };
        }),
      );

      document.body.classList.add('bulk-reconnecting');

      let lastHoverEl: HTMLElement | null = null;
      const setHoverHighlight = (element: HTMLElement | null) => {
        if (lastHoverEl && lastHoverEl !== element) {
          lastHoverEl.style.boxShadow = '';
          lastHoverEl.style.transform = '';
        }
        if (element && element !== lastHoverEl) {
          element.style.boxShadow = '0 0 0 4px rgba(34, 197, 94, 0.6)';
          element.style.transform = 'scale(1.4)';
        }
        lastHoverEl = element;
      };

      const cleanup = () => {
        window.removeEventListener('mouseup', onMouseUp, true);
        window.removeEventListener('mousemove', onMouseMove, true);
        window.removeEventListener('keydown', onKeyDown, true);
        document.body.classList.remove('bulk-reconnecting');
        setHoverHighlight(null);
        setNodes((prev) => prev.filter((node) => node.id !== bulkPhantomId));
      };

      const restoreOriginal = () => {
        const originalMap = new Map(stashed.map((edge) => [edge.id, edge]));
        setEdges((prev) =>
          prev.map((edge) => {
            const original = originalMap.get(edge.id);
            if (!original) return edge;
            return {
              ...edge,
              source: original.source,
              target: original.target,
              sourceHandle: original.sourceHandle,
              targetHandle: original.targetHandle,
            };
          }),
        );
      };

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== 'Escape') return;
        cleanup();
        restoreOriginal();
      };

      const findHandleAt = (clientX: number, clientY: number) => {
        const elements = document.elementsFromPoint(clientX, clientY);
        for (const element of elements) {
          const match = (element as Element).closest?.('.react-flow__handle') as HTMLElement | null;
          if (!match) continue;
          const wrap = match.closest('.react-flow__node') as HTMLElement | null;
          const nodeIdAtPoint = match.getAttribute('data-nodeid') || wrap?.getAttribute('data-id') || '';
          if (nodeIdAtPoint === bulkPhantomId) continue;
          return match;
        }
        return null;
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        const flowPos = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY });
        setNodes((prev) => prev.map((node) => (node.id === bulkPhantomId ? { ...node, position: flowPos } : node)));

        const hoverHandle = findHandleAt(moveEvent.clientX, moveEvent.clientY);
        if (hoverHandle) {
          const hoverNodeEl = hoverHandle.closest('.react-flow__node') as HTMLElement | null;
          const hoverNodeId = hoverHandle.getAttribute('data-nodeid') || hoverNodeEl?.getAttribute('data-id') || '';
          const hoverType = detectHandleType(hoverHandle);
          if (
            hoverNodeId
            && hoverNodeId !== startNodeId
            && hoverNodeId !== bulkPhantomId
            && hoverType === startHandleType
          ) {
            setHoverHighlight(hoverHandle);
            return;
          }
        }

        setHoverHighlight(null);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        let upHandleEl = (upEvent.target as HTMLElement | null)?.closest('.react-flow__handle') as HTMLElement | null;
        if (upHandleEl) {
          const wrap = upHandleEl.closest('.react-flow__node') as HTMLElement | null;
          const upNodeId = upHandleEl.getAttribute('data-nodeid') || wrap?.getAttribute('data-id') || '';
          if (upNodeId === bulkPhantomId) upHandleEl = null;
        }
        if (!upHandleEl) upHandleEl = findHandleAt(upEvent.clientX, upEvent.clientY);
        cleanup();

        if (!upHandleEl) {
          restoreOriginal();
          return;
        }

        const upNodeEl = upHandleEl.closest('.react-flow__node') as HTMLElement | null;
        const upNodeId = upHandleEl.getAttribute('data-nodeid') || upNodeEl?.getAttribute('data-id') || '';
        if (!upNodeId || upNodeId === startNodeId || upNodeId === bulkPhantomId) {
          restoreOriginal();
          return;
        }
        const upHandleType = detectHandleType(upHandleEl);
        if (upHandleType !== startHandleType) {
          restoreOriginal();
          return;
        }

        setEdges((prev) => {
          const filtered = prev.filter((edge) => !stashedIds.has(edge.id));
          const timestamp = Date.now();
          const newEdges: Edge[] = stashed.map((old) => {
            const sourceId = startHandleType === 'target' ? old.source : upNodeId;
            const targetId = startHandleType === 'target' ? upNodeId : old.target;
            const sourceNode = (nodesRef.current || []).find((node) => node.id === sourceId);
            const targetNode = (nodesRef.current || []).find((node) => node.id === targetId);
            const outs = sourceNode ? getNodeOutputs(sourceNode) : [];
            const ins = targetNode ? getNodeInputs(targetNode) : [];
            const matched = outs.find((port) => ins.includes(port) || port === 'any' || ins.includes('any'));
            const color = matched && matched !== 'any' ? PORT_COLOR[matched] : undefined;
            return {
              ...old,
              id: `e-${sourceId}-${targetId}-${timestamp}-${Math.random().toString(36).slice(2, 6)}`,
              source: sourceId,
              target: targetId,
              sourceHandle: startHandleType === 'target' ? old.sourceHandle : null,
              targetHandle: startHandleType === 'source' ? old.targetHandle : null,
              ...(color ? { style: { stroke: color, strokeWidth: 2 } } : {}),
              data: { ...((old.data as any) || {}), portType: matched ?? 'any' },
            };
          });
          return [...filtered, ...newEdges];
        });
      };

      window.addEventListener('mouseup', onMouseUp, true);
      window.addEventListener('mousemove', onMouseMove, true);
      window.addEventListener('keydown', onKeyDown, true);
    };

    window.addEventListener('mousedown', onMouseDownCapture, true);
    return () => {
      window.removeEventListener('mousedown', onMouseDownCapture, true);
      document.body.classList.remove('bulk-reconnecting');
    };
  }, [bulkPhantomId, edgesRef, nodesRef, screenToFlowPosition, setEdges, setNodes]);

  return {
    handleBulkReconnectConnectEnd,
    handleBulkReconnectConnectStart,
    hasPendingBulkReconnect,
  };
}
