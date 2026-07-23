export type CanvasRunStatus =
  | 'draft'
  | 'planning'
  | 'awaiting_approval'
  | 'queued'
  | 'running'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface CanvasRunPlanGroup {
  id: string;
  order: number;
  name?: string;
  mode?: 'serial' | 'parallel';
  skipped: boolean;
  stepIds: string[];
}

export interface CanvasRunPlanStep {
  id: string;
  nodeId: string;
  nodeType: string;
  groupId: string | null;
  dependsOn: string[];
  skipped: boolean;
  configuration?: Record<string, unknown>;
}

export interface CanvasRunRecord {
  id: string;
  canvasId: string;
  canvasRevision: number;
  runScope: 'canvas' | 'group' | 'downstream' | 'workflow';
  workflowId: string | null;
  workflowRevision: number | null;
  workflowSubgraphHash: string | null;
  status: CanvasRunStatus;
  planSnapshot: {
    canvasId: string;
    canvasRevision: number;
    workflowId?: string;
    workflowRevision?: number;
    workflowSubgraphHash?: string;
    groups: CanvasRunPlanGroup[];
    steps: CanvasRunPlanStep[];
  };
  inputSnapshot?: Record<string, unknown>;
  configurationSnapshot: Record<string, unknown>;
  budgetSnapshot: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowSupervisionSettingsProjection {
  canvasId: string;
  workflowId: string;
  workflowName: string;
  workflowRevision: number;
  settings: WorkflowSupervisionSettings;
  sources: Record<keyof WorkflowSupervisionSettings, WorkflowSupervisionSettingSource>;
  clampedFields: string[];
  hasRemembered: boolean;
  rememberedRevision: number | null;
  rememberedUpdatedAt: number | null;
  platformLimits: Partial<WorkflowSupervisionLimits>;
  appliesTo: 'next_run';
}

export interface CanvasRunEvent {
  id: string;
  runId: string;
  runStepId: string | null;
  runStepKey?: string | null;
  nodeId?: string | null;
  sequence: number;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface PendingCanvasRunCandidateSelection {
  runId: string;
  stepId: string;
  nodeId: string;
  mediaKind: 'image' | 'video';
  maximum: number;
  criteria: string;
  note: string;
  candidates: Array<{
    artifactId: string;
    mediaKind: 'image' | 'video';
    fileUrl: string;
    sourceNodeId: string;
    prompt: string;
    variableSnapshot: Record<string, unknown>;
    providerId: string;
    modelRecordId: string;
    createdAt: number;
  }>;
}

export type CanvasRunCommand = 'start' | 'pause' | 'resume' | 'cancel' | 'retry';

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error || payload?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return (payload?.data ?? payload) as T;
}

function requireWorkflowSupervisionSettingsProjection(value: unknown): WorkflowSupervisionSettingsProjection {
  if (!isRecord(value) || !isRecord(value.settings) || !isRecord(value.sources)) {
    throw new Error('托管设置响应无效，请刷新后重试');
  }
  const settings = value.settings;
  const valid = typeof value.canvasId === 'string'
    && typeof value.workflowId === 'string'
    && typeof value.workflowName === 'string'
    && typeof value.workflowRevision === 'number'
    && typeof value.hasRemembered === 'boolean'
    && Array.isArray(value.clampedFields)
    && value.appliesTo === 'next_run'
    && typeof settings.defaultRetryCount === 'number'
    && (settings.retryExhaustionPolicy === 'stop' || settings.retryExhaustionPolicy === 'compatible_fallback')
    && typeof settings.maxFallbackCount === 'number'
    && typeof settings.promptReviewRewriteEnabled === 'boolean'
    && typeof settings.promptReviewMaxRetries === 'number'
    && typeof settings.stageConcurrency === 'number'
    && typeof settings.maxDurationSeconds === 'number'
    && typeof settings.maxCost === 'string'
    && typeof settings.currency === 'string'
    && (settings.candidateSelectionMode === 'manual' || settings.candidateSelectionMode === 'ai')
    && typeof settings.candidateSelectionCount === 'number'
    && typeof settings.candidateMinimumConfidence === 'number'
    && typeof settings.lowConfidenceManualFallback === 'boolean'
    && isRecord(settings.nodeRetryOverrides);
  if (!valid) throw new Error('托管设置响应无效，请刷新后重试');
  return value as unknown as WorkflowSupervisionSettingsProjection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function createCanvasRun(input: {
  canvasId: string;
  workflowId?: string;
  workflowInputValues?: Record<string, unknown>;
  runScope: CanvasRunRecord['runScope'];
  configuration?: Record<string, unknown>;
  budget?: Record<string, unknown>;
  supervisionSettings?: Partial<WorkflowSupervisionSettings>;
}) {
  return readResponse<CanvasRunRecord>(await fetch('/api/canvas-runs', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
  }));
}

export async function readWorkflowSupervisionSettings(canvasId: string, workflowId: string) {
  const query = new URLSearchParams({ canvasId, workflowId });
  return requireWorkflowSupervisionSettingsProjection(await readResponse<unknown>(await fetch(`/api/canvas-run-settings?${query}`, {
    credentials: 'same-origin',
  })));
}

export async function saveWorkflowSupervisionSettings(canvasId: string, workflowId: string, settings: WorkflowSupervisionSettings) {
  return requireWorkflowSupervisionSettingsProjection(await readResponse<unknown>(await fetch('/api/canvas-run-settings', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canvasId, workflowId, settings }),
  })));
}

export async function resetWorkflowSupervisionSettings(canvasId: string, workflowId: string) {
  const query = new URLSearchParams({ canvasId, workflowId });
  return requireWorkflowSupervisionSettingsProjection(await readResponse<unknown>(await fetch(`/api/canvas-run-settings?${query}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })));
}

export async function readCanvasRun(runId: string) {
  return readResponse<CanvasRunRecord>(await fetch(`/api/canvas-runs/${encodeURIComponent(runId)}`, {
    credentials: 'same-origin',
  }));
}

export async function listCanvasWorkflowRuns(canvasId: string) {
  const query = new URLSearchParams({ canvasId });
  const result = await readResponse<{ items: CanvasRunRecord[] }>(await fetch(`/api/canvas-runs?${query}`, {
    credentials: 'same-origin',
  }));
  return result.items;
}

export async function commandCanvasRun(runId: string, command: CanvasRunCommand, request?: Record<string, unknown>) {
  return readResponse<CanvasRunRecord>(await fetch(`/api/canvas-runs/${encodeURIComponent(runId)}/${command}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), request }),
  }));
}

export async function decideCanvasRunApproval(runId: string, approvalId: string, decision: 'approve' | 'reject') {
  return readResponse<{ id: string; status: string }>(await fetch(`/api/canvas-runs/${encodeURIComponent(runId)}/approvals/${encodeURIComponent(approvalId)}/${decision}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }));
}

export async function readCanvasRunCandidateSelections(runId: string) {
  const result = await readResponse<{ items: PendingCanvasRunCandidateSelection[] }>(await fetch(
    `/api/canvas-runs/${encodeURIComponent(runId)}/candidate-selections`,
    { credentials: 'same-origin' },
  ));
  return result.items;
}

export async function selectCanvasRunCandidates(runId: string, stepId: string, selectedArtifactIds: string[]) {
  return readResponse<{
    runId: string;
    stepId: string;
    selectionId: string;
    selectedArtifactIds: string[];
    notSelectedArtifactIds: string[];
  }>(await fetch(`/api/canvas-runs/${encodeURIComponent(runId)}/candidate-selections/${encodeURIComponent(stepId)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedArtifactIds, idempotencyKey: crypto.randomUUID() }),
  }));
}

export function subscribeCanvasRunEvents(
  runId: string,
  handlers: { onEvent: (event: CanvasRunEvent) => void; onError: () => void },
) {
  const source = new EventSource(`/api/canvas-runs/${encodeURIComponent(runId)}/events/stream`, { withCredentials: true });
  source.addEventListener('run-event', (event) => {
    try {
      handlers.onEvent(JSON.parse((event as MessageEvent<string>).data) as CanvasRunEvent);
    } catch {
      handlers.onError();
    }
  });
  source.onerror = handlers.onError;
  return () => source.close();
}
import type {
  WorkflowSupervisionLimits,
  WorkflowSupervisionSettings,
  WorkflowSupervisionSettingSource,
} from '@xinghuan/shared';
