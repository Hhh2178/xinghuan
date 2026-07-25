import { AlertTriangle, Bot, Check, Clock3, X } from 'lucide-react';
import type { CanvasRunFailureDiagnostic } from '@xinghuan/shared';
import type { CanvasRunEvent, CanvasRunRecord } from './canvas-run-api';
import type { CanvasRunStepView } from './canvas-run-view-model';
import { CANVAS_RUN_STEP_STATUS_LABEL, canvasRunStepDisplayName } from './canvas-run-view-model';
import { CanvasCandidateSelectionPanel } from './CanvasCandidateSelectionPanel';

export function CanvasSupervisionRuntimeView(props: {
  run: CanvasRunRecord;
  events: CanvasRunEvent[];
  terminal: boolean;
  currentStep?: CanvasRunStepView;
  durationSeconds: number;
  budgetItems: Array<{ label: string; value: string }>;
  errorMessage: CanvasRunFailureDiagnostic | null;
  failure: CanvasRunFailureDiagnostic | null;
  failureDisplayName: string;
  pendingApproval?: CanvasRunEvent;
  onAnalyze: (diagnostic: CanvasRunFailureDiagnostic) => void;
  onApproval: (decision: 'approve' | 'reject') => void;
  onRefresh: () => Promise<void>;
}) {
  const hasSelector = props.run.planSnapshot.steps.some((step) => step.nodeType === 'smart-candidate-selector');
  return <div className="canvas-supervision-workspace" data-view="runtime">
    {props.currentStep ? <section className="canvas-supervision-current-step">
      <span>当前节点</span>
      <strong>{canvasRunStepDisplayName(props.currentStep.step)}</strong>
      <small>{CANVAS_RUN_STEP_STATUS_LABEL[props.currentStep.status]}</small>
    </section> : null}

    {props.errorMessage ? <section className="canvas-run-supervisor__error" aria-label="AI 托管错误说明">
      <strong>{props.errorMessage.title}</strong>
      <dl><div><dt>发生了什么</dt><dd>{props.errorMessage.observed}</dd></div><div><dt>可能原因</dt><dd>{props.errorMessage.likelyCause}</dd></div><div><dt>影响</dt><dd>{props.errorMessage.impact}</dd></div><div><dt>怎么处理</dt><dd>{props.errorMessage.action}</dd></div></dl>
      <span>{props.errorMessage.retryable ? '可在原因解除后按原计划重试' : '需要修复配置或新建运行计划'}</span>
      <button type="button" onClick={() => props.onAnalyze(props.errorMessage!)}><Bot size={14} />让 AI 助手分析</button>
      <details><summary>技术详情</summary><code>{props.errorMessage.technical.code}</code></details>
    </section> : null}

    {props.failure ? <section className="canvas-run-failure" aria-label="运行失败诊断">
      <header><AlertTriangle size={15} /><div><strong>{props.failureDisplayName || '未知节点'}</strong><small>{props.failure.title}</small></div></header>
      <dl><div><dt>发生了什么</dt><dd>{props.failure.observed}</dd></div><div><dt>可能原因</dt><dd>{props.failure.likelyCause}</dd></div><div><dt>影响</dt><dd>{props.failure.impact}</dd></div><div><dt>怎么处理</dt><dd>{props.failure.action}</dd></div></dl>
      <div className="canvas-run-failure__actions"><span>{props.failure.retryable ? '可重试' : '需先修复'}</span><button type="button" onClick={() => props.onAnalyze(props.failure!)}><Bot size={14} />让 AI 助手分析</button></div>
      <details><summary>技术详情</summary><code>{[props.failure.technical.code, props.failure.technical.taskId, props.failure.technical.requestId].filter(Boolean).join(' · ')}</code></details>
    </section> : null}

    {props.durationSeconds > 0 || props.budgetItems.length > 0 ? <div className="canvas-run-supervisor__facts">
      {props.durationSeconds > 0 ? <span><Clock3 size={13} />{props.durationSeconds} 秒</span> : null}
      {props.budgetItems.map((item) => <span key={item.label}><small>{item.label}</small>{item.value}</span>)}
    </div> : null}

    {props.pendingApproval ? <div className="canvas-run-approval">
      <div><strong>需要确认备用生成模型</strong><p>当前节点已耗尽同配置重试。批准后仅使用运行计划中锁定的备选项继续。</p></div>
      <button type="button" className="is-primary" onClick={() => props.onApproval('approve')}><Check size={14} />批准</button>
      <button type="button" onClick={() => props.onApproval('reject')}><X size={14} />拒绝</button>
    </div> : null}

    {hasSelector ? <CanvasCandidateSelectionPanel runId={props.run.id} events={props.events} terminal={props.terminal} onRefresh={props.onRefresh} /> : null}
  </div>;
}
