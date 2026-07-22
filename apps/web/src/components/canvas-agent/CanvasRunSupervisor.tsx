import { Ban, Check, CirclePause, CirclePlay, PlugZap, RefreshCw, RotateCcw, ShieldCheck, Workflow, X } from 'lucide-react';
import { useState } from 'react';
import { decideCanvasRunApproval } from './canvas-run-api';
import { useCanvasRunProjection } from './useCanvasRunProjection';

const STATUS_LABEL: Record<string, string> = {
  draft: '计划已生成', planning: '规划中', awaiting_approval: '等待确认', queued: '排队中', running: '运行中', paused: '已暂停', succeeded: '已完成', failed: '失败', cancelled: '已取消',
};

export function CanvasRunSupervisor({ canvasId, initialRunId }: { canvasId: string | null; initialRunId?: string }) {
  const projection = useCanvasRunProjection(canvasId, initialRunId);
  const [qualityEnabled, setQualityEnabled] = useState(false);
  const [selectionPolicy, setSelectionPolicy] = useState<'best' | 'top_k'>('best');
  const run = projection.run;
  const steps = run?.planSnapshot.steps || [];
  const groups = run?.planSnapshot.groups || [];
  const percent = projection.progress.total ? Math.round((projection.progress.completed / projection.progress.total) * 100) : 0;
  const resolvedApprovals = new Set(projection.events.filter((event) => /approval_(applied|declined)/.test(event.eventType)).map((event) => String(event.payload.approvalId || '')));
  const pendingApproval = [...projection.events].reverse().find((event) => event.eventType === 'canvas_run.step_approval_requested' && !resolvedApprovals.has(String(event.payload.approvalId || '')));

  const decideApproval = async (decision: 'approve' | 'reject') => {
    const approvalId = String(pendingApproval?.payload.approvalId || '');
    if (!run || !approvalId) return;
    await decideCanvasRunApproval(run.id, approvalId, decision);
    await projection.refresh();
  };

  return (
    <section className="canvas-run-supervisor" aria-label="Agent 托管运行">
      <div className="canvas-run-supervisor__summary">
        <div>
          <span className="canvas-run-supervisor__eyebrow"><Workflow size={13} /> 托管运行</span>
          <strong>{run ? STATUS_LABEL[run.status] || run.status : '尚未建立运行计划'}</strong>
          <p>{run ? `画布修订 ${run.canvasRevision}，${groups.length} 个分组，${steps.length} 个步骤` : '创建后将锁定画布修订、分组顺序和组内拓扑。'}</p>
        </div>
        <div className="canvas-run-supervisor__connection" data-connected={projection.streamConnected ? 'true' : 'false'}>
          <PlugZap size={13} />{projection.streamConnected ? '事件流在线' : '事件流待连接'}
        </div>
      </div>

      {run ? (
        <div className="canvas-run-supervisor__progress" aria-label={`已完成 ${percent}%`}>
          <span style={{ width: `${percent}%` }} />
          <small>{projection.progress.completed} / {projection.progress.total} 步骤</small>
        </div>
      ) : null}

      {!run ? <div className="canvas-run-supervisor__options">
        <label><input type="checkbox" checked={qualityEnabled} onChange={(event) => setQualityEnabled(event.target.checked)} /><span>自动质量优选</span></label>
        <select aria-label="质量选择策略" disabled={!qualityEnabled} value={selectionPolicy} onChange={(event) => setSelectionPolicy(event.target.value as 'best' | 'top_k')}>
          <option value="best">最佳单项</option>
          <option value="top_k">前两项</option>
        </select>
      </div> : null}
      <div className="canvas-run-supervisor__controls">
        {!run ? <button type="button" className="is-primary" disabled={projection.busy || !canvasId} onClick={() => void projection.create('canvas', { qualityEvaluationEnabled: qualityEnabled, selectionPolicy, selectionMaximum: selectionPolicy === 'best' ? 1 : 2 })}><CirclePlay size={15} />生成运行计划</button> : null}
        {run?.status === 'draft' ? <button type="button" className="is-primary" disabled={projection.busy} onClick={() => void projection.command('start')}><CirclePlay size={15} />开始托管</button> : null}
        {run && ['planning', 'queued', 'running'].includes(run.status) ? <button type="button" onClick={() => void projection.command('pause')}><CirclePause size={15} />暂停</button> : null}
        {run?.status === 'paused' ? <button type="button" className="is-primary" onClick={() => void projection.command('resume')}><CirclePlay size={15} />继续</button> : null}
        {run?.status === 'failed' ? <button type="button" onClick={() => void projection.command('retry')}><RotateCcw size={15} />重试</button> : null}
        {run && !projection.terminal ? <button type="button" className="is-danger" onClick={() => void projection.command('cancel')}><Ban size={15} />取消</button> : null}
        {run ? <button type="button" title="刷新权威状态" onClick={() => void projection.refresh()}><RefreshCw size={15} /></button> : null}
      </div>

      {projection.error ? <div className="canvas-run-supervisor__error">{projection.error}</div> : null}

      {pendingApproval ? (
        <div className="canvas-run-approval">
          <div><strong>需要确认备用生成模型</strong><p>当前节点已耗尽同配置重试。批准后仅使用 Run Plan 中锁定的备选项继续。</p></div>
          <button type="button" className="is-primary" onClick={() => void decideApproval('approve')}><Check size={14} />批准</button>
          <button type="button" onClick={() => void decideApproval('reject')}><X size={14} />拒绝</button>
        </div>
      ) : null}

      {run ? (
        <div className="canvas-run-supervisor__body">
          <div className="canvas-run-supervisor__section-title"><span>运行计划</span><small>只读权威投影</small></div>
          <div className="canvas-run-plan">
            {steps.map((step, index) => (
              <div className="canvas-run-plan__step" key={step.id} data-skipped={step.skipped ? 'true' : 'false'}>
                <span className="canvas-run-plan__index">{String(index + 1).padStart(2, '0')}</span>
                <span><strong>{step.nodeType}</strong><small>{step.groupId ? `分组 ${step.groupId}` : '未分组'}{step.dependsOn.length ? ` · ${step.dependsOn.length} 个依赖` : ''}</small></span>
                <ShieldCheck size={14} />
              </div>
            ))}
          </div>
          <div className="canvas-run-supervisor__section-title"><span>事件</span><small>{projection.events.length} 条</small></div>
          <div className="canvas-run-events">
            {projection.events.length === 0 ? <p>运行事件将在这里按服务端顺序出现。</p> : projection.events.slice(-20).reverse().map((event) => (
              <div key={event.id}><time>{new Date(event.createdAt).toLocaleTimeString()}</time><strong>{event.eventType}</strong></div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
