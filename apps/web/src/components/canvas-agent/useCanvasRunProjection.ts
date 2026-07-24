import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [selectedRunId, setSelectedRunId] = useState(initialRunId || '');
  const [events, setEvents] = useState<CanvasRunEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [streamConnected, setStreamConnected] = useState(false);
  const lastInitialRunId = useRef(initialRunId || '');
  const runId = resolveCanvasRunTargetId(initialRunId, lastInitialRunId.current, selectedRunId, run?.id);
  const runIdRef = useRef(runId);
  runIdRef.current = runId;
  const visibleRun = run?.id === runId ? run : null;

  useEffect(() => {
    setRun(null);
    setSelectedRunId(initialRunId || '');
    lastInitialRunId.current = initialRunId || '';
    setEvents([]);
    setError('');
    setStreamConnected(false);
  }, [canvasId, workflowId]);

  useEffect(() => {
    const nextRunId = initialRunId || '';
    if (nextRunId === lastInitialRunId.current) return;
    lastInitialRunId.current = nextRunId;
    setSelectedRunId(nextRunId);
    setRun(null);
    setEvents([]);
    setError('');
    setStreamConnected(false);
  }, [initialRunId]);

  const refresh = useCallback(async () => {
    if (!runId) return;
    const requestedRunId = runId;
    try {
      const next = await readCanvasRun(requestedRunId);
      if (!canvasRunReadMatchesTarget(requestedRunId, runIdRef.current, next.id)) return;
      setRun(next);
      setError('');
    } catch (nextError) {
      if (runIdRef.current !== requestedRunId) return;
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }, [runId]);

  useEffect(() => {
    if (!runId || run?.id === runId) return;
    let cancelled = false;
    const requestedRunId = runId;
    void readCanvasRun(requestedRunId).then((next) => {
      if (cancelled || !canvasRunReadMatchesTarget(requestedRunId, runIdRef.current, next.id)) return;
      setRun(next);
    }).catch((nextError) => {
      if (!cancelled && runIdRef.current === requestedRunId) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      }
    });
    return () => { cancelled = true; };
  }, [runId, run?.id]);

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
      setSelectedRunId(next.id);
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
    const steps = visibleRun?.planSnapshot.steps || [];
    const completed = new Set(events.filter((event) => /succeeded|skipped/.test(event.eventType)).map((event) => event.runStepId).filter(Boolean));
    return { total: steps.length, completed: completed.size };
  }, [events, visibleRun]);

  return {
    run: visibleRun,
    events,
    busy,
    error,
    streamConnected,
    progress,
    terminal: visibleRun ? TERMINAL.has(visibleRun.status) : false,
    create,
    command,
    refresh,
  };
}

export function canvasRunReadMatchesTarget(requestedRunId: string, currentRunId: string, responseRunId: string) {
  return requestedRunId === currentRunId && responseRunId === requestedRunId;
}

export function resolveCanvasRunTargetId(
  initialRunId: string | undefined,
  lastInitialRunId: string,
  selectedRunId: string,
  loadedRunId: string | undefined,
) {
  const externalRunId = initialRunId || '';
  return externalRunId !== lastInitialRunId ? externalRunId : selectedRunId || loadedRunId || '';
}

export type CanvasRunProjection = ReturnType<typeof useCanvasRunProjection>;
