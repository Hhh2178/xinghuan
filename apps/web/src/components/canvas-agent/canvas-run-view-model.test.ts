import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { CanvasRunEvent, CanvasRunRecord } from './canvas-run-api';
import { buildCanvasRunFailureDiagnostic, buildCanvasRunPlanSections, buildCanvasRunStepViews, canvasRunBudgetItems, canvasRunEventLabel, canvasRunStepDisplayName } from './canvas-run-view-model';
import * as ViewModel from './canvas-run-view-model';

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
  it('projects Agent analysis and the active deterministic execution layer', () => {
    const buildAnalysisView = (ViewModel as unknown as Record<string, unknown>).buildCanvasRunAnalysisView;
    expect(typeof buildAnalysisView).toBe('function');
    if (typeof buildAnalysisView !== 'function') return;
    const analyzedRun = {
      ...run,
      planSnapshot: {
        ...run.planSnapshot,
        executionLayers: [{ index: 0, stepIds: ['step-A', 'step-B'] }, { index: 1, stepIds: ['step-C'] }],
        steps: [
          { id: 'step-A', nodeId: 'image-a001', nodeType: 'image', groupId: 'group-a', dependsOn: [], skipped: false, executionLayer: 0, displayIdentity: { label: '人物生成', suffix: 'a001', displayName: '人物生成 #a001' } },
          { id: 'step-B', nodeId: 'image-b001', nodeType: 'image', groupId: 'group-a', dependsOn: [], skipped: false, executionLayer: 0, displayIdentity: { label: '场景生成', suffix: 'b001', displayName: '场景生成 #b001' } },
          { id: 'step-C', nodeId: 'selector-c001', nodeType: 'smart-candidate-selector', groupId: 'group-a', dependsOn: ['image-a001', 'image-b001'], skipped: false, executionLayer: 1, displayIdentity: { label: '智能候选选择器', suffix: 'c001', displayName: '智能候选选择器 #c001' } },
        ],
        agentAnalysis: {
          status: 'completed',
          summary: 'A 与 B 可并发，C 等待汇聚。',
          concurrencyGroups: [{ stepIds: ['step-A', 'step-B'], reason: '互不依赖' }],
          serialConstraints: [{ beforeStepId: 'step-A', afterStepId: 'step-C', reason: '候选汇聚' }],
          risks: ['上游失败会阻止汇聚'],
          recommendedMaximumParallelism: 2,
          estimatedRequestCount: 2,
          deterministicLayerCount: 2,
        },
      },
    };
    const events = [{ id: 'layer', runId: 'run-1', runStepId: null, sequence: 4, eventType: 'canvas_run.execution_layer_started', payload: { layerIndex: 1 }, createdAt: 10 }];

    expect(buildAnalysisView(analyzedRun, events)).toMatchObject({
      status: 'completed',
      summary: 'A 与 B 可并发，C 等待汇聚。',
      activeLayer: 1,
      layerCount: 2,
      estimatedRequestCount: 2,
      concurrencyGroups: [{ labels: ['人物生成 #a001', '场景生成 #b001'], reason: '互不依赖' }],
      serialConstraints: [{ before: '人物生成 #a001', after: '智能候选选择器 #c001', reason: '候选汇聚' }],
    });
  });

  it('renders analysis, concurrency, risk and active layer evidence in the supervisor', () => {
    const source = readFileSync(new URL('./CanvasSupervisionPlanView.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/canvasRunStepDisplayName/);
    expect(source).toMatch(/AI 链路分析/);
    expect(source).toMatch(/并发组/);
    expect(source).toMatch(/当前执行层/);
    expect(source).toMatch(/预计请求/);
  });

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
    expect(canvasRunBudgetItems({ maxTasks: 0, maxCost: '0', maxDurationMs: 0, maxTokens: 'unlimited' })).toEqual([]);
  });

  it('uses frozen human node identity and a catalog fallback for historical runs', () => {
    expect(canvasRunStepDisplayName({
      ...run.planSnapshot.steps[0],
      nodeId: 'video-v3uy',
      displayIdentity: { label: '人物视频', suffix: 'v3uy', displayName: '人物视频 #v3uy' },
    })).toBe('人物视频 #v3uy');
    expect(canvasRunStepDisplayName({ ...run.planSnapshot.steps[0], nodeId: 'video-old1', displayIdentity: undefined }))
      .toBe('视频 #old1');
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

    expect(diagnostic).toMatchObject({
      category: 'model',
      title: '模型当前不可用',
      impact: '当前节点未执行，下游节点不会被释放。',
      location: { runId: 'run-1', runStepId: 'step-1', nodeId: 'node-1', nodeType: 'video', stepNumber: 1, providerName: 'Provider A', modelName: 'Model A' },
      technical: { code: 'CANVAS_RUN_MODEL_UNAVAILABLE' },
    });
  });

  it('prefers the concrete failed step over a later run-level failure event', () => {
    const diagnostic = buildCanvasRunFailureDiagnostic({ ...run, status: 'failed' }, [
      event(1, 'canvas_run.step_failed', { code: 'TEXT_EMPTY' }),
      { ...event(2, 'canvas_run.failed', { code: 'CANVAS_RUN_FAILED' }), runStepId: null },
    ]);

    expect(diagnostic).toMatchObject({ category: 'input', title: '节点输入或参数无效', location: { nodeId: 'node-1', stepNumber: 1 }, technical: { code: 'TEXT_EMPTY' } });
  });

  it('provides a recreate-plan action for an insufficient candidate set', () => {
    const diagnostic = buildCanvasRunFailureDiagnostic({ ...run, status: 'failed' }, [
      event(1, 'canvas_run.step_failed', { code: 'SMART_CANDIDATE_COUNT_INSUFFICIENT' }),
    ]);

    expect(diagnostic).toMatchObject({
      category: 'input',
      title: '智能选择器候选不足',
      action: '至少连接 2 个同类型候选，再重新生成运行计划。',
    });
  });

  it('gives legacy drafts an explicit recreate-run repair path', () => {
    const diagnostic = buildCanvasRunFailureDiagnostic({ ...run, status: 'failed' }, [
      event(1, 'canvas_run.step_failed', { code: 'CANVAS_RUN_MODEL_RECORD_REPAIR_REQUIRED' }),
    ]);

    expect(diagnostic).toMatchObject({
      category: 'model',
      title: '模型配置需要修复',
      action: '在后台修复并发布模型后，从最新工作流新建 Run。',
    });
  });
});
