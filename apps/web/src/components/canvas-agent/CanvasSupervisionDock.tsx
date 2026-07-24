import { Bot, Minus, Settings, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { normalizeWorkflowDocuments, type WorkflowDocument, type WorkflowStageDefinition, type WorkflowSupervisionSettings } from '@xinghuan/shared';
import * as api from '../../services/api';
import { CanvasRunSupervisor } from './CanvasRunSupervisor';
import { WorkflowStageEditor } from './WorkflowStageEditor';
import { WorkflowSupervisionSettingsDrawer } from './WorkflowSupervisionSettingsDrawer';
import { CANVAS_RUN_STATUS_LABEL } from './canvas-run-view-model';
import { listCanvasWorkflowRuns, type CanvasRunRecord } from './canvas-run-api';
import { useCanvasRunProjection } from './useCanvasRunProjection';
import { buildWorkflowSupervisionReadiness } from './workflow-supervision-readiness';

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
  const [canvasNodes, setCanvasNodes] = useState<Node[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<Edge[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [runIdsByWorkflow, setRunIdsByWorkflow] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [oneTimeSettingsByWorkflow, setOneTimeSettingsByWorkflow] = useState<Record<string, WorkflowSupervisionSettings>>({});
  const [overviewRuns, setOverviewRuns] = useState<CanvasRunRecord[]>([]);
  const projection = useCanvasRunProjection(props.canvasId, selectedWorkflowId, initialRunId || runIdsByWorkflow[selectedWorkflowId]);
  const runStatus = projection.run?.status || '';
  const active = ['planning', 'awaiting_approval', 'queued', 'running', 'paused'].includes(runStatus);
  const alert = Boolean(projection.error) || runStatus === 'failed' || (active && !projection.streamConnected && Boolean(projection.run));

  useEffect(() => {
    setInitialRunId('');
    setRunIdsByWorkflow({});
    setSettingsOpen(false);
    setOneTimeSettingsByWorkflow({});
    setOverviewRuns([]);
    if (!props.canvasId) {
      setWorkflows([]);
      setCanvasNodes([]);
      setCanvasEdges([]);
      setSelectedWorkflowId('');
      return;
    }
    void api.getCanvasData(props.canvasId).then((data) => {
      const next = normalizeWorkflowDocuments(data.workflows);
      setWorkflows(next);
      setCanvasNodes(Array.isArray(data.nodes) ? data.nodes as Node[] : []);
      setCanvasEdges(Array.isArray(data.edges) ? data.edges as Edge[] : []);
      setSelectedWorkflowId((current) => next.some((workflow) => workflow.id === current) ? current : next[0]?.id || '');
    }).catch(() => {
      setWorkflows([]);
      setCanvasNodes([]);
      setCanvasEdges([]);
      setSelectedWorkflowId('');
    });
  }, [props.canvasId]);

  useEffect(() => {
    if (!props.open || !props.canvasId) return;
    let cancelled = false;
    const refreshOverview = () => void listCanvasWorkflowRuns(props.canvasId!)
      .then((runs) => {
        if (cancelled) return;
        setOverviewRuns(runs);
        setRunIdsByWorkflow(Object.fromEntries(runs.flatMap((run) => run.workflowId ? [[run.workflowId, run.id]] : [])));
      })
      .catch(() => undefined);
    refreshOverview();
    const timer = window.setInterval(refreshOverview, 5_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [props.canvasId, props.open, projection.run?.id, projection.run?.status]);

  useEffect(() => {
    const handleWorkflows = (event: Event) => {
      const detail = (event as CustomEvent<{ canvasId?: string; workflows?: unknown; nodes?: Node[]; edges?: Edge[] }>).detail;
      if (detail?.canvasId !== props.canvasId) return;
      const next = normalizeWorkflowDocuments(detail.workflows);
      setWorkflows(next);
      if (Array.isArray(detail.nodes)) setCanvasNodes(detail.nodes);
      if (Array.isArray(detail.edges)) setCanvasEdges(detail.edges);
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

  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId);
  const readiness = buildWorkflowSupervisionReadiness({
    workflow: selectedWorkflow,
    nodes: canvasNodes,
    edges: canvasEdges,
  });
  const updateStages = (stages: WorkflowStageDefinition[]) => {
    if (!selectedWorkflow || !props.canvasId) return;
    setWorkflows((current) => current.map((workflow) => workflow.id === selectedWorkflow.id ? {
      ...workflow,
      revision: workflow.revision + 1,
      stages,
    } : workflow));
    window.dispatchEvent(new CustomEvent('penguin:update-workflow-stages', {
      detail: { canvasId: props.canvasId, workflowId: selectedWorkflow.id, stages },
    }));
  };

  return (
    <aside className="canvas-supervision-panel" aria-label="AI 托管面板" data-alert={alert ? 'true' : 'false'}>
      <header className="canvas-supervision-panel__header">
        <div className="canvas-supervision-panel__title">
          <span><Bot size={17} /></span>
          <div><strong>AI 托管</strong><small><i data-state={alert ? 'alert' : active ? 'active' : 'idle'} />{projection.run ? CANVAS_RUN_STATUS_LABEL[projection.run.status] : '当前画布'}</small></div>
        </div>
        <div className="canvas-supervision-panel__actions">
          <button type="button" aria-pressed={settingsOpen} disabled={!selectedWorkflow} onClick={() => setSettingsOpen((current) => !current)} title="运行设置"><Settings size={15} /></button>
          <button type="button" onClick={() => props.onOpenChange(false)} title="最小化"><Minus size={15} /></button>
          <button type="button" onClick={() => props.onOpenChange(false)} title="关闭"><X size={15} /></button>
        </div>
      </header>
      <div className="canvas-supervision-panel__body" data-settings-open={settingsOpen ? 'true' : 'false'}>
        <div className="canvas-supervision-panel__main">
          <div className="canvas-run-supervisor__options">
            <label>
              <span>托管目标</span>
              <select aria-label="托管目标工作流" value={selectedWorkflowId} onChange={(event) => { setInitialRunId(''); setSettingsOpen(false); setSelectedWorkflowId(event.target.value); }}>
                {workflows.length === 0 ? <option value="">当前画布没有工作流区域</option> : null}
                {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name} · r{workflow.revision}</option>)}
              </select>
            </label>
          </div>
          {!selectedWorkflow ? <section className="canvas-supervision-empty" aria-label="AI 托管使用说明">
            <strong>先创建一个工作流区域</strong>
            <p>AI 托管管理的是工作流区域，不是画布上的旧 Agent 托管节点。</p>
            <ol><li>用工作流区域框选要运行的节点。</li><li>需要跨区域传值时，在边界放置工作流输入和工作流输出。</li><li>返回这里，选择工作流并生成运行计划。</li></ol>
          </section> : null}
          {selectedWorkflow && !projection.run ? <section className="canvas-supervision-readiness" data-state={readiness.state} aria-label="AI 托管运行前检查">
            <header><strong>{readiness.state === 'blocked' ? '运行前检查发现问题' : '运行前检查'}</strong><small>{readiness.state === 'blocked' ? '需要修复' : '等待服务端确认'}</small></header>
            {readiness.items.map((item) => <div key={`${item.code}:${item.nodeId || 'workflow'}`}>
              <strong>{item.nodeId ? `节点 ${item.nodeId}` : '工作流'}</strong>
              <span>{item.message}</span>
              <p>{item.action}</p>
            </div>)}
          </section> : null}
          {overviewRuns.length ? <div className="canvas-run-overview" aria-label="工作流运行概览">
            {overviewRuns.map((run) => {
              const workflow = workflows.find((item) => item.id === run.workflowId);
              return <button
                type="button"
                key={run.id}
                data-selected={run.workflowId === selectedWorkflowId ? 'true' : 'false'}
                data-status={run.status}
                onClick={() => { if (run.workflowId) { setInitialRunId(run.id); setSelectedWorkflowId(run.workflowId); } }}
              ><i /><span>{workflow?.name || '工作流'}</span><small>{CANVAS_RUN_STATUS_LABEL[run.status]}</small></button>;
            })}
          </div> : null}
          {selectedWorkflow && !projection.run ? <WorkflowStageEditor
            canvasId={props.canvasId}
            workflow={selectedWorkflow}
            nodes={canvasNodes}
            edges={canvasEdges}
            locked={projection.busy}
            onChange={updateStages}
          /> : null}
          <CanvasRunSupervisor
            canvasId={props.canvasId}
            workflowId={selectedWorkflowId}
            projection={projection}
            oneTimeSettings={oneTimeSettingsByWorkflow[selectedWorkflowId]}
            onOneTimeConsumed={() => setOneTimeSettingsByWorkflow((current) => {
              const next = { ...current };
              delete next[selectedWorkflowId];
              return next;
            })}
          />
        </div>
        {settingsOpen && selectedWorkflow ? <WorkflowSupervisionSettingsDrawer
          canvasId={props.canvasId}
          workflow={selectedWorkflow}
          nodes={canvasNodes}
          activeRun={Boolean(projection.run && !projection.terminal)}
          onClose={() => setSettingsOpen(false)}
          onApplyOnce={(settings) => {
            setOneTimeSettingsByWorkflow((current) => ({ ...current, [selectedWorkflow.id]: settings }));
            setSettingsOpen(false);
          }}
          onRemembered={() => setOneTimeSettingsByWorkflow((current) => {
            const next = { ...current };
            delete next[selectedWorkflow.id];
            return next;
          })}
        /> : null}
      </div>
    </aside>
  );
}
