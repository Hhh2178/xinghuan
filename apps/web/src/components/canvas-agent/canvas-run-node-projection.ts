import { buildCanvasRunStepViews } from './canvas-run-view-model';
import type { CanvasRunEvent, CanvasRunRecord } from './canvas-run-api';

export interface CanvasRunNodeProjection {
  status: string;
  label: string;
}

export function buildCanvasRunNodeProjection(input: {
  run: Pick<CanvasRunRecord, 'status' | 'planSnapshot'>;
  events: CanvasRunEvent[];
}): Record<string, CanvasRunNodeProjection> {
  const run = input.run as CanvasRunRecord;
  const projection: Record<string, CanvasRunNodeProjection> = {};
  for (const view of buildCanvasRunStepViews(run, input.events)) {
    const latest = [...input.events].reverse().find((event) => event.nodeId === view.step.nodeId || event.runStepKey === view.step.id || event.runStepId === view.step.id);
    const payload = latest?.payload || {};
    const configuredCount = countFrom(view.step.configuration?.executionPayload)
      || countFrom(view.step.configuration)
      || 1;
    const requestedCount = number(payload.providerRequestCount) || number(payload.generationCount) || configuredCount;
    projection[view.step.nodeId] = {
      status: view.status,
      label: view.status === 'running' && configuredCount > 1 ? `运行中 ${Math.min(requestedCount, configuredCount)}/${configuredCount}` : statusLabel(view.status),
    };
  }
  return projection;
}

function countFrom(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? number((value as Record<string, unknown>).generationCount) : 0;
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(4, Math.floor(parsed)) : 0;
}

function statusLabel(status: string) {
  return ({ waiting: '等待', candidate_wait: '等待候选', evaluating: 'AI 评估中', selecting: '待人工选择', retrying: '重试中', approval: '待审批', succeeded: '已完成', failed: '失败', skipped: '已跳过', running: '运行中' } as Record<string, string>)[status] || '等待';
}
