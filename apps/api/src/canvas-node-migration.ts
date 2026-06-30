import type { Node } from '@xyflow/react';

export function cleanImportedNodeData(nodeType: unknown, data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const source = data as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  let changed = false;

  const normalizedType = String(nodeType || '').toLowerCase();

  if (normalizedType === 'llm') {
    const legacyPrompt = typeof next.prompt === 'string' ? next.prompt : '';
    const userPrompt = typeof next.userPrompt === 'string' ? next.userPrompt : '';
    const reply = typeof next.reply === 'string' ? next.reply : '';

    if (!userPrompt && legacyPrompt && (!reply || legacyPrompt !== reply)) {
      next.userPrompt = legacyPrompt;
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
      if (key in next) {
        delete next[key];
        changed = true;
      }
    }
  }

  if (normalizedType === 'video') {
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
      if (key in next) {
        delete next[key];
        changed = true;
      }
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
