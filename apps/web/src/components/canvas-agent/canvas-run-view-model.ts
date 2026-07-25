import { projectCanvasRunFailureDiagnostic, resolveNodeDisplayIdentity, type CanvasRunFailureDiagnostic } from '@xinghuan/shared';
import { getNodeExecutionCapability } from '@xinghuan/agent-core';
import type { CanvasRunEvent, CanvasRunPlanStep, CanvasRunRecord, CanvasRunStatus } from './canvas-run-api';

export type CanvasRunStepViewStatus =
  | 'waiting'
  | 'candidate_wait'
  | 'running'
  | 'evaluating'
  | 'selecting'
  | 'retrying'
  | 'approval'
  | 'succeeded'
  | 'failed'
  | 'skipped';

export interface CanvasRunStepView {
  step: CanvasRunPlanStep;
  status: CanvasRunStepViewStatus;
  attempt: number;
  provider: string;
  model: string;
  inputEvidence: string;
  qualityEvidence: string;
  recoveryEvidence: string;
  reason: string;
  updatedAt: number | null;
}

export interface CanvasRunPlanSection {
  id: string;
  label: string;
  order: number;
  skipped: boolean;
  mode: 'serial' | 'parallel';
  steps: CanvasRunStepView[];
}

export interface CanvasRunAnalysisView {
  status: 'completed' | 'degraded';
  summary: string;
  concurrencyGroups: Array<{ labels: string[]; reason: string }>;
  serialConstraints: Array<{ before: string; after: string; reason: string }>;
  risks: string[];
  recommendedMaximumParallelism: number;
  estimatedRequestCount: number;
  activeLayer: number | null;
  layerCount: number;
  degradationReason: string;
}

export const CANVAS_RUN_STATUS_LABEL: Record<CanvasRunStatus, string> = {
  draft: '计划已生成',
  planning: '规划中',
  awaiting_approval: '等待确认',
  queued: '排队中',
  running: '运行中',
  paused: '已暂停',
  succeeded: '已完成',
  failed: '运行异常',
  cancelled: '已取消',
};

export const CANVAS_RUN_STEP_STATUS_LABEL: Record<CanvasRunStepViewStatus, string> = {
  waiting: '等待',
  candidate_wait: '等待候选',
  running: '运行中',
  evaluating: 'AI 评估中',
  selecting: '待人工选择',
  retrying: '重试中',
  approval: '待审批',
  succeeded: '已完成',
  failed: '失败',
  skipped: '已跳过',
};

const STEP_STATUS_BY_EVENT: Array<[RegExp, CanvasRunStepViewStatus]> = [
  [/step_(?:succeeded)|quality_selection_completed$|candidate_selection_completed$/, 'succeeded'],
  [/step_(?:failed|unsupported|model_unavailable)|budget_exceeded|quality_failed$/, 'failed'],
  [/step_(?:cancelled|skipped)$/, 'skipped'],
  [/step_approval_requested$/, 'approval'],
  [/(?:candidate_selection_waiting|candidate_selection_manual_required)$/, 'selecting'],
  [/candidate_evaluation_started$/, 'evaluating'],
  [/(?:step_retry_scheduled|step_recovery_scheduled|prompt_rewrite_(?:started|applied))$/, 'retrying'],
  [/step_(?:dispatched)|quality_(?:evaluation_started|evaluation_dispatched|artifact_evaluated)$/, 'running'],
];

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function firstText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return '';
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function eventStatus(event: CanvasRunEvent): CanvasRunStepViewStatus | null {
  if (event.eventType === 'canvas_run.step_status_changed') {
    const status = text(event.payload.status);
    if (status === 'succeeded') return 'succeeded';
    if (status === 'failed' || status === 'cancelled') return status === 'failed' ? 'failed' : 'skipped';
    if (status === 'awaiting_approval') return 'approval';
    if (status === 'ready' || status === 'blocked') return 'waiting';
    if (status === 'selecting') return 'selecting';
    if (status === 'evaluating') return 'evaluating';
    if (status === 'queued' || status === 'running') return 'running';
  }
  return STEP_STATUS_BY_EVENT.find(([pattern]) => pattern.test(event.eventType))?.[1] || null;
}

function alternativeModel(configuration: Record<string, unknown>): string {
  const alternatives = Array.isArray(configuration.generationAlternatives)
    ? configuration.generationAlternatives
    : Array.isArray(configuration.alternatives) ? configuration.alternatives : [];
  const candidate = object(alternatives[0]);
  return firstText(candidate, ['modelName', 'modelId', 'modelRecordId', 'modelKey']);
}

export function canvasRunStepDisplayName(step: CanvasRunPlanStep): string {
  const frozen = text(step.displayIdentity?.displayName);
  if (frozen) return frozen;
  return resolveNodeDisplayIdentity({
    nodeId: step.nodeId,
    nodeType: step.nodeType,
    catalogLabel: getNodeExecutionCapability(step.nodeType)?.label,
  }).displayName;
}

export function buildCanvasRunStepViews(run: CanvasRunRecord, events: CanvasRunEvent[]): CanvasRunStepView[] {
  return run.planSnapshot.steps.map((step) => {
    const configuration = object(step.configuration);
    const stepEvents = events.filter((event) => eventMatchesStep(event, step)).sort((a, b) => a.sequence - b.sequence);
    let status: CanvasRunStepViewStatus = step.skipped ? 'skipped' : step.nodeType === 'smart-candidate-selector' ? 'candidate_wait' : 'waiting';
    let attempt = 0;
    let provider = firstText(configuration, ['providerName', 'providerId', 'providerKey']);
    let model = firstText(configuration, ['modelName', 'modelId', 'modelRecordId', 'modelKey']);
    let inputEvidence = '';
    let qualityEvidence = '';
    let recoveryEvidence = alternativeModel(configuration);
    let reason = '';

    for (const event of stepEvents) {
      status = eventStatus(event) || status;
      attempt = Math.max(attempt, Number(event.payload.attempt || 0));
      provider = firstText(event.payload, ['providerName', 'providerId', 'providerKey']) || provider;
      model = firstText(event.payload, ['modelName', 'modelId', 'modelRecordId', 'modelKey']) || model;
      reason = firstText(event.payload, ['reason', 'code', 'failureClass']) || reason;
      const inputMode = firstText(event.payload, ['inputMode', 'videoInputMode']);
      const sampleCount = Number(event.payload.sampleCount || 0);
      const truncatedItems = Number(event.payload.truncatedItemCount || event.payload.croppedInputCount || 0);
      const inputParts = inputMode ? [sampleCount > 0 ? `${inputMode} · ${sampleCount} 项` : inputMode] : [];
      if (truncatedItems > 0) inputParts.push(`裁剪 ${truncatedItems} 项`);
      else if (event.payload.inputTruncated === true || event.payload.truncated === true) inputParts.push('已裁剪');
      if (inputParts.length > 0) inputEvidence = inputParts.join(' · ');
      if (event.eventType === 'canvas_run.quality_evaluation_dispatched' && event.payload.routeEntryId) {
        qualityEvidence = `路由 ${text(event.payload.routeEntryId)}`;
      }
      if (event.eventType === 'canvas_run.quality_selection_completed') {
        const selected = Array.isArray(event.payload.selectedArtifactIds) ? event.payload.selectedArtifactIds.length : 0;
        const rejected = Array.isArray(event.payload.rejectedArtifactIds) ? event.payload.rejectedArtifactIds.length : 0;
        qualityEvidence = `选中 ${selected} · 淘汰 ${rejected}`;
      }
      if (event.eventType === 'canvas_run.candidate_selection_completed') {
        const selected = Array.isArray(event.payload.selectedArtifactIds) ? event.payload.selectedArtifactIds.length : 0;
        const rejected = Array.isArray(event.payload.notSelectedArtifactIds) ? event.payload.notSelectedArtifactIds.length : 0;
        const confidence = typeof event.payload.confidence === 'number' ? ` · ${Math.round(event.payload.confidence * 100)}%` : ' · 人工';
        qualityEvidence = `选中 ${selected} · 未选 ${rejected}${confidence}`;
      }
      if (event.eventType === 'canvas_run.step_retry_scheduled') {
        recoveryEvidence = firstText(event.payload, ['strategy']) || recoveryEvidence || '同配置重试';
      }
      if (event.eventType === 'canvas_run.step_recovery_scheduled') {
        const action = recoveryActionLabel(firstText(event.payload, ['action']));
        const delayMs = Number(event.payload.retryDelayMs || 0);
        recoveryEvidence = delayMs > 0 ? `${action} · ${Math.ceil(delayMs / 1000)} 秒后` : action;
      }
      if (event.eventType === 'canvas_run.prompt_rewrite_started') {
        recoveryEvidence = '提示词审核改写中';
      }
      if (event.eventType === 'canvas_run.prompt_rewrite_applied') {
        const changeCount = Number(event.payload.changeCount || 0);
        recoveryEvidence = changeCount > 0 ? `提示词已改写 · ${changeCount} 处` : '提示词已改写';
      }
      if (event.eventType === 'canvas_run.step_approval_requested') {
        recoveryEvidence = firstText(event.payload, ['actionType']) || recoveryEvidence || '备用模型';
      }
    }

    return {
      step,
      status,
      attempt,
      provider,
      model,
      inputEvidence,
      qualityEvidence,
      recoveryEvidence,
      reason,
      updatedAt: stepEvents.at(-1)?.createdAt || null,
    };
  });
}

export function buildCanvasRunFailureDiagnostic(run: CanvasRunRecord, events: CanvasRunEvent[]): CanvasRunFailureDiagnostic | null {
  const reversedEvents = [...events].reverse();
  const isFailure = (event: CanvasRunEvent) => eventStatus(event) === 'failed' || /(?:failed|model_unavailable|budget_exceeded)$/.test(event.eventType);
  const failedEvent = reversedEvents.find((event) => isFailure(event) && run.planSnapshot.steps.some((step) => eventMatchesStep(event, step)))
    || reversedEvents.find(isFailure);
  if (!failedEvent) return null;
  const stepIndex = run.planSnapshot.steps.findIndex((step) => eventMatchesStep(failedEvent, step));
  const step = stepIndex >= 0 ? run.planSnapshot.steps[stepIndex] : null;
  const code = firstText(failedEvent.payload, ['code', 'failureClass', 'reason']) || failedEvent.eventType.replace(/^canvas_run\./, '');
  const configuration = step?.configuration || {};
  return projectCanvasRunFailureDiagnostic({
    code,
    eventType: failedEvent.eventType,
    message: firstText(failedEvent.payload, ['message', 'error']),
    reason: firstText(failedEvent.payload, ['reason']),
    failureCategory: firstText(failedEvent.payload, ['failureCategory', 'failureClass']),
    providerDiagnostic: firstText(failedEvent.payload, ['providerDiagnostic']),
    waitReason: firstText(failedEvent.payload, ['waitReason']),
    runId: run.id,
    runStepId: step?.id || failedEvent.runStepKey || failedEvent.runStepId,
    nodeId: step?.nodeId || failedEvent.nodeId,
    nodeType: step?.nodeType || firstText(failedEvent.payload, ['nodeType']),
    stepNumber: stepIndex >= 0 ? stepIndex + 1 : undefined,
    providerName: firstText(failedEvent.payload, ['providerName']) || firstText(configuration, ['providerName', 'providerId']),
    modelName: firstText(failedEvent.payload, ['modelName']) || firstText(configuration, ['modelName', 'modelId', 'modelRecordId']),
    taskId: firstText(failedEvent.payload, ['taskId']),
    requestId: firstText(failedEvent.payload, ['requestId']),
    upstreamHttpStatus: failedEvent.payload.upstreamHttpStatus,
  });
}

export function buildCanvasRunAnalysisView(run: CanvasRunRecord, events: CanvasRunEvent[]): CanvasRunAnalysisView | null {
  const analysis = run.planSnapshot.agentAnalysis || object(run.configurationSnapshot.agentAnalysis);
  if (!analysis || !['completed', 'degraded'].includes(text(analysis.status))) return null;
  const labels = new Map(run.planSnapshot.steps.map((step) => [step.id, canvasRunStepDisplayName(step)]));
  const completedLayers = new Set(events
    .filter((event) => event.eventType === 'canvas_run.execution_layer_completed')
    .map((event) => Number(event.payload.layerIndex))
    .filter(Number.isInteger));
  const activeEvent = [...events].reverse().find((event) => (
    event.eventType === 'canvas_run.execution_layer_started' && !completedLayers.has(Number(event.payload.layerIndex))
  ));
  const concurrencyGroups = Array.isArray(analysis.concurrencyGroups) ? analysis.concurrencyGroups : [];
  const serialConstraints = Array.isArray(analysis.serialConstraints) ? analysis.serialConstraints : [];
  const risks = Array.isArray(analysis.risks) ? analysis.risks : [];
  return {
    status: text(analysis.status) as CanvasRunAnalysisView['status'],
    summary: text(analysis.summary),
    concurrencyGroups: concurrencyGroups.map((value) => object(value)).map((group) => ({
      labels: Array.isArray(group.stepIds) ? group.stepIds.map((stepId) => labels.get(text(stepId)) || text(stepId)).filter(Boolean) : [],
      reason: text(group.reason),
    })),
    serialConstraints: serialConstraints.map((value) => object(value)).map((constraint) => ({
      before: labels.get(text(constraint.beforeStepId)) || text(constraint.beforeStepId),
      after: labels.get(text(constraint.afterStepId)) || text(constraint.afterStepId),
      reason: text(constraint.reason),
    })),
    risks: risks.map(text).filter(Boolean),
    recommendedMaximumParallelism: Number(analysis.recommendedMaximumParallelism || 1),
    estimatedRequestCount: Number(analysis.estimatedRequestCount || 0),
    activeLayer: activeEvent ? Number(activeEvent.payload.layerIndex) : null,
    layerCount: Number(analysis.deterministicLayerCount || run.planSnapshot.executionLayers?.length || 0),
    degradationReason: text(analysis.degradationReason),
  };
}

function eventMatchesStep(event: CanvasRunEvent, step: CanvasRunPlanStep) {
  return event.runStepKey === step.id || event.nodeId === step.nodeId || event.runStepId === step.id;
}

export function buildCanvasRunPlanSections(run: CanvasRunRecord, views: CanvasRunStepView[]): CanvasRunPlanSection[] {
  const sections = [...run.planSnapshot.groups]
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      id: group.id,
      label: group.name || `分组 ${group.order + 1}`,
      order: group.order,
      skipped: group.skipped,
      mode: group.mode || 'serial',
      steps: views.filter((view) => view.step.groupId === group.id),
    }))
    .filter((section) => section.steps.length > 0);
  const ungrouped = views.filter((view) => !view.step.groupId);
  if (ungrouped.length > 0) sections.push({ id: 'ungrouped', label: '未分组步骤', order: sections.length, skipped: false, mode: 'serial', steps: ungrouped });
  return sections;
}

export function canvasRunEventLabel(eventType: string): string {
  const suffix = eventType.replace(/^canvas_run\./, '');
  const labels: Record<string, string> = {
    created: '运行计划已创建', start: '开始托管', pause: '已暂停', resume: '继续运行', cancel: '已取消', retry: '重新尝试',
    'step_dispatched': '步骤已派发', 'step_succeeded': '步骤已完成', 'step_failed': '步骤失败',
    'step_retry_scheduled': '步骤准备重试', 'step_approval_requested': '步骤等待审批',
    'step_recovery_scheduled': '步骤恢复已安排', 'prompt_rewrite_started': '提示词审核改写已开始',
    'prompt_rewrite_applied': '提示词审核改写已应用',
    'quality_evaluation_started': '开始质量评估', 'quality_evaluation_dispatched': '质量评估已派发',
    'quality_selection_completed': '质量选择完成', succeeded: '运行已完成', failed: '运行失败',
    'candidate_selection_waiting': '等待人工选择', 'candidate_evaluation_started': 'AI 候选评估已开始',
    'candidate_selection_manual_required': '低置信度转人工', 'candidate_selection_manual_override': '人工选择已覆盖',
    'candidate_selection_completed': '候选选择完成', 'step_skipped_by_selection': '未选候选下游已裁剪',
    'analysis_started': 'AI 链路分析已开始', 'analysis_completed': 'AI 链路分析已完成', 'analysis_degraded': 'AI 链路分析已降级',
    'execution_layer_started': '执行层已开始', 'execution_layer_completed': '执行层已完成',
  };
  return labels[suffix] || suffix.replaceAll('_', ' ');
}

function recoveryActionLabel(action: string) {
  const labels: Record<string, string> = {
    retry_same_configuration: '同配置重试',
    apply_parameter_repair: '参数修复后重试',
    switch_generation_model: '切换兼容模型',
    rewrite_prompt_for_review: '提示词审核改写',
  };
  return labels[action] || action || '恢复处理中';
}

export function canvasRunBudgetItems(snapshot: Record<string, unknown>): Array<{ label: string; value: string }> {
  const candidates: Array<[string, string[]]> = [
    ['任务上限', ['maxTasks', 'taskLimit']],
    ['成本上限', ['maxCost', 'costLimit']],
    ['时长上限', ['maxDurationMs', 'timeoutMs']],
    ['Token 上限', ['maxTokens', 'tokenBudget']],
  ];
  return candidates.flatMap(([label, keys]) => {
    const value = firstText(snapshot, keys);
    if (!value || !isVisibleLimit(value)) return [];
    const formatted = label === '时长上限' ? `${Math.round(Number(value) / 1000)} 秒` : value;
    return [{ label, value: formatted }];
  });
}

function isVisibleLimit(value: string) {
  const normalized = value.toLowerCase();
  if (['unlimited', 'none', 'infinite', 'infinity', '不限', '无限'].includes(normalized)) return false;
  const numeric = Number(value);
  return !Number.isFinite(numeric) || numeric > 0;
}
