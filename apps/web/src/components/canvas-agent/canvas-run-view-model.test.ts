import { describe, expect, it } from 'vitest';
import type { CanvasRunEvent, CanvasRunRecord } from './canvas-run-api';
import { buildCanvasRunPlanSections, buildCanvasRunStepViews, canvasRunBudgetItems, canvasRunEventLabel } from './canvas-run-view-model';

const run: CanvasRunRecord = {
  id: 'run-1', canvasId: 'canvas-1', canvasRevision: 7, runScope: 'canvas', workflowId: null, workflowRevision: null, workflowSubgraphHash: null, status: 'running',
  planSnapshot: {
    canvasId: 'canvas-1', canvasRevision: 7, groups: [{ id: 'group-a', order: 0, skipped: false, stepIds: ['step-1'] }],
    steps: [{ id: 'step-1', nodeId: 'node-1', nodeType: 'video', groupId: 'group-a', dependsOn: [], skipped: false, configuration: { providerName: 'Provider A', modelName: 'Model A', generationAlternatives: [{ modelName: 'Model B' }] } }],
  },
  configurationSnapshot: {}, budgetSnapshot: { maxTasks: 8, maxDurationMs: 90000 }, createdAt: 1, updatedAt: 2,
};

const event = (sequence: number, eventType: string, payload: Record<string, unknown> = {}): CanvasRunEvent => ({
  id: `event-${sequence}`, runId: run.id, runStepId: 'step-1', sequence, eventType, payload, createdAt: sequence * 1000,
});

describe('canvas run supervision view model', () => {
  it('projects retry, approval and terminal state from ordered durable events', () => {
    const views = buildCanvasRunStepViews(run, [
      event(1, 'canvas_run.step_dispatched', { attempt: 1 }),
      event(2, 'canvas_run.step_retry_scheduled', { strategy: 'same_configuration' }),
      event(3, 'canvas_run.step_approval_requested', { actionType: 'switch_generation_model' }),
    ]);
    expect(views[0]).toMatchObject({ status: 'approval', attempt: 1, provider: 'Provider A', model: 'Model A', recoveryEvidence: 'switch_generation_model' });
    expect(buildCanvasRunStepViews(run, [...[], event(4, 'canvas_run.step_succeeded')])[0].status).toBe('succeeded');
  });

  it('projects input and quality-selection evidence without inventing missing values', () => {
    const view = buildCanvasRunStepViews(run, [
      event(1, 'canvas_run.quality_evaluation_dispatched', { inputMode: 'sampled_frames', sampleCount: 6, truncatedItemCount: 2, routeEntryId: 'route-1' }),
      event(2, 'canvas_run.quality_selection_completed', { selectedArtifactIds: ['a'], rejectedArtifactIds: ['b', 'c'] }),
    ])[0];
    expect(view.inputEvidence).toBe('sampled_frames · 6 项 · 裁剪 2 项');
    expect(view.qualityEvidence).toBe('选中 1 · 淘汰 2');
    expect(view.model).toBe('Model A');
  });

  it('formats event and budget evidence for compact supervision UI', () => {
    expect(canvasRunEventLabel('canvas_run.step_retry_scheduled')).toBe('步骤准备重试');
    expect(canvasRunBudgetItems(run.budgetSnapshot)).toEqual([
      { label: '任务上限', value: '8' },
      { label: '时长上限', value: '90 秒' },
    ]);
  });

  it('preserves explicit group order and keeps dependencies inside each step view', () => {
    const reordered = { ...run, planSnapshot: { ...run.planSnapshot, groups: [{ ...run.planSnapshot.groups[0], order: 2 }] } };
    const views = buildCanvasRunStepViews(reordered, []);
    expect(buildCanvasRunPlanSections(reordered, views)).toMatchObject([{ id: 'group-a', label: '分组 3', order: 2, steps: [{ step: { id: 'step-1' } }] }]);
  });
});
