import { useCallback, useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';

import { PORT_LABEL } from '../../config/portTypes';
import * as api from '../../services/api';
import * as sharedResourceApi from '../../services/sharedResourceApi';
import { logBus } from '../../stores/logs';
import { bucketSendableMaterials, collectSendableMaterialsFromNodes, sendableMaterialSignature, summarizeSendableMaterials, type SendTargetMode, type SendableMaterial } from '../../utils/sendMaterials';
import { buildSendNodeFragment, instantiateSendNodeFragment, summarizeSendNodeFragment, type InstantiatedSendNodeFragment, type SendNodeFragment } from '../../utils/sendNodeFragment';
import { assignFreshNodeSerials, normalizeCanvasNodeSerials } from '../../utils/nodeSerialIds';
import { chooseDefaultSendMode, resolveEffectiveSendMode } from '../../utils/sendMode';
import { createWorkflowResourceManifest } from '../../utils/workflowResource';
import type { MaterialSetKind } from '../../utils/materialSet';
import type { NodeType } from '../../types/canvas';

interface SendModalState {
  materials: SendableMaterial[];
  nodeFragment?: SendNodeFragment;
  sourceLabel: string;
  defaultMode: SendTargetMode;
  atScreen?: { x: number; y: number };
}

interface PendingSendFocusState {
  canvasId: string;
  center: { x: number; y: number };
  zoom: number;
}

interface InsertWorkflowOptions {
  atScreen?: { x: number; y: number };
  title?: string;
}

interface UseCanvasSendFlowArgs {
  activeId: string | null;
  bulkPhantomId: string;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  getViewport: () => { zoom: number };
  nodesRef: MutableRefObject<Node[]>;
  edgesRef: MutableRefObject<Edge[]>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  pendingSendFocusRef: MutableRefObject<PendingSendFocusState | null>;
  assignActiveNodeSerials: (incomingNodes: Node[], existingNodes?: Node[]) => Node[];
  loadCanvases: () => Promise<unknown> | unknown;
  setActive: (canvasId: string) => void;
  isCanvasRevisionConflictError: (error: unknown) => boolean;
  buildSendNodeSpecs: (
    materials: SendableMaterial[],
    mode: SendTargetMode,
  ) => Array<{ type: NodeType; data: Record<string, any> }>;
  basePositionForAppend: (existingNodes: Node[]) => { x: number; y: number };
  materialNodesFromSpecs: (
    specs: Array<{ type: NodeType; data: Record<string, any> }>,
    existingNodes: Node[],
    base: { x: number; y: number },
    bridge?: { signature: string; mode: SendTargetMode; sourceCanvasId?: string | null; sourceNodeIds?: string[] },
  ) => Node[];
  placeInstantiatedNodeFragment: (
    instance: InstantiatedSendNodeFragment,
    existingNodes: Node[],
  ) => InstantiatedSendNodeFragment;
  sourceNodeIdsFromMaterials: (materials: SendableMaterial[]) => string[];
  removeDuplicateSendBridgeNodes: (
    nodes: Node[],
    edges: Edge[],
    materials: SendableMaterial[],
    signature: string,
    sourceCanvasId?: string | null,
  ) => { nodes: Node[]; edges: Edge[]; removed: number };
  centerOfMaterialNodes: (nodes: Node[]) => { x: number; y: number } | null;
}

export function useCanvasSendFlow({
  activeId,
  bulkPhantomId,
  screenToFlowPosition,
  getViewport,
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  pendingSendFocusRef,
  assignActiveNodeSerials,
  loadCanvases,
  setActive,
  isCanvasRevisionConflictError,
  buildSendNodeSpecs,
  basePositionForAppend,
  materialNodesFromSpecs,
  placeInstantiatedNodeFragment,
  sourceNodeIdsFromMaterials,
  removeDuplicateSendBridgeNodes,
  centerOfMaterialNodes,
}: UseCanvasSendFlowArgs) {
  const [sendModal, setSendModal] = useState<SendModalState | null>(null);

  useEffect(() => {
    const onOpenSendMaterials = (event: Event) => {
      const detail = (event as CustomEvent<{
        materials?: SendableMaterial[];
        nodeFragment?: SendNodeFragment;
        sourceLabel?: string;
        defaultMode?: SendTargetMode;
        atScreen?: { x: number; y: number };
      }>).detail || {};
      const materials = Array.isArray(detail.materials) ? detail.materials : [];
      const nodeFragment = detail.nodeFragment?.nodes?.length ? detail.nodeFragment : undefined;
      if (materials.length === 0 && !nodeFragment) return;
      setSendModal({
        materials,
        nodeFragment,
        sourceLabel: detail.sourceLabel || '素材',
        defaultMode: detail.defaultMode || 'auto',
        atScreen: detail.atScreen,
      });
    };
    window.addEventListener('penguin:open-send-materials', onOpenSendMaterials);
    return () => window.removeEventListener('penguin:open-send-materials', onOpenSendMaterials);
  }, []);

  const openSendMaterials = useCallback(
    (ids: string[], atScreen?: { x: number; y: number }) => {
      const selectedNodes = nodesRef.current.filter((node) => ids.includes(node.id) && node.id !== bulkPhantomId);
      const materials = collectSendableMaterialsFromNodes(selectedNodes, activeId);
      const nodeFragment = buildSendNodeFragment(selectedNodes, edgesRef.current, activeId);
      if (materials.length === 0 && nodeFragment.nodes.length === 0) {
        logBus.warn('所选内容没有可发送的节点或素材', '发送');
        return;
      }
      const defaultMode = chooseDefaultSendMode({
        selectedNodeTypes: selectedNodes.map((node) => String(node.type || '')),
        nodeCount: nodeFragment.nodes.length,
        edgeCount: nodeFragment.edges.length,
        materialCount: materials.length,
      });
      setSendModal({
        materials,
        nodeFragment,
        sourceLabel: `选中 ${nodeFragment.nodes.length} 个节点${nodeFragment.edges.length > 0 ? ` · ${nodeFragment.edges.length} 条连线` : ''}`,
        defaultMode,
        atScreen,
      });
    },
    [activeId, bulkPhantomId, edgesRef, nodesRef],
  );

  const resolveSendMode = useCallback((mode: SendTargetMode): SendTargetMode => {
    return resolveEffectiveSendMode({
      requestedMode: mode,
      defaultMode: sendModal?.defaultMode || 'auto',
      nodeCount: sendModal?.nodeFragment?.nodes.length || 0,
      edgeCount: sendModal?.nodeFragment?.edges.length || 0,
      materialCount: sendModal?.materials.length || 0,
    });
  }, [sendModal?.defaultMode, sendModal?.materials.length, sendModal?.nodeFragment?.edges.length, sendModal?.nodeFragment?.nodes.length]);

  const basePositionForActiveSend = useCallback(() => {
    const atScreen = sendModal?.atScreen;
    if (atScreen) return screenToFlowPosition(atScreen);
    const flowEl = document.querySelector('.react-flow') as HTMLElement | null;
    const rect = flowEl?.getBoundingClientRect();
    return screenToFlowPosition(
      rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    );
  }, [screenToFlowPosition, sendModal?.atScreen]);

  const insertWorkflowFragment = useCallback(
    (fragment: SendNodeFragment, options: InsertWorkflowOptions = {}) => {
      if (!fragment?.nodes?.length) {
        logBus.warn('工作流资源没有可插入节点', '资源库');
        return;
      }
      const base = options.atScreen ? screenToFlowPosition(options.atScreen) : basePositionForActiveSend();
      const placedInstance = placeInstantiatedNodeFragment(
        instantiateSendNodeFragment(fragment, nodesRef.current, base),
        nodesRef.current,
      );
      const instance = {
        ...placedInstance,
        nodes: assignActiveNodeSerials(placedInstance.nodes, nodesRef.current),
      };
      const focusCenter = centerOfMaterialNodes(instance.nodes);
      if (activeId && focusCenter) {
        const { zoom } = getViewport();
        pendingSendFocusRef.current = {
          canvasId: activeId,
          center: focusCenter,
          zoom: Math.min(Math.max(zoom || 0.9, 0.72), 1.05),
        };
      }
      setEdges([...edgesRef.current.map((edge) => ({ ...edge, selected: false })), ...instance.edges]);
      setNodes([...nodesRef.current.map((node) => ({ ...node, selected: false })), ...instance.nodes]);
      logBus.success(`已插入 ${options.title || summarizeSendNodeFragment(fragment)}`, '资源库');
    },
    [
      activeId,
      assignActiveNodeSerials,
      basePositionForActiveSend,
      centerOfMaterialNodes,
      edgesRef,
      getViewport,
      nodesRef,
      pendingSendFocusRef,
      placeInstantiatedNodeFragment,
      screenToFlowPosition,
      setEdges,
      setNodes,
    ],
  );

  const handleSendMaterialsToCanvas = useCallback(
    async (targetCanvasId: string, mode: SendTargetMode, switchAfter: boolean) => {
      if (!sendModal) return;
      try {
        const currentSend = {
          ...sendModal,
          materials: sendModal.materials.map((item) => ({ ...item })),
        };
        const effectiveMode = resolveSendMode(mode);
        if (effectiveMode === 'node-fragment') {
          const fragment = currentSend.nodeFragment;
          if (!fragment || fragment.nodes.length === 0) {
            logBus.warn('没有可发送到画布的节点片段', '发送节点');
            return;
          }

          if (targetCanvasId === activeId) {
            const base = basePositionForActiveSend();
            const placedInstance = placeInstantiatedNodeFragment(
              instantiateSendNodeFragment(fragment, nodesRef.current, base),
              nodesRef.current,
            );
            const instance = {
              ...placedInstance,
              nodes: assignActiveNodeSerials(placedInstance.nodes, nodesRef.current),
            };
            const focusCenter = centerOfMaterialNodes(instance.nodes);
            if (activeId && focusCenter) {
              const { zoom } = getViewport();
              pendingSendFocusRef.current = {
                canvasId: activeId,
                center: focusCenter,
                zoom: Math.min(Math.max(zoom || 0.9, 0.72), 1.05),
              };
            }
            setEdges([...edgesRef.current.map((edge) => ({ ...edge, selected: false })), ...instance.edges]);
            setNodes([...nodesRef.current.map((node) => ({ ...node, selected: false })), ...instance.nodes]);
            setSendModal(null);
            logBus.success(`已发送 ${summarizeSendNodeFragment(fragment)} 到当前画布`, '发送节点');
            return;
          }

          const data = await api.getCanvasData(targetCanvasId);
          const targetNodesRaw = (Array.isArray(data.nodes) ? data.nodes : []) as Node[];
          const normalizedTarget = normalizeCanvasNodeSerials(targetNodesRaw, data.nextNodeSerialId);
          const targetNodes = normalizedTarget.nodes;
          const targetEdges = (Array.isArray(data.edges) ? data.edges : []) as Edge[];
          const placedInstance = placeInstantiatedNodeFragment(
            instantiateSendNodeFragment(fragment, targetNodes, basePositionForAppend(targetNodes)),
            targetNodes,
          );
          const freshSerials = assignFreshNodeSerials(placedInstance.nodes, targetNodes, normalizedTarget.nextNodeSerialId);
          const instance = { ...placedInstance, nodes: freshSerials.nodes };
          const focusCenter = centerOfMaterialNodes(instance.nodes);
          if (switchAfter && focusCenter) {
            pendingSendFocusRef.current = {
              canvasId: targetCanvasId,
              center: focusCenter,
              zoom: 0.88,
            };
          }
          const payload = {
            nodes: [...targetNodes, ...instance.nodes],
            edges: [...targetEdges, ...instance.edges],
            workflows: Array.isArray(data.workflows) ? data.workflows : [],
            viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
            revision: data.revision,
            nextNodeSerialId: freshSerials.nextNodeSerialId,
          };
          const saved = await api.saveCanvasData(targetCanvasId, payload);
          api.autoSaveCanvasData(targetCanvasId, { ...payload, revision: saved.revision ?? data.revision }).catch(() => {});
          await Promise.resolve(loadCanvases());
          if (switchAfter) setActive(targetCanvasId);
          setSendModal(null);
          logBus.success(`已发送 ${summarizeSendNodeFragment(fragment)} 到目标画布`, '发送节点');
          return;
        }

        if (currentSend.materials.length === 0) {
          logBus.warn('当前发送方式需要素材；请选择“节点片段”发送选中节点和连线', '发送素材');
          return;
        }
        const specs = buildSendNodeSpecs(currentSend.materials, effectiveMode);
        if (specs.length === 0) {
          logBus.warn('没有可发送到画布的素材', '发送素材');
          return;
        }
        const bridgeSignature = sendableMaterialSignature(currentSend.materials);
        const bridgeSourceNodeIds = sourceNodeIdsFromMaterials(currentSend.materials);

        if (targetCanvasId === activeId) {
          const base = basePositionForActiveSend();
          const cleaned = removeDuplicateSendBridgeNodes(
            nodesRef.current,
            edgesRef.current,
            currentSend.materials,
            bridgeSignature,
            activeId,
          );
          const newNodes = materialNodesFromSpecs(specs, cleaned.nodes, base, {
            signature: bridgeSignature,
            mode: effectiveMode,
            sourceCanvasId: activeId,
            sourceNodeIds: bridgeSourceNodeIds,
          });
          const assignedNewNodes = assignActiveNodeSerials(newNodes, cleaned.nodes);
          const focusCenter = centerOfMaterialNodes(assignedNewNodes);
          if (activeId && focusCenter) {
            const { zoom } = getViewport();
            pendingSendFocusRef.current = {
              canvasId: activeId,
              center: focusCenter,
              zoom: Math.min(Math.max(zoom || 0.9, 0.72), 1.05),
            };
          }
          setEdges(cleaned.edges);
          setNodes([...cleaned.nodes.map((node) => ({ ...node, selected: false })), ...assignedNewNodes]);
          setSendModal(null);
          logBus.success(
            `已发送 ${summarizeSendableMaterials(currentSend.materials)} 到当前画布${cleaned.removed ? `，已替换旧批次 ${cleaned.removed} 个节点` : ''}`,
            '发送素材',
          );
          return;
        }

        const data = await api.getCanvasData(targetCanvasId);
        const targetNodesRaw = Array.isArray(data.nodes) ? data.nodes : [];
        const normalizedTarget = normalizeCanvasNodeSerials(targetNodesRaw as Node[], data.nextNodeSerialId);
        const targetNodes = normalizedTarget.nodes;
        const targetEdges = Array.isArray(data.edges) ? data.edges : [];
        const cleaned = removeDuplicateSendBridgeNodes(
          targetNodes as Node[],
          targetEdges as Edge[],
          currentSend.materials,
          bridgeSignature,
          activeId,
        );
        const newNodes = materialNodesFromSpecs(specs, cleaned.nodes as Node[], basePositionForAppend(cleaned.nodes as Node[]), {
          signature: bridgeSignature,
          mode: effectiveMode,
          sourceCanvasId: activeId,
          sourceNodeIds: bridgeSourceNodeIds,
        });
        const freshSerials = assignFreshNodeSerials(newNodes, cleaned.nodes as Node[], normalizedTarget.nextNodeSerialId);
        const focusCenter = centerOfMaterialNodes(freshSerials.nodes);
        if (switchAfter && focusCenter) {
          pendingSendFocusRef.current = {
            canvasId: targetCanvasId,
            center: focusCenter,
            zoom: 0.88,
          };
        }
        const payload = {
          nodes: [...cleaned.nodes, ...freshSerials.nodes],
          edges: cleaned.edges,
          workflows: Array.isArray(data.workflows) ? data.workflows : [],
          viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
          revision: data.revision,
          nextNodeSerialId: freshSerials.nextNodeSerialId,
        };
        const saved = await api.saveCanvasData(targetCanvasId, payload);
        api.autoSaveCanvasData(targetCanvasId, { ...payload, revision: saved.revision ?? data.revision }).catch(() => {});
        await Promise.resolve(loadCanvases());
        if (switchAfter) setActive(targetCanvasId);
        setSendModal(null);
        logBus.success(
          `已发送 ${summarizeSendableMaterials(currentSend.materials)} 到目标画布${cleaned.removed ? `，已替换旧批次 ${cleaned.removed} 个节点` : ''}`,
          '发送素材',
        );
      } catch (error: any) {
        if (isCanvasRevisionConflictError(error)) {
          logBus.warn('目标画布已被其他标签页或设备更新，请先重新打开目标画布后再发送', '画布冲突');
          return;
        }
        logBus.warn(error?.message || '发送到画布失败', '发送');
      }
    },
    [
      activeId,
      assignActiveNodeSerials,
      basePositionForActiveSend,
      basePositionForAppend,
      buildSendNodeSpecs,
      centerOfMaterialNodes,
      edgesRef,
      getViewport,
      isCanvasRevisionConflictError,
      loadCanvases,
      materialNodesFromSpecs,
      nodesRef,
      pendingSendFocusRef,
      placeInstantiatedNodeFragment,
      removeDuplicateSendBridgeNodes,
      resolveSendMode,
      sendModal,
      setActive,
      setEdges,
      setNodes,
      sourceNodeIdsFromMaterials,
    ],
  );

  const saveWorkflowFragmentToResource = useCallback(
    async (fragment: SendNodeFragment | undefined, defaultTitle = '未命名工作流') => {
      if (!fragment?.nodes?.length) {
        logBus.warn('至少选择 1 个节点才能保存工作流', '资源库');
        return false;
      }
      const title = window.prompt('工作流名称', defaultTitle);
      if (!title?.trim()) return false;
      try {
        const manifest = createWorkflowResourceManifest(fragment, { title: title.trim() });
        const result = await api.addResourceWorkflow({
          workflowFragment: manifest,
          title: manifest.title,
          tags: ['工作流'],
          sourceCanvasId: activeId || fragment.sourceCanvasId,
        });
        if (!result.success) throw new Error(result.error || '保存工作流失败');
        window.dispatchEvent(new CustomEvent('penguin:resources-changed'));
        const duplicate = Boolean((result as any).duplicate || (result.data as any)?.duplicate);
        logBus.success(duplicate ? `资源库已有相同工作流：${manifest.title}` : `已保存工作流：${manifest.title}`, '资源库');
        return true;
      } catch (error: any) {
        logBus.warn(error?.message || '保存工作流失败', '资源库');
        return false;
      }
    },
    [activeId],
  );

  const saveWorkflowFragmentToSharedResource = useCallback(
    async (fragment: SendNodeFragment | undefined, defaultTitle = '未命名公共工作流') => {
      if (!fragment?.nodes?.length) {
        logBus.warn('至少选择 1 个节点才能保存公共工作流', '公共资源库');
        return false;
      }
      const title = window.prompt('公共工作流名称', defaultTitle);
      if (!title?.trim()) return false;
      try {
        const manifest = createWorkflowResourceManifest(fragment, { title: title.trim() });
        const result = await sharedResourceApi.addSharedResourceWorkflow({
          workflowFragment: manifest,
          title: manifest.title,
          tags: ['公共工作流'],
          sourceCanvasId: activeId || fragment.sourceCanvasId,
        });
        if (!result.success) throw new Error(result.error || '保存公共工作流失败');
        window.dispatchEvent(new CustomEvent('penguin:resources-changed'));
        const duplicate = Boolean((result as any).duplicate || (result.data as any)?.duplicate);
        logBus.success(duplicate ? `公共资源库已有相同工作流：${manifest.title}` : `已保存到公共资源库：${manifest.title}`, '公共资源库');
        return true;
      } catch (error: any) {
        logBus.warn(error?.message || '保存公共工作流失败', '公共资源库');
        return false;
      }
    },
    [activeId],
  );

  const handleSaveSendMaterialsToResource = useCallback(async (mode?: SendTargetMode) => {
    if (!sendModal) return;
    const effectiveMode = resolveSendMode(mode || sendModal.defaultMode || 'auto');
    if (effectiveMode === 'node-fragment') {
      const fallbackTitle = sendModal.nodeFragment?.nodes.length
        ? `${sendModal.nodeFragment.nodes.length}节点工作流`
        : '未命名工作流';
      await saveWorkflowFragmentToResource(sendModal.nodeFragment, fallbackTitle);
      return;
    }
    if (sendModal.materials.length === 0) return;
    const buckets = bucketSendableMaterials(sendModal.materials);
    let saved = 0;
    const failures: string[] = [];
    for (const kind of ['image', 'video', 'audio', 'text'] as MaterialSetKind[]) {
      const items = buckets[kind];
      if (items.length === 0) continue;
      if (kind !== 'text' && items.length === 1 && items[0].url) {
        const result = await api.addResourceItem({
          kind: kind as api.ResourceMediaKind,
          url: items[0].url,
          title: items[0].name || `${PORT_LABEL[kind]}素材`,
          tags: ['跨画布发送'],
          sourceNodeId: items[0].sourceNodeId,
          sourceCanvasId: items[0].sourceCanvasId || activeId || undefined,
        });
        if (result.success) saved += 1;
        else failures.push(result.error || `${PORT_LABEL[kind]}入库失败`);
        continue;
      }
      const result = await api.addResourceSet({
        materialSetKind: kind,
        materialSetItems: items,
        title: `${PORT_LABEL[kind]}素材集 · ${items.length}项`,
        tags: ['跨画布发送'],
        sourceNodeId: items[0]?.sourceNodeId,
        sourceCanvasId: items[0]?.sourceCanvasId || activeId || undefined,
      });
      if (result.success) saved += 1;
      else failures.push(result.error || `${PORT_LABEL[kind]}素材集入库失败`);
    }
    window.dispatchEvent(new CustomEvent('penguin:resources-changed'));
    if (saved > 0) logBus.success(`已保存 ${saved} 项到资源库`, '发送素材');
    if (failures.length > 0) logBus.warn(failures.slice(0, 2).join('；'), '发送素材');
  }, [activeId, resolveSendMode, saveWorkflowFragmentToResource, sendModal]);

  const handleSendMaterialsToEagle = useCallback(async () => {
    if (!sendModal || sendModal.materials.length === 0) return;
    const result = await api.sendToEagle({
      materials: sendModal.materials.map((item) => ({
        id: item.id,
        kind: item.kind,
        url: item.url,
        text: item.text,
        name: item.name,
      })),
      tags: ['T8', '贞贞画布'],
    });
    if (!result.success) {
      logBus.warn(result.error || '发送到 Eagle 失败，请确认 Eagle 已启动并开启本地 API', 'Eagle');
      return;
    }
    const imported = result.data.imported.length;
    const failed = result.data.failures.length;
    if (imported > 0) logBus.success(`已发送 ${imported} 项到 Eagle`, 'Eagle');
    if (failed > 0) logBus.warn(`${failed} 项发送失败，可检查 Eagle 是否支持该素材类型`, 'Eagle');
  }, [sendModal]);

  return {
    handleSaveSendMaterialsToResource,
    handleSendMaterialsToCanvas,
    handleSendMaterialsToEagle,
    insertWorkflowFragment,
    openSendMaterials,
    saveWorkflowFragmentToResource,
    saveWorkflowFragmentToSharedResource,
    sendModal,
    setSendModal,
  };
}
