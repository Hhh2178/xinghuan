import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';
import * as api from '../../services/api';
import { useCanvasStore } from '../../stores/canvas';
import { isCanvasNodeDeleted } from '../../utils/deletedNodeRegistry';
import { createAnimationFrameBatch, patchNodeData } from '../canvas/canvas-node-mutations';

const offscreenPatchQueues = new Map<string, Promise<void>>();

function enqueueOffscreenCanvasPatch(
  canvasId: string,
  nodeId: string,
  patch: Record<string, any>,
) {
  const key = `${canvasId}::${nodeId}`;
  const prev = offscreenPatchQueues.get(key) || Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(async () => {
      if (isCanvasNodeDeleted(canvasId, nodeId)) return;
      const data = await api.getCanvasData(canvasId);
      if (isCanvasNodeDeleted(canvasId, nodeId)) return;
      let found = false;
      const nodes = (Array.isArray(data.nodes) ? data.nodes : []).map((node: any) => {
        if (node?.id !== nodeId) return node;
        found = true;
        return {
          ...node,
          data: {
            ...(node.data || {}),
            ...patch,
          },
        };
      });
      if (!found) return;
      const payload = {
        nodes,
        edges: Array.isArray(data.edges) ? data.edges : [],
        workflows: Array.isArray(data.workflows) ? data.workflows : [],
        viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
      };
      await api.saveCanvasData(canvasId, payload);
      api.autoSaveCanvasData(canvasId, payload).catch((e) => {
        console.warn('离屏画布自动保存到本地路径失败', e);
      });
    });
  const queued = next.finally(() => {
    if (offscreenPatchQueues.get(key) === queued) {
      offscreenPatchQueues.delete(key);
    }
  });
  offscreenPatchQueues.set(key, queued);
}

/**
 * 用于在节点内部更新自身 data 的 hook
 * 通过 reactflow 的 setNodes 接口更新指定 id 的节点
 * 如果节点运行期间用户切换到其他画布，则按节点挂载时的画布 id
 * 直接补写对应画布 JSON，避免异步生成结果丢到当前画布之外。
 */
export function useUpdateNodeData(nodeId: string) {
  const { setNodes } = useReactFlow();
  const originCanvasIdRef = useRef(useCanvasStore.getState().activeId);
  const activePatchBatchRef = useRef<ReturnType<typeof createAnimationFrameBatch<Record<string, any>>> | null>(null);
  if (!activePatchBatchRef.current) {
    activePatchBatchRef.current = createAnimationFrameBatch((patches) => {
      const merged = patches.reduce<Record<string, any>>((result, patch) => ({ ...result, ...patch }), {});
      setNodes((nds) => patchNodeData(nds, nodeId, merged));
    });
  }
  useEffect(() => () => activePatchBatchRef.current?.dispose(), []);

  return useCallback(
    (patch: Record<string, any>) => {
      const originCanvasId = originCanvasIdRef.current;
      const activeCanvasId = useCanvasStore.getState().activeId;
      const queueKey = originCanvasId ? `${originCanvasId}::${nodeId}` : '';
      const hasPendingOffscreenPatch = queueKey ? offscreenPatchQueues.has(queueKey) : false;
      if (originCanvasId && (activeCanvasId !== originCanvasId || hasPendingOffscreenPatch)) {
        enqueueOffscreenCanvasPatch(originCanvasId, nodeId, patch);
        if (activeCanvasId !== originCanvasId) return;
      }
      activePatchBatchRef.current?.enqueue(patch);
    },
    [nodeId, setNodes]
  );
}
