import { useEffect, useState } from 'react';
import { Ban, CirclePause, CirclePlay, PlugZap, RefreshCw, RotateCcw, Workflow } from 'lucide-react';
import type { CanvasRunFailureDiagnostic, WorkflowSupervisionSettings } from '@xinghuan/shared';
import { decideCanvasRunApproval, type CanvasRunPlanStep } from './canvas-run-api';
import {
  buildCanvasRunAnalysisView,
  buildCanvasRunFailureDiagnostic,
  buildCanvasRunPlanSections,
  buildCanvasRunStepViews,
  canvasRunBudgetItems,
  canvasRunStepDisplayName,
  CANVAS_RUN_STATUS_LABEL,
} from './canvas-run-view-model';
import type { CanvasRunProjection } from './useCanvasRunProjection';
import { describeCanvasRunError } from './canvas-run-error-message';
import { buildCanvasRunAssistantContextDetail } from './canvas-run-assistant-bridge';
import { CanvasSupervisionRuntimeView } from './CanvasSupervisionRuntimeView';
import { CanvasSupervisionPlanView } from './CanvasSupervisionPlanView';
import { CanvasSupervisionEventView } from './CanvasSupervisionEventView';

type CanvasSupervisionView = 'runtime' | 'plan' | 'events';

export function CanvasRunSupervisor({ canvasId, workflowId, projection, oneTimeSettings, onOneTimeConsumed }: {
  canvasId: string | null;
  workflowId: string;
  projection: CanvasRunProjection;
  oneTimeSettings?: WorkflowSupervisionSettings;
  onOneTimeConsumed: () => void;
}) {
  const [activeView, setActiveView] = useState<CanvasSupervisionView>('runtime');
  const run = projection.run;
  const steps = run?.planSnapshot.steps || [];
  const groups = run?.planSnapshot.groups || [];
  const stepViews = run ? buildCanvasRunStepViews(run, projection.events) : [];
  const planSections = run ? buildCanvasRunPlanSections(run, stepViews) : [];
  const stepIndex = new Map(stepViews.map((view, index) => [view.step.id, index + 1]));
  const budgetItems = run ? canvasRunBudgetItems(run.budgetSnapshot) : [];
  const percent = projection.progress.total ? Math.round((projection.progress.completed / projection.progress.total) * 100) : 0;
  const resolvedApprovals = new Set(projection.events.filter((event) => /approval_(applied|declined)/.test(event.eventType)).map((event) => String(event.payload.approvalId || '')));
  const pendingApproval = [...projection.events].reverse().find((event) => event.eventType === 'canvas_run.step_approval_requested' && !resolvedApprovals.has(String(event.payload.approvalId || '')));
  const failure = run ? buildCanvasRunFailureDiagnostic(run, projection.events) : null;
  const errorMessage = projection.error ? describeCanvasRunError(projection.error) : null;
  const analysis = run ? buildCanvasRunAnalysisView(run, projection.events) : null;
  const currentStep = stepViews.find((view) => ['running', 'evaluating', 'selecting', 'retrying', 'approval'].includes(view.status));
  const failureDisplayName = failure ? diagnosticDisplayName(failure, steps) : '';

  useEffect(() => setActiveView('runtime'), [run?.id]);
  useEffect(() => {
    if (failure || errorMessage) setActiveView('runtime');
  }, [errorMessage?.technical.code, failure?.technical.code]);

  const decideApproval = async (decision: 'approve' | 'reject') => {
    const approvalId = String(pendingApproval?.payload.approvalId || '');
    if (!run || !approvalId) return;
    await decideCanvasRunApproval(run.id, approvalId, decision);
    await projection.refresh();
  };

  const sendDiagnosticToAssistant = (diagnostic: CanvasRunFailureDiagnostic) => {
    window.dispatchEvent(new CustomEvent('penguin:append-assistant-context', {
      detail: buildCanvasRunAssistantContextDetail(diagnostic, run?.id, diagnosticDisplayName(diagnostic, steps)),
    }));
  };

  return <section className="canvas-run-supervisor" aria-label="AI 托管运行">
    <div className="canvas-run-supervisor__summary">
      <div>
        <span className="canvas-run-supervisor__eyebrow"><Workflow size={13} /> 托管运行</span>
        <strong>{run ? CANVAS_RUN_STATUS_LABEL[run.status] : '尚未建立运行计划'}</strong>
        <p>{run ? `工作流修订 ${run.workflowRevision ?? '-'}，${groups.length} 个分组，${steps.length} 个步骤` : '创建后将锁定工作流修订、输入快照和区域内拓扑。'}</p>
      </div>
      <div className="canvas-run-supervisor__connection" data-connected={projection.streamConnected ? 'true' : 'false'}>
        <PlugZap size={13} />{projection.streamConnected ? '事件流在线' : '事件流待连接'}
      </div>
    </div>

    {run ? <div className="canvas-run-supervisor__progress" aria-label={`已完成 ${percent}%`}>
      <span style={{ width: `${percent}%` }} />
      <small>{projection.progress.completed} / {projection.progress.total} 步骤</small>
    </div> : null}

    {!run && oneTimeSettings ? <div className="canvas-run-supervisor__next-run">本次覆盖已就绪<span>仅下一次运行</span></div> : null}
    <div className="canvas-run-supervisor__controls">
      {!run ? <button type="button" className="is-primary" disabled={projection.busy || !canvasId || !workflowId} onClick={() => void projection.create(oneTimeSettings).then(onOneTimeConsumed).catch(() => undefined)}><CirclePlay size={15} />生成运行计划</button> : null}
      {run && projection.terminal ? <button type="button" className="is-primary" disabled={projection.busy || !canvasId || !workflowId} onClick={() => void projection.create(oneTimeSettings).then(onOneTimeConsumed).catch(() => undefined)}><CirclePlay size={15} />新建运行计划</button> : null}
      {run?.status === 'draft' ? <button type="button" className="is-primary" disabled={projection.busy} onClick={() => void projection.command('start')}><CirclePlay size={15} />开始托管</button> : null}
      {run && ['planning', 'queued', 'running'].includes(run.status) ? <button type="button" onClick={() => void projection.command('pause')}><CirclePause size={15} />暂停</button> : null}
      {run?.status === 'paused' ? <button type="button" className="is-primary" onClick={() => void projection.command('resume')}><CirclePlay size={15} />继续</button> : null}
      {run?.status === 'failed' ? <button type="button" disabled={projection.busy} title="使用当前运行的冻结快照重试" onClick={() => void projection.command('retry')}><RotateCcw size={15} />按原计划重试</button> : null}
      {run && !projection.terminal ? <button type="button" className="is-danger" onClick={() => void projection.command('cancel')}><Ban size={15} />取消</button> : null}
      {run ? <button type="button" title="刷新权威状态" onClick={() => void projection.refresh()}><RefreshCw size={15} /></button> : null}
    </div>

    {run ? <>
      <nav className="canvas-supervision-tabs" aria-label="AI 托管视图">
        <button type="button" aria-selected={activeView === 'runtime'} onClick={() => setActiveView('runtime')}>运行</button>
        <button type="button" aria-selected={activeView === 'plan'} onClick={() => setActiveView('plan')}>计划</button>
        <button type="button" aria-selected={activeView === 'events'} onClick={() => setActiveView('events')}>事件 <span>{projection.events.length}</span></button>
      </nav>
      {activeView === 'runtime' ? <CanvasSupervisionRuntimeView
        run={run}
        events={projection.events}
        terminal={projection.terminal}
        currentStep={currentStep}
        durationSeconds={Math.max(0, Math.round((run.updatedAt - run.createdAt) / 1000))}
        budgetItems={budgetItems}
        errorMessage={errorMessage}
        failure={failure}
        failureDisplayName={failureDisplayName}
        pendingApproval={pendingApproval}
        onAnalyze={sendDiagnosticToAssistant}
        onApproval={(decision) => void decideApproval(decision)}
        onRefresh={projection.refresh}
      /> : null}
      {activeView === 'plan' ? <CanvasSupervisionPlanView analysis={analysis} sections={planSections} stepIndex={stepIndex} /> : null}
      {activeView === 'events' ? <CanvasSupervisionEventView events={projection.events} steps={steps} /> : null}
    </> : null}
  </section>;
}

function diagnosticDisplayName(diagnostic: CanvasRunFailureDiagnostic, steps: CanvasRunPlanStep[]) {
  const step = steps.find((candidate) => candidate.id === diagnostic.location.runStepId || candidate.nodeId === diagnostic.location.nodeId);
  return step ? canvasRunStepDisplayName(step) : '';
}
