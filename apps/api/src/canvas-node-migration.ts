import type { Node } from '@xyflow/react';

export function cleanImportedNodeData(nodeType: unknown, data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const source = data as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  let changed = false;

  if (String(nodeType || '').toLowerCase() === 'llm') {
    for (const key of ['error', 'status', 'isRunning', 'isPolling', 'pollingTimer', 'taskId', 'progress'] as const) {
      if (key in next) {
        delete next[key];
        changed = true;
      }
    }
    if (next.reply == null && typeof next.prompt === 'string') {
      next.userPrompt = typeof next.userPrompt === 'string' ? next.userPrompt : next.prompt;
      changed = true;
    }
    if (Array.isArray(next.generatedImages) && next.generatedImages.length === 0) {
      delete next.generatedImages;
      changed = true;
    }
    if (Array.isArray(next.history) && next.history.length === 0) {
      delete next.history;
      changed = true;
    }
    if (typeof next.prompt === 'string' && typeof next.reply === 'string' && next.prompt === next.reply) {
      next.userPrompt = typeof next.userPrompt === 'string' && next.userPrompt.trim() ? next.userPrompt : next.prompt;
      changed = true;
    }
  }

  return changed ? next : data;
}

export function sanitizeCanvasNodeData(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const source = data as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  let changed = false;
  for (const key of ['prompt', 'text', 'title', 'content'] as const) {
    if (typeof source[key] !== 'string') continue;
    const cleaned = sanitizeVisibleSeedText(source[key]);
    if (cleaned === source[key]) continue;
    next[key] = cleaned;
    changed = true;
  }
  return changed ? next : data;
}

export function sanitizeCanvasNodes(nodes: unknown[]): unknown[] {
  let changed = false;
  const sanitized = nodes.map((node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
    const source = node as Record<string, unknown>;
    const cleanedData = cleanImportedNodeData(source.type, source.data);
    const nextData = sanitizeCanvasNodeData(cleanedData);
    if (nextData === source.data) return node;
    changed = true;
    return { ...source, data: nextData };
  });
  return changed ? sanitized : nodes;
}

function sanitizeVisibleSeedText(value: string) {
  return String(value || '')
    .replace(/\b(TEST|TEMP|DUMMY)\b/gi, '')
    .trim();
}
