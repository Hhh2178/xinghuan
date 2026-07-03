import type { Node } from '@xyflow/react';

export function migrateImportedNodeData(node: Node): Node {
  if (!node || typeof node !== 'object') return node;
  const type = String(node.type || '').toLowerCase();
  const data = (node.data || {}) as Record<string, unknown>;
  const comfyuiMigrated = migrateLegacyComfyuiNode(node, type, data);
  const effectiveNode = comfyuiMigrated || node;
  const effectiveType = String(effectiveNode.type || '').toLowerCase();
  const effectiveData = (effectiveNode.data || {}) as Record<string, unknown>;
  const nextData =
    effectiveType === 'llm'
      ? cleanImportedLlmData(effectiveData)
      : effectiveType === 'video'
        ? cleanImportedVideoData(effectiveData)
        : effectiveData;
  const changed = comfyuiMigrated !== null || nextData !== effectiveData;

  if (changed) {
    return {
      ...effectiveNode,
      data: nextData,
    };
  }
  return effectiveNode;
}

export function migrateImportedNodes(nodes: Node[]): Node[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node) => migrateImportedNodeData(node));
}

function cleanImportedLlmData(data: Record<string, unknown>): Record<string, unknown> {
  const nextData: Record<string, unknown> = { ...data };
  let changed = false;
  const legacyPrompt = typeof nextData.prompt === 'string' ? nextData.prompt : '';
  const userPrompt = typeof nextData.userPrompt === 'string' ? nextData.userPrompt : '';
  const reply = typeof nextData.reply === 'string' ? nextData.reply : '';

  if (!userPrompt && legacyPrompt && (!reply || legacyPrompt !== reply)) {
    nextData.userPrompt = legacyPrompt;
    changed = true;
  }

  for (const key of [
    'error',
    'status',
    'isRunning',
    'isPolling',
    'pollingTimer',
    'taskId',
    'taskIds',
    'progress',
    'reply',
    'prompt',
    'history',
    'generatedImages',
    'imageUrl',
    'imageUrls',
    'consumedTexts',
    'taskRuns',
    'startedAt',
    'finishedAt',
    'lastPrompt',
    'lastDurationMs',
  ] as const) {
    if (key in nextData) {
      delete nextData[key];
      changed = true;
    }
  }

  return changed ? nextData : data;
}

function cleanImportedVideoData(data: Record<string, unknown>): Record<string, unknown> {
  const nextData: Record<string, unknown> = { ...data };
  let changed = false;

  for (const key of [
    'error',
    'status',
    'isRunning',
    'isPolling',
    'pollingTimer',
    'taskId',
    'taskIds',
    'progress',
    'taskRuns',
    'videoUrl',
    'videoUrls',
    'remoteVideoUrls',
    'startedAt',
    'finishedAt',
    'lastPrompt',
    'lastDurationMs',
  ] as const) {
    if (key in nextData) {
      delete nextData[key];
      changed = true;
    }
  }

  return changed ? nextData : data;
}

function migrateLegacyComfyuiNode(
  node: Node,
  type: string,
  data: Record<string, unknown>,
): Node | null {
  if (type !== 'comfyui-app' && type !== 'comfyui-store' && type !== 'comfyui-app-maker') {
    return null;
  }

  if (type === 'comfyui-app') {
    return {
      ...node,
      type: 'comfyui',
      data: {
        ...data,
        sharedWorkflowId: stringOrEmpty(data.sharedWorkflowId, data.comfyuiWorkflowId, data.comfyuiAppWorkflowId),
        comfyuiInstanceId: stringOrEmpty(data.comfyuiInstanceId, data.comfyuiAppInstanceId),
        comfyuiWorkflowId: stringOrEmpty(data.comfyuiWorkflowId, data.sharedWorkflowId, data.comfyuiAppWorkflowId),
        comfyuiSearchQuery: stringOrEmpty(data.comfyuiSearchQuery, data.comfyuiAppSearchQuery),
        comfyuiParamValues: recordOrEmpty(data.comfyuiParamValues, data.comfyuiAppParamValues),
        comfyuiSelectedOutputKey: stringOrEmpty(data.comfyuiSelectedOutputKey, data.comfyuiAppSelectedOutputKey),
      },
    };
  }

  return {
    ...node,
    type: 'comfyui',
    data: {
      materialOrder: Array.isArray(data.materialOrder) ? data.materialOrder : [],
      excludedMaterialIds: Array.isArray(data.excludedMaterialIds) ? data.excludedMaterialIds : [],
      status: 'error',
      error: '旧 ComfyUI 节点已迁移为统一 comfyui 节点，请重新选择后台已发布的共享工作流。',
      sharedWorkflowId: '',
      comfyuiWorkflowId: '',
      comfyuiSearchQuery: '',
      comfyuiParamValues: {},
      ...(type === 'comfyui-store'
        ? { comfyuiInstanceId: stringOrEmpty(data.comfyuiInstanceId, data.comfyuiStoreProviderId) }
        : {}),
    },
  };
}

function stringOrEmpty(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function recordOrEmpty(...values: unknown[]) {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return {};
}
