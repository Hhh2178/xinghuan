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

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);

export function useCanvasRunProjection(canvasId: string | null, initialRunId?: string) {
  const [run, setRun] = useState<CanvasRunRecord | null>(null);
  const [events, setEvents] = useState<CanvasRunEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [streamConnected, setStreamConnected] = useState(false);
  const runId = run?.id || initialRunId || '';

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

  const create = useCallback(async (scope: CanvasRunRecord['runScope'] = 'canvas', configuration?: Record<string, unknown>) => {
    if (!canvasId) throw new Error('请先打开画布');
    setBusy(true);
    setError('');
    try {
      const next = await createCanvasRun({ canvasId, runScope: scope, configuration });
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
  }, [canvasId]);

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
