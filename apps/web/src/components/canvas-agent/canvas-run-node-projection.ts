import type { NodeExecutionProjection, NodeExecutionStatus } from '@xinghuan/shared';
import { buildCanvasRunStepViews } from './canvas-run-view-model';
import type { CanvasRunEvent, CanvasRunRecord } from './canvas-run-api';

export interface CanvasRunNodeProjection extends NodeExecutionProjection {
  label: string;
}

export function buildCanvasRunNodeProjection(
  input: CanvasRunRecord | {
    run: Pick<CanvasRunRecord, 'id' | 'status' | 'planSnapshot' | 'runtimeSteps'>;
    events: CanvasRunEvent[];
  },
): Record<string, CanvasRunNodeProjection> {
  const run = ('run' in input ? input.run : input) as CanvasRunRecord;
  const events = 'run' in input ? input.events : [];
  const detailed = Array.isArray(run.runtimeSteps) ? run.runtimeSteps : [];
  if (detailed.length > 0) {
    return Object.fromEntries(detailed.map((step) => [step.nodeId, {
      ...step,
      label: projectionLabel(step.status, step.progress),
    }]));
  }

  const projection: Record<string, CanvasRunNodeProjection> = {};
  for (const view of buildCanvasRunStepViews(run, events)) {
    const latest = [...events].reverse().find((event) => event.nodeId === view.step.nodeId || event.runStepKey === view.step.id || event.runStepId === view.step.id);
    const payload = latest?.payload || {};
    const configuredCount = countFrom(view.step.configuration?.executionPayload)
      || countFrom(view.step.configuration)
      || 1;
    const batch = object(payload.generationBatch);
    const completedCount = number(payload.completed)
      || number(batch.completed)
      || number(payload.completedGenerationCount)
      || number(payload.providerRequestCount);
    const status = projectionStatus(view.status);
    const progress = status === 'running' && configuredCount > 1
      ? `${Math.min(completedCount, configuredCount)}/${configuredCount}`
      : status === 'success' ? '1/1' : '';
    projection[view.step.nodeId] = {
      authority: 'workflow_run',
      runId: run.id,
      runStepId: view.step.id,
      nodeId: view.step.nodeId,
      nodeType: view.step.nodeType,
      status,
      progress,
      taskRuns: [],
      outputs: { generationArtifactIds: [], imageUrls: [], videoUrls: [], audioUrls: [] },
      label: view.status === 'running' && configuredCount > 1
        ? `运行中 ${Math.min(completedCount, configuredCount)}/${configuredCount}`
        : statusLabel(view.status),
    };
  }
  return projection;
}

function projectionLabel(status: NodeExecutionStatus, progress: string) {
  if (status === 'running' && progress) return `运行中 ${progress}`;
  return ({ idle: '等待', queued: '排队中', running: '运行中', success: '已完成', error: '失败', cancelled: '已取消' } as const)[status];
}

function projectionStatus(status: string): NodeExecutionStatus {
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'cancelled') return 'cancelled';
  if (['running', 'evaluating', 'selecting', 'retrying'].includes(status)) return 'running';
  if (['waiting', 'candidate_wait', 'approval'].includes(status)) return 'queued';
  return 'idle';
}

function countFrom(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? number((value as Record<string, unknown>).generationCount) : 0;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(4, Math.floor(parsed)) : 0;
}

function statusLabel(status: string) {
  return ({ waiting: '等待', candidate_wait: '等待候选', evaluating: 'AI 评估中', selecting: '待人工选择', retrying: '重试中', approval: '待审批', succeeded: '已完成', failed: '失败', skipped: '已跳过', running: '运行中' } as Record<string, string>)[status] || '等待';
}
