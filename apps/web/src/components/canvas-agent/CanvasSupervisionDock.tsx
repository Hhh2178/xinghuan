import { Bot, Minus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  const projection = useCanvasRunProjection(props.canvasId, initialRunId);
  const runStatus = projection.run?.status || '';
  const active = ['planning', 'awaiting_approval', 'queued', 'running', 'paused'].includes(runStatus);
  const alert = Boolean(projection.error) || runStatus === 'failed' || (active && !projection.streamConnected && Boolean(projection.run));

  useEffect(() => setInitialRunId(''), [props.canvasId]);

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
      <CanvasRunSupervisor canvasId={props.canvasId} projection={projection} />
    </aside>
  );
}
