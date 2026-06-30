import type { Node } from '@xyflow/react';

export function migrateImportedNodeData(node: Node): Node {
  if (!node || typeof node !== 'object') return node;
  const type = String(node.type || '').toLowerCase();
  const data = (node.data || {}) as Record<string, unknown>;
  const nextData =
    type === 'llm'
      ? cleanImportedLlmData(data)
      : type === 'video'
        ? cleanImportedVideoData(data)
        : data;
  const changed = nextData !== data;

  if (changed) {
    return {
      ...node,
      data: nextData,
    };
  }
  return node;
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
