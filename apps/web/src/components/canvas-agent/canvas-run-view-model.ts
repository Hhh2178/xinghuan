import type { CanvasRunEvent, CanvasRunPlanStep, CanvasRunRecord, CanvasRunStatus } from './canvas-run-api';

export type CanvasRunStepViewStatus =
  | 'waiting'
  | 'running'
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

export interface CanvasRunFailureDiagnostic {
  nodeNumber: number;
  nodeType: string;
  category: string;
  impact: string;
  recovery: string;
  technical: string;
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
  running: '运行中',
  retrying: '重试中',
  approval: '待审批',
  succeeded: '已完成',
  failed: '失败',
  skipped: '已跳过',
};

const STEP_STATUS_BY_EVENT: Array<[RegExp, CanvasRunStepViewStatus]> = [
  [/step_(?:succeeded)|quality_selection_completed$/, 'succeeded'],
  [/step_(?:failed|unsupported|model_unavailable)|budget_exceeded|quality_failed$/, 'failed'],
  [/step_(?:cancelled|skipped)$/, 'skipped'],
  [/step_approval_requested$/, 'approval'],
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
    if (status === 'queued' || status === 'running' || status === 'evaluating') return 'running';
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

export function buildCanvasRunStepViews(run: CanvasRunRecord, events: CanvasRunEvent[]): CanvasRunStepView[] {
  return run.planSnapshot.steps.map((step) => {
    const configuration = object(step.configuration);
    const stepEvents = events.filter((event) => eventMatchesStep(event, step)).sort((a, b) => a.sequence - b.sequence);
    let status: CanvasRunStepViewStatus = step.skipped ? 'skipped' : 'waiting';
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
  const failedEvent = [...events].reverse().find((event) => eventStatus(event) === 'failed' || /(?:failed|model_unavailable|budget_exceeded)$/.test(event.eventType));
  if (!failedEvent) return null;
  const stepIndex = run.planSnapshot.steps.findIndex((step) => eventMatchesStep(failedEvent, step));
  const step = stepIndex >= 0 ? run.planSnapshot.steps[stepIndex] : null;
  const code = firstText(failedEvent.payload, ['code', 'failureClass', 'reason']) || failedEvent.eventType.replace(/^canvas_run\./, '');
  const normalized = `${failedEvent.eventType} ${code}`.toLowerCase();
  let category = '执行失败';
  let recovery = '查看技术详情，修复节点配置后重试。';
  if (/model_unavailable|provider|model/.test(normalized)) {
    category = '模型不可用';
    recovery = '检查已发布模型或切换兼容候选后重试。';
  } else if (/network|rate|limit|timeout/.test(normalized)) {
    category = '网络或限流';
    recovery = '保持原配置重试；持续失败时检查服务商状态。';
  } else if (/budget|cost|duration/.test(normalized)) {
    category = '预算或时限';
    recovery = '调整下一次 Run 的预算或时限后重新创建计划。';
  } else if (/prompt|review|moderation/.test(normalized)) {
    category = '提示词审核';
    recovery = '检查审核结果并使用允许的低风险改写。';
  } else if (/input|parameter|invalid/.test(normalized)) {
    category = '输入参数';
    recovery = '修正工作流声明允许的参数后重新创建 Run。';
  }
  if (/model_record_repair_required/.test(normalized)) {
    category = '旧 Run 缺少模型记录';
    recovery = '当前草稿无法安全补全模型记录。请从最新工作流重新创建 Run。';
  }
  const technical = [
    code,
    firstText(failedEvent.payload, ['modelRecordId', 'providerId', 'taskId']),
  ].filter(Boolean).join(' · ');
  return {
    nodeNumber: stepIndex + 1,
    nodeType: step?.nodeType || firstText(failedEvent.payload, ['nodeType']) || '未知节点',
    category,
    impact: step ? '当前节点未完成，下游步骤尚未释放。' : '运行已停止，已完成结果保持可用。',
    recovery,
    technical,
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
    if (!value) return [];
    const formatted = label === '时长上限' ? `${Math.round(Number(value) / 1000)} 秒` : value;
    return [{ label, value: formatted }];
  });
}
