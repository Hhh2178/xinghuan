import type { Node } from '@xyflow/react';

export function migrateImportedNodeData(node: Node): Node {
  if (!node || typeof node !== 'object') return node;
  const type = String(node.type || '').toLowerCase();
  const data = (node.data || {}) as Record<string, unknown>;
  if (type !== 'llm') return node;

  const nextData: Record<string, unknown> = { ...data };
  let changed = false;

  for (const key of ['error', 'status', 'isRunning', 'isPolling', 'pollingTimer', 'taskId', 'progress'] as const) {
    if (key in nextData) {
      delete nextData[key];
      changed = true;
    }
  }

  if (typeof nextData.prompt === 'string' && !nextData.userPrompt) {
    nextData.userPrompt = nextData.prompt;
    changed = true;
  }

  if (Array.isArray(nextData.history) && nextData.history.length === 0) {
    delete nextData.history;
    changed = true;
  }

  if (Array.isArray(nextData.generatedImages) && nextData.generatedImages.length === 0) {
    delete nextData.generatedImages;
    changed = true;
  }

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
