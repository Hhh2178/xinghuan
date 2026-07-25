import { ShieldCheck } from 'lucide-react';
import type { CanvasRunAnalysisView, CanvasRunPlanSection } from './canvas-run-view-model';
import { CANVAS_RUN_STEP_STATUS_LABEL, canvasRunStepDisplayName } from './canvas-run-view-model';

export function CanvasSupervisionPlanView(props: {
  analysis: CanvasRunAnalysisView | null;
  sections: CanvasRunPlanSection[];
  stepIndex: Map<string, number>;
}) {
  const nodeNames = new Map(props.sections.flatMap((section) => section.steps.map((view) => [view.step.nodeId, canvasRunStepDisplayName(view.step)] as const)));
  return <div className="canvas-supervision-workspace" data-view="plan">
    {props.analysis ? <section className="canvas-run-analysis" data-status={props.analysis.status} aria-label="AI 链路分析">
      <header><div><strong>AI 链路分析</strong><small>{props.analysis.status === 'completed' ? '已验证' : '确定性降级'}</small></div><span>{props.analysis.recommendedMaximumParallelism} 并发</span></header>
      <p>{props.analysis.summary}</p>
      <div className="canvas-run-analysis__facts">
        <span><small>当前执行层</small>{props.analysis.activeLayer === null ? '未开始' : `${props.analysis.activeLayer + 1} / ${props.analysis.layerCount}`}</span>
        {props.analysis.estimatedRequestCount > 0 ? <span><small>预计请求</small>{props.analysis.estimatedRequestCount}</span> : null}
      </div>
      {props.analysis.concurrencyGroups.length ? <div className="canvas-run-analysis__section"><strong>并发组</strong>{props.analysis.concurrencyGroups.map((group, index) => <p key={`parallel-${index}`}><b>{group.labels.join(' + ')}</b>{group.reason}</p>)}</div> : null}
      {props.analysis.serialConstraints.length ? <div className="canvas-run-analysis__section"><strong>串行约束</strong>{props.analysis.serialConstraints.map((constraint, index) => <p key={`serial-${index}`}><b>{constraint.before} → {constraint.after}</b>{constraint.reason}</p>)}</div> : null}
      {props.analysis.risks.length ? <div className="canvas-run-analysis__section"><strong>风险</strong>{props.analysis.risks.map((risk, index) => <p key={`risk-${index}`}>{risk}</p>)}</div> : null}
      {props.analysis.degradationReason ? <code>{props.analysis.degradationReason}</code> : null}
    </section> : null}

    <div className="canvas-run-plan">
      {props.sections.map((section) => <section className="canvas-run-plan__group" key={section.id} data-skipped={section.skipped ? 'true' : 'false'}>
        <header><strong>{section.label}</strong><small>顺序 {section.order + 1} · {section.mode === 'parallel' ? '并行' : '串行'} · {section.steps.length} 步</small></header>
        {section.steps.map((view) => {
          const dependencies = view.step.dependsOn.map((nodeId) => nodeNames.get(nodeId)).filter(Boolean) as string[];
          const missingDependencies = Math.max(0, view.step.dependsOn.length - dependencies.length);
          const dependencyText = dependencies.length > 0
            ? `依赖 ${dependencies.join('、')}${missingDependencies ? ` 等 ${view.step.dependsOn.length} 个上游节点` : ''}`
            : view.step.dependsOn.length > 0 ? `依赖 ${view.step.dependsOn.length} 个上游节点` : '组内起点';
          return <div className="canvas-run-plan__step" key={view.step.id} data-status={view.status}>
            <span className="canvas-run-plan__index">{String(props.stepIndex.get(view.step.id) || 0).padStart(2, '0')}</span>
            <span className="canvas-run-plan__content">
              <strong>{canvasRunStepDisplayName(view.step)}<em data-status={view.status}>{CANVAS_RUN_STEP_STATUS_LABEL[view.status]}</em></strong>
              <small>{dependencyText}</small>
              {view.provider || view.model ? <small>路由 {view.provider || '已发布 Provider'}{view.model ? ` / ${view.model}` : ''}</small> : null}
              <span className="canvas-run-plan__evidence">
                {view.attempt ? <b>尝试 {view.attempt}</b> : null}
                {view.inputEvidence ? <b>输入 {view.inputEvidence}</b> : null}
                {view.qualityEvidence ? <b>质量 {view.qualityEvidence}</b> : null}
                {view.recoveryEvidence ? <b>恢复 {view.recoveryEvidence}</b> : null}
              </span>
              {view.reason ? <p>{view.reason}</p> : null}
            </span>
            <ShieldCheck size={15} />
          </div>;
        })}
      </section>)}
    </div>
  </div>;
}
