import { describe, expect, it } from 'vitest';
import type { CanvasRunEvent, CanvasRunRecord } from './canvas-run-api';
import { buildCanvasRunFailureDiagnostic, buildCanvasRunPlanSections, buildCanvasRunStepViews, canvasRunBudgetItems, canvasRunEventLabel } from './canvas-run-view-model';

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

  it('projects governed recovery and prompt rewrite evidence from the new runtime events', () => {
    const fallback = buildCanvasRunStepViews(run, [
      event(1, 'canvas_run.step_recovery_scheduled', {
        action: 'switch_generation_model',
        providerId: 'provider-b',
        modelId: 'model-b',
        retryDelayMs: 2_000,
      }),
    ])[0];
    expect(fallback).toMatchObject({
      status: 'retrying',
      provider: 'provider-b',
      model: 'model-b',
      recoveryEvidence: '切换兼容模型 · 2 秒后',
    });

    const rewritten = buildCanvasRunStepViews(run, [
      event(1, 'canvas_run.prompt_rewrite_started'),
      event(2, 'canvas_run.prompt_rewrite_applied', { changeCount: 2 }),
    ])[0];
    expect(rewritten).toMatchObject({ status: 'retrying', recoveryEvidence: '提示词已改写 · 2 处' });
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
    expect(canvasRunEventLabel('canvas_run.step_recovery_scheduled')).toBe('步骤恢复已安排');
    expect(canvasRunEventLabel('canvas_run.prompt_rewrite_applied')).toBe('提示词审核改写已应用');
    expect(canvasRunEventLabel('canvas_run.candidate_selection_waiting')).toBe('等待人工选择');
    expect(canvasRunEventLabel('canvas_run.candidate_selection_completed')).toBe('候选选择完成');
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

  it('turns a failed event into node, category, impact, recovery, and technical evidence', () => {
    const diagnostic = buildCanvasRunFailureDiagnostic({ ...run, status: 'failed' }, [
      event(1, 'canvas_run.step_model_unavailable', { code: 'CANVAS_RUN_MODEL_UNAVAILABLE', modelRecordId: 'model-a' }),
    ]);

    expect(diagnostic).toEqual({
      nodeNumber: 1,
      nodeType: 'video',
      category: '模型不可用',
      impact: '当前节点未完成，下游步骤尚未释放。',
      recovery: '服务恢复后可按原计划重试；修改模型或候选后请新建运行计划。',
      technical: 'CANVAS_RUN_MODEL_UNAVAILABLE · model-a',
    });
  });

  it('prefers the concrete failed step over a later run-level failure event', () => {
    const diagnostic = buildCanvasRunFailureDiagnostic({ ...run, status: 'failed' }, [
      event(1, 'canvas_run.step_failed', { code: 'TEXT_EMPTY' }),
      { ...event(2, 'canvas_run.failed', { code: 'CANVAS_RUN_FAILED' }), runStepId: null },
    ]);

    expect(diagnostic).toEqual({
      nodeNumber: 1,
      nodeType: 'video',
      category: '输入参数',
      impact: '当前节点未完成，下游步骤尚未释放。',
      recovery: '修正工作流输入后新建运行计划；按原计划重试不会读取当前编辑。',
      technical: 'TEXT_EMPTY',
    });
  });

  it('provides a recreate-plan action for an insufficient candidate set', () => {
    const diagnostic = buildCanvasRunFailureDiagnostic({ ...run, status: 'failed' }, [
      event(1, 'canvas_run.step_failed', { code: 'SMART_CANDIDATE_COUNT_INSUFFICIENT' }),
    ]);

    expect(diagnostic).toMatchObject({
      category: '候选不足',
      recovery: '至少准备 2 个同类型候选后新建运行计划。',
    });
  });

  it('gives legacy drafts an explicit recreate-run repair path', () => {
    const diagnostic = buildCanvasRunFailureDiagnostic({ ...run, status: 'failed' }, [
      event(1, 'canvas_run.step_failed', { code: 'CANVAS_RUN_MODEL_RECORD_REPAIR_REQUIRED' }),
    ]);

    expect(diagnostic).toMatchObject({
      category: '旧 Run 缺少模型记录',
      recovery: '当前草稿无法安全补全模型记录。请从最新工作流重新创建 Run。',
    });
  });
});
