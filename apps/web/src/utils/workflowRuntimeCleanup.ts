const WORKFLOW_RUNTIME_STRIP_KEYS = [
  'error',
  'errorCode',
  'errorMessage',
  'failedReason',
  'status',
  'isRunning',
  'isPolling',
  'polling',
  'pollingTimer',
  'taskId',
  'taskIds',
  'taskRuns',
  'runId',
  'runIds',
  'runTargetId',
  'progress',
  'progressLabel',
  'startedAt',
  'finishedAt',
  'lastPrompt',
  'lastDurationMs',
  'generatedImages',
  'generatedVideos',
  'generatedAudios',
  'generatedResult',
  'generatedResults',
  'generatedOutputs',
  'output',
  'outputs',
  'results',
  'result',
  'imageUrl',
  'imageUrls',
  'videoUrl',
  'videoUrls',
  'audioUrl',
  'audioUrls',
  'promptTips',
  'clientId',
  'runtimeError',
  'runtimeStatus',
] as const;

function keepString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function cleanupNodeRuntimeForWorkflowTemplate(nodeType: unknown, data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const source = data as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  let changed = false;

  const resourceSource = keepString(source.resourceSource);
  const resourceItemId = keepString(source.resourceItemId);
  const resourceKind = keepString(source.resourceKind);
  const fallbackUrl = keepString(source.fallbackUrl);

  for (const key of WORKFLOW_RUNTIME_STRIP_KEYS) {
    if (key in next) {
      delete next[key];
      changed = true;
    }
  }

  if (resourceSource) next.resourceSource = resourceSource;
  if (resourceItemId) next.resourceItemId = resourceItemId;
  if (resourceKind) next.resourceKind = resourceKind;
  if (fallbackUrl) next.fallbackUrl = fallbackUrl;

  if (String(nodeType || '').toLowerCase() === 'llm') {
    const legacyPrompt = keepString(source.prompt);
    const existingUserPrompt = keepString(next.userPrompt);
    if (!existingUserPrompt && legacyPrompt) {
      next.userPrompt = legacyPrompt;
      changed = true;
    }
  }

  return changed ? next : data;
}
