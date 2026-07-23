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

export interface CanvasRunEvent {
  id: string;
  runId: string;
  runStepId: string | null;
  sequence: number;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: number;
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

export async function createCanvasRun(input: {
  canvasId: string;
  workflowId?: string;
  workflowInputValues?: Record<string, unknown>;
  runScope: CanvasRunRecord['runScope'];
  configuration?: Record<string, unknown>;
  budget?: Record<string, unknown>;
}) {
  return readResponse<CanvasRunRecord>(await fetch('/api/canvas-runs', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
  }));
}

export async function readCanvasRun(runId: string) {
  return readResponse<CanvasRunRecord>(await fetch(`/api/canvas-runs/${encodeURIComponent(runId)}`, {
    credentials: 'same-origin',
  }));
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
