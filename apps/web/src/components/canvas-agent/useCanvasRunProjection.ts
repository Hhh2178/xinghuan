import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  commandCanvasRun,
  createCanvasRun,
  readCanvasRun,
  subscribeCanvasRunEvents,
  type CanvasRunCommand,
  type CanvasRunEvent,
  type CanvasRunRecord,
} from './canvas-run-api';
import type { WorkflowSupervisionSettings } from '@xinghuan/shared';

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);

export function useCanvasRunProjection(canvasId: string | null, workflowId: string, initialRunId?: string) {
  const [run, setRun] = useState<CanvasRunRecord | null>(null);
  const [events, setEvents] = useState<CanvasRunEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [streamConnected, setStreamConnected] = useState(false);
  const runId = run?.id || initialRunId || '';

  useEffect(() => {
    setRun(null);
    setEvents([]);
    setError('');
    setStreamConnected(false);
  }, [canvasId, workflowId]);

  const refresh = useCallback(async () => {
    if (!runId) return;
    try {
      setRun(await readCanvasRun(runId));
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }, [runId]);

  useEffect(() => {
    if (!initialRunId || run?.id === initialRunId) return;
    void readCanvasRun(initialRunId).then(setRun).catch(() => undefined);
  }, [initialRunId, run?.id]);

  useEffect(() => {
    if (!runId) return;
    setStreamConnected(true);
    return subscribeCanvasRunEvents(runId, {
      onEvent: (event) => {
        setStreamConnected(true);
        setEvents((current) => current.some((item) => item.id === event.id) ? current : [...current, event].slice(-300));
        void refresh();
      },
      onError: () => setStreamConnected(false),
    });
  }, [refresh, runId]);

  const create = useCallback(async (supervisionSettings?: Partial<WorkflowSupervisionSettings>) => {
    if (!canvasId) throw new Error('请先打开画布');
    setBusy(true);
    setError('');
    try {
      if (!workflowId) throw new Error('请先选择工作流');
      const next = await createCanvasRun({ canvasId, workflowId, runScope: 'workflow', supervisionSettings });
      setRun(next);
      setEvents([]);
      return next;
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError);
      setError(message);
      throw nextError;
    } finally {
      setBusy(false);
    }
  }, [canvasId, workflowId]);

  const command = useCallback(async (name: CanvasRunCommand) => {
    if (!runId) return;
    setBusy(true);
    setError('');
    try {
      setRun(await commandCanvasRun(runId, name));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }, [runId]);

  const progress = useMemo(() => {
    const steps = run?.planSnapshot.steps || [];
    const completed = new Set(events.filter((event) => /succeeded|skipped/.test(event.eventType)).map((event) => event.runStepId).filter(Boolean));
    return { total: steps.length, completed: completed.size };
  }, [events, run]);

  return {
    run,
    events,
    busy,
    error,
    streamConnected,
    progress,
    terminal: run ? TERMINAL.has(run.status) : false,
    create,
    command,
    refresh,
  };
}

export type CanvasRunProjection = ReturnType<typeof useCanvasRunProjection>;
