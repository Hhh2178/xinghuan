import { useCallback, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useRunBusStore } from '../../stores/runBus';
import { topologicalSort } from '../../utils/topologicalSort';

interface UseCanvasRuntimeArgs {
  nodes: Node[];
  edges: Edge[];
  executableNodeTypes: Set<string>;
}

export function useCanvasRuntime({
  nodes,
  edges,
  executableNodeTypes,
}: UseCanvasRuntimeArgs) {
  const [isRunning, setIsRunning] = useState(false);
  const cancelRunRef = useRef(false);
  const batchTotal = useRunBusStore((state) => state.batchTotal);
  const batchDone = useRunBusStore((state) => state.batchDoneCount);

  const runNodesByOrder = useCallback(
    async (subNodes: Node[], subEdges: Edge[]) => {
      const order = topologicalSort(subNodes, subEdges, executableNodeTypes);
      if (order.length === 0) return 0;
      cancelRunRef.current = false;
      setIsRunning(true);
      const { triggerRun, setBatchProgress, cancelAll } = useRunBusStore.getState();
      setBatchProgress(order.length, 0);
      try {
        for (let i = 0; i < order.length; i += 1) {
          if (cancelRunRef.current) break;
          const id = order[i];
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              unsub();
              window.clearTimeout(timer);
              resolve();
            };
            const unsub = useRunBusStore.subscribe((state) => {
              if (state.lastDone && state.lastDone.id === id) finish();
              if (cancelRunRef.current) finish();
            });
            const timer = window.setTimeout(finish, 60 * 60 * 1000);
            triggerRun(id, 'batch');
          });
          setBatchProgress(order.length, i + 1);
        }
      } finally {
        cancelAll();
        setIsRunning(false);
        cancelRunRef.current = false;
      }
      return order.length;
    },
    [executableNodeTypes],
  );

  const handleRunAll = useCallback(async () => {
    if (isRunning) return;
    const order = topologicalSort(nodes, edges, executableNodeTypes);
    if (order.length === 0) {
      alert('画布上没有可执行节点');
      return;
    }
    await runNodesByOrder(nodes, edges);
  }, [edges, executableNodeTypes, isRunning, nodes, runNodesByOrder]);

  const handleRunGroup = useCallback(
    async (ids: string[]) => {
      if (isRunning) return;
      const idSet = new Set(ids);
      const subNodes = nodes.filter((node) => idSet.has(node.id));
      const subEdges = edges.filter((edge) => idSet.has(edge.source) && idSet.has(edge.target));
      const executable = subNodes.filter((node) => node.type && executableNodeTypes.has(node.type));
      if (executable.length === 0) {
        alert('所选节点中没有可执行节点');
        return;
      }
      await runNodesByOrder(subNodes, subEdges);
    },
    [edges, executableNodeTypes, isRunning, nodes, runNodesByOrder],
  );

  const handleCancelRun = useCallback(() => {
    cancelRunRef.current = true;
    useRunBusStore.getState().cancelAll();
  }, []);

  return {
    batchDone,
    batchTotal,
    handleCancelRun,
    handleRunAll,
    handleRunGroup,
    isRunning,
  };
}
