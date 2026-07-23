import { Bot, Minus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { normalizeWorkflowDocuments, type WorkflowDocument } from '@xinghuan/shared';
import * as api from '../../services/api';
import { CanvasRunSupervisor } from './CanvasRunSupervisor';
import { CANVAS_RUN_STATUS_LABEL } from './canvas-run-view-model';
import { useCanvasRunProjection } from './useCanvasRunProjection';

export interface CanvasSupervisionStatus {
  label: string;
  runStatus: string;
  active: boolean;
  alert: boolean;
  streamConnected: boolean;
}

export function CanvasSupervisionDock(props: {
  canvasId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: CanvasSupervisionStatus) => void;
}) {
  const [initialRunId, setInitialRunId] = useState('');
  const [workflows, setWorkflows] = useState<WorkflowDocument[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [runIdsByWorkflow, setRunIdsByWorkflow] = useState<Record<string, string>>({});
  const projection = useCanvasRunProjection(props.canvasId, selectedWorkflowId, initialRunId || runIdsByWorkflow[selectedWorkflowId]);
  const runStatus = projection.run?.status || '';
  const active = ['planning', 'awaiting_approval', 'queued', 'running', 'paused'].includes(runStatus);
  const alert = Boolean(projection.error) || runStatus === 'failed' || (active && !projection.streamConnected && Boolean(projection.run));

  useEffect(() => {
    setInitialRunId('');
    setRunIdsByWorkflow({});
    if (!props.canvasId) {
      setWorkflows([]);
      setSelectedWorkflowId('');
      return;
    }
    void api.getCanvasData(props.canvasId).then((data) => {
      const next = normalizeWorkflowDocuments(data.workflows);
      setWorkflows(next);
      setSelectedWorkflowId((current) => next.some((workflow) => workflow.id === current) ? current : next[0]?.id || '');
    }).catch(() => {
      setWorkflows([]);
      setSelectedWorkflowId('');
    });
  }, [props.canvasId]);

  useEffect(() => {
    const handleWorkflows = (event: Event) => {
      const detail = (event as CustomEvent<{ canvasId?: string; workflows?: unknown }>).detail;
      if (detail?.canvasId !== props.canvasId) return;
      const next = normalizeWorkflowDocuments(detail.workflows);
      setWorkflows(next);
      setSelectedWorkflowId((current) => next.some((workflow) => workflow.id === current) ? current : next[0]?.id || '');
    };
    window.addEventListener('penguin:canvas-workflows-changed', handleWorkflows);
    return () => window.removeEventListener('penguin:canvas-workflows-changed', handleWorkflows);
  }, [props.canvasId]);

  useEffect(() => {
    const workflowId = projection.run?.workflowId;
    if (!workflowId || !projection.run) return;
    setRunIdsByWorkflow((current) => current[workflowId] === projection.run!.id ? current : { ...current, [workflowId]: projection.run!.id });
    if (workflowId !== selectedWorkflowId) setSelectedWorkflowId(workflowId);
  }, [projection.run, selectedWorkflowId]);

  useEffect(() => {
    const openSupervisor = (event: Event) => {
      const detail = (event as CustomEvent<{ runId?: string }>).detail;
      setInitialRunId(detail?.runId || '');
      props.onOpenChange(true);
    };
    window.addEventListener('penguin:open-run-supervisor', openSupervisor);
    return () => window.removeEventListener('penguin:open-run-supervisor', openSupervisor);
  }, [props.onOpenChange]);

  useEffect(() => {
    props.onStatusChange({
      label: projection.run ? CANVAS_RUN_STATUS_LABEL[projection.run.status] : 'AI 托管',
      runStatus,
      active,
      alert,
      streamConnected: projection.streamConnected,
    });
  }, [active, alert, projection.run, projection.streamConnected, props.onStatusChange, runStatus]);

  useEffect(() => {
    if (props.open && projection.run) void projection.refresh();
  }, [props.open, projection.refresh, projection.run?.id]);

  if (!props.open) return null;

  return (
    <aside className="canvas-supervision-panel" aria-label="AI 托管面板" data-alert={alert ? 'true' : 'false'}>
      <header className="canvas-supervision-panel__header">
        <div className="canvas-supervision-panel__title">
          <span><Bot size={17} /></span>
          <div><strong>AI 托管</strong><small><i data-state={alert ? 'alert' : active ? 'active' : 'idle'} />{projection.run ? CANVAS_RUN_STATUS_LABEL[projection.run.status] : '当前画布'}</small></div>
        </div>
        <div className="canvas-supervision-panel__actions">
          <button type="button" onClick={() => props.onOpenChange(false)} title="最小化"><Minus size={15} /></button>
          <button type="button" onClick={() => props.onOpenChange(false)} title="关闭"><X size={15} /></button>
        </div>
      </header>
      <div className="canvas-run-supervisor__options">
        <label>
          <span>托管目标</span>
          <select aria-label="托管目标工作流" value={selectedWorkflowId} onChange={(event) => { setInitialRunId(''); setSelectedWorkflowId(event.target.value); }}>
            {workflows.length === 0 ? <option value="">当前画布没有工作流区域</option> : null}
            {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name} · r{workflow.revision}</option>)}
          </select>
        </label>
      </div>
      <CanvasRunSupervisor canvasId={props.canvasId} workflowId={selectedWorkflowId} projection={projection} />
    </aside>
  );
}
