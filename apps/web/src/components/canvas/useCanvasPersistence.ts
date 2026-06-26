import { useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Edge, Node, Viewport } from '@xyflow/react';
import { normalizeCanvasNodeSerials } from '../../utils/nodeSerialIds';
import { migrateImportedNodes } from '../../utils/nodeMigration';
import { useCanvasStore } from '../../stores/canvas';
import { logBus } from '../../stores/logs';
import * as api from '../../services/api';

interface PendingCanvasSave {
  nodes: Node[];
  edges: Edge[];
  snapshot: string;
  nextNodeSerialId: number;
}

interface PendingSendFocus {
  canvasId: string;
  center: { x: number; y: number };
  zoom: number;
}

interface UseCanvasPersistenceArgs {
  activeId: string | null;
  nodes: Node[];
  edges: Edge[];
  loaded: boolean;
  loadedCanvasId: string | null;
  bulkPhantomId: string;
  histReset: (snapshot?: { nodes: Node[]; edges: Edge[] }) => void;
  scheduleCapture: (snapshot: { nodes: Node[]; edges: Edge[] }) => void;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setLoaded: Dispatch<SetStateAction<boolean>>;
  setLoadedCanvasId: Dispatch<SetStateAction<string | null>>;
  nextNodeSerialIdRef: MutableRefObject<number>;
  allowEmptySaveCanvasIdsRef: MutableRefObject<Set<string>>;
  altDragCloneRef: MutableRefObject<{
    placeholderIds: Map<string, string>;
  } | null>;
  setCenter: (
    x: number,
    y: number,
    options?: {
      zoom?: number;
      duration?: number;
    },
  ) => void;
  getViewport: () => Viewport;
  isCanvasRevisionConflictError: (error: unknown) => boolean;
}

interface UseCanvasPersistenceResult {
  pendingSendFocusRef: MutableRefObject<PendingSendFocus | null>;
}

export function useCanvasPersistence({
  activeId,
  nodes,
  edges,
  loaded,
  loadedCanvasId,
  bulkPhantomId,
  histReset,
  scheduleCapture,
  setNodes,
  setEdges,
  setLoaded,
  setLoadedCanvasId,
  nextNodeSerialIdRef,
  allowEmptySaveCanvasIdsRef,
  altDragCloneRef,
  setCenter,
  getViewport,
  isCanvasRevisionConflictError,
}: UseCanvasPersistenceArgs): UseCanvasPersistenceResult {
  const saveTimersByCanvasRef = useRef<Map<string, number>>(new Map());
  const pendingSaveByCanvasRef = useRef<Map<string, PendingCanvasSave>>(new Map());
  const lastSavedByCanvasRef = useRef<Map<string, string>>(new Map());
  const revisionByCanvasRef = useRef<Map<string, number>>(new Map());
  const saveConflictCanvasIdsRef = useRef<Set<string>>(new Set());
  const pendingSendFocusRef = useRef<PendingSendFocus | null>(null);
  const pendingSendFocusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeId) {
      nextNodeSerialIdRef.current = 1;
      setNodes([]);
      setEdges([]);
      setLoaded(false);
      setLoadedCanvasId(null);
      histReset();
      return;
    }
    const requestedCanvasId = activeId;
    setLoaded(false);
    setLoadedCanvasId(null);
    let cancelled = false;
    api
      .getCanvasData(requestedCanvasId)
      .then((data) => {
        if (cancelled || useCanvasStore.getState().activeId !== requestedCanvasId) return;
        const pendingSave = pendingSaveByCanvasRef.current.get(requestedCanvasId);
        const ns = pendingSave?.nodes || data.nodes || [];
        const es = pendingSave?.edges || data.edges || [];
        const savedNextNodeSerialId = pendingSave?.nextNodeSerialId ?? data.nextNodeSerialId;
        const migratedNodes = migrateImportedNodes(ns as Node[]);
        const fixedNsBeforeSerials = migratedNodes.map((node: any) =>
          node.type === 'groupBox' && node.connectable === false ? { ...node, connectable: true } : node,
        );
        const normalized = normalizeCanvasNodeSerials(fixedNsBeforeSerials, savedNextNodeSerialId);
        nextNodeSerialIdRef.current = normalized.nextNodeSerialId;
        const fixedNs = normalized.nodes;
        setNodes(fixedNs);
        setEdges(es);
        const loadedSnapshot = JSON.stringify({
          nodes: fixedNsBeforeSerials,
          edges: es,
          nextNodeSerialId: savedNextNodeSerialId || 1,
        });
        const normalizedSnapshot = JSON.stringify({
          nodes: fixedNs,
          edges: es,
          nextNodeSerialId: normalized.nextNodeSerialId,
        });
        lastSavedByCanvasRef.current.set(
          requestedCanvasId,
          normalized.changed || normalizedSnapshot !== loadedSnapshot ? loadedSnapshot : normalizedSnapshot,
        );
        revisionByCanvasRef.current.set(requestedCanvasId, Math.max(1, Number(data.revision) || 1));
        saveConflictCanvasIdsRef.current.delete(requestedCanvasId);
        allowEmptySaveCanvasIdsRef.current.delete(requestedCanvasId);
        histReset({ nodes: fixedNs, edges: es });
        setLoadedCanvasId(requestedCanvasId);
        setLoaded(true);
      })
      .catch((error) => {
        if (cancelled || useCanvasStore.getState().activeId !== requestedCanvasId) return;
        console.error('加载画布失败', error);
        nextNodeSerialIdRef.current = 1;
        setNodes([]);
        setEdges([]);
        histReset();
        saveConflictCanvasIdsRef.current.delete(requestedCanvasId);
        setLoadedCanvasId(requestedCanvasId);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeId,
    allowEmptySaveCanvasIdsRef,
    histReset,
    nextNodeSerialIdRef,
    setEdges,
    setLoaded,
    setLoadedCanvasId,
    setNodes,
  ]);

  useEffect(() => {
    return () => {
      for (const timer of saveTimersByCanvasRef.current.values()) {
        window.clearTimeout(timer);
      }
      saveTimersByCanvasRef.current.clear();
      pendingSaveByCanvasRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!activeId || !loaded || loadedCanvasId !== activeId) return;
    const pending = pendingSendFocusRef.current;
    if (!pending || pending.canvasId !== activeId) return;
    pendingSendFocusRef.current = null;
    if (pendingSendFocusTimerRef.current) window.clearTimeout(pendingSendFocusTimerRef.current);
    pendingSendFocusTimerRef.current = window.setTimeout(() => {
      setCenter(pending.center.x, pending.center.y, {
        zoom: pending.zoom,
        duration: 520,
      });
      pendingSendFocusTimerRef.current = null;
    }, 90);
  }, [activeId, loaded, loadedCanvasId, nodes.length, setCenter]);

  useEffect(() => {
    return () => {
      if (pendingSendFocusTimerRef.current) window.clearTimeout(pendingSendFocusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeId || !loaded || loadedCanvasId !== activeId) return;
    if (altDragCloneRef.current) return;
    const hasTransientAltClone = nodes.some(
      (node) => node.id === bulkPhantomId || String(node.id || '').startsWith('_alt-ph-'),
    );
    if (hasTransientAltClone) return;
    const normalized = normalizeCanvasNodeSerials(nodes, nextNodeSerialIdRef.current);
    nextNodeSerialIdRef.current = Math.max(nextNodeSerialIdRef.current, normalized.nextNodeSerialId);
    if (normalized.changed) {
      setNodes(normalized.nodes);
    }
  }, [activeId, altDragCloneRef, bulkPhantomId, loaded, loadedCanvasId, nextNodeSerialIdRef, nodes, setNodes]);

  useEffect(() => {
    if (!loaded || loadedCanvasId !== activeId) return;
    scheduleCapture({ nodes, edges });
  }, [activeId, edges, loaded, loadedCanvasId, nodes, scheduleCapture]);

  useEffect(() => {
    if (!activeId || !loaded || loadedCanvasId !== activeId) return;
    const persistNodes = nodes.filter((node) => node.id !== bulkPhantomId);
    const persistEdges = edges.filter(
      (edge) => edge.source !== bulkPhantomId && edge.target !== bulkPhantomId,
    );
    const nextNodeSerialId = nextNodeSerialIdRef.current;
    const snapshot = JSON.stringify({ nodes: persistNodes, edges: persistEdges, nextNodeSerialId });
    const canvasIdForSave = activeId;
    if (saveConflictCanvasIdsRef.current.has(canvasIdForSave)) return;
    const previousSnapshot = lastSavedByCanvasRef.current.get(canvasIdForSave) || '';
    if (snapshot === previousSnapshot) return;
    let previousNodeCount = 0;
    try {
      previousNodeCount = JSON.parse(previousSnapshot || '{}')?.nodes?.length || 0;
    } catch {
      previousNodeCount = 0;
    }
    const allowEmptySave = allowEmptySaveCanvasIdsRef.current.has(canvasIdForSave);
    if (persistNodes.length === 0 && previousNodeCount > 0 && !allowEmptySave) {
      return;
    }
    const previousTimer = saveTimersByCanvasRef.current.get(canvasIdForSave);
    if (previousTimer) window.clearTimeout(previousTimer);
    pendingSaveByCanvasRef.current.set(canvasIdForSave, {
      nodes: persistNodes,
      edges: persistEdges,
      nextNodeSerialId,
      snapshot,
    });
    const timer = window.setTimeout(async () => {
      const currentRevision = Math.max(1, revisionByCanvasRef.current.get(canvasIdForSave) || 1);
      const payload = {
        nodes: persistNodes,
        edges: persistEdges,
        viewport: getViewport(),
        revision: currentRevision,
        nextNodeSerialId,
      };
      try {
        const saved = await api.saveCanvasData(canvasIdForSave, payload, { allowEmpty: allowEmptySave });
        const nextRevision = Math.max(currentRevision, Number(saved.revision) || currentRevision);
        revisionByCanvasRef.current.set(canvasIdForSave, nextRevision);
        saveConflictCanvasIdsRef.current.delete(canvasIdForSave);
        api.autoSaveCanvasData(canvasIdForSave, { ...payload, revision: nextRevision }).catch((error) => {
          console.warn('画布自动保存到本地路径失败', error);
        });
        if (allowEmptySave) allowEmptySaveCanvasIdsRef.current.delete(canvasIdForSave);
        lastSavedByCanvasRef.current.set(canvasIdForSave, snapshot);
        if (pendingSaveByCanvasRef.current.get(canvasIdForSave)?.snapshot === snapshot) {
          pendingSaveByCanvasRef.current.delete(canvasIdForSave);
        }
        useCanvasStore.setState((state) => ({
          canvases: state.canvases.map((canvas) =>
            canvas.id === canvasIdForSave ? { ...canvas, nodeCount: persistNodes.length, updatedAt: Date.now() } : canvas,
          ),
        }));
      } catch (error) {
        if (isCanvasRevisionConflictError(error)) {
          saveConflictCanvasIdsRef.current.add(canvasIdForSave);
          pendingSaveByCanvasRef.current.delete(canvasIdForSave);
          logBus.warn('当前画布已在其他标签页或设备更新，请刷新后再继续编辑', '画布冲突');
          return;
        }
        console.error('保存画布失败', error);
      } finally {
        if (saveTimersByCanvasRef.current.get(canvasIdForSave) === timer) {
          saveTimersByCanvasRef.current.delete(canvasIdForSave);
        }
      }
    }, 800);
    saveTimersByCanvasRef.current.set(canvasIdForSave, timer);
  }, [
    activeId,
    allowEmptySaveCanvasIdsRef,
    bulkPhantomId,
    edges,
    getViewport,
    isCanvasRevisionConflictError,
    loaded,
    loadedCanvasId,
    nextNodeSerialIdRef,
    nodes,
  ]);

  return {
    pendingSendFocusRef,
  };
}
