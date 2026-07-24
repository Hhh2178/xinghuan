import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Image as ImageIcon, Loader2, MousePointer2, Video } from 'lucide-react';

import {
  readCanvasRunCandidateSelections,
  selectCanvasRunCandidates,
  type CanvasRunEvent,
  type PendingCanvasRunCandidateSelection,
} from './canvas-run-api';
import { isCandidateEvaluationActive } from './canvas-candidate-selection-state';

export function CanvasCandidateSelectionPanel(props: {
  runId: string;
  events: CanvasRunEvent[];
  terminal: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [pending, setPending] = useState<PendingCanvasRunCandidateSelection[]>([]);
  const [selectedByStep, setSelectedByStep] = useState<Record<string, string[]>>({});
  const [busyStepId, setBusyStepId] = useState('');
  const [error, setError] = useState('');
  const runIdRef = useRef(props.runId);
  runIdRef.current = props.runId;
  const eventCursor = props.events.at(-1)?.sequence || 0;

  const load = useCallback(async () => {
    const requestedRunId = props.runId;
    try {
      const next = await readCanvasRunCandidateSelections(requestedRunId);
      if (runIdRef.current !== requestedRunId) return;
      setPending(next);
      setError('');
    } catch (nextError) {
      if (runIdRef.current !== requestedRunId) return;
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }, [props.runId]);

  useEffect(() => {
    setPending([]);
    setSelectedByStep({});
    setBusyStepId('');
    setError('');
  }, [props.runId]);

  useEffect(() => {
    void load();
  }, [eventCursor, load]);

  const latestEvaluation = useMemo(() => [...props.events].reverse().find((event) =>
    event.eventType === 'canvas_run.candidate_evaluation_started'), [props.events]);
  const latestCompletion = useMemo(() => [...props.events].reverse().find((event) =>
    event.eventType === 'canvas_run.candidate_selection_completed'), [props.events]);
  const evaluationActive = isCandidateEvaluationActive(latestEvaluation, latestCompletion, props.terminal);
  if (pending.length === 0 && !latestEvaluation && !latestCompletion && !error) return null;

  const toggle = (stepId: string, artifactId: string, maximum: number) => {
    setSelectedByStep((current) => {
      const selected = current[stepId] || [];
      const next = selected.includes(artifactId)
        ? selected.filter((id) => id !== artifactId)
        : selected.length < maximum ? [...selected, artifactId] : selected;
      return { ...current, [stepId]: next };
    });
  };

  const submit = async (selection: PendingCanvasRunCandidateSelection) => {
    const selected = selectedByStep[selection.stepId] || [];
    if (selected.length === 0) return;
    setBusyStepId(selection.stepId);
    setError('');
    try {
      await selectCanvasRunCandidates(props.runId, selection.stepId, selected);
      await props.onRefresh();
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusyStepId('');
    }
  };

  return (
    <section className="canvas-candidate-selection" aria-label="候选选择治理">
      <header><div><strong>候选选择</strong><small>运行时冻结候选与来源</small></div></header>
      {evaluationActive && latestEvaluation && pending.length === 0 ? <div className="canvas-candidate-selection__status"><Bot size={15} /><span><strong>AI 正在评估</strong><small>{Number(latestEvaluation.payload.candidateCount || 0)} 个候选</small></span></div> : null}
      {pending.map((selection) => {
        const selected = selectedByStep[selection.stepId] || [];
        return <article key={selection.stepId}>
          <div className="canvas-candidate-selection__heading">
            <span><MousePointer2 size={14} /><strong>等待人工选择</strong></span>
            <small>最多 {selection.maximum} 项</small>
          </div>
          {selection.criteria ? <p><b>标准</b>{selection.criteria}</p> : null}
          {selection.note ? <p><b>备注</b>{selection.note}</p> : null}
          <div className="canvas-candidate-selection__grid">
            {selection.candidates.map((candidate) => {
              const active = selected.includes(candidate.artifactId);
              return <button type="button" key={candidate.artifactId} data-active={active ? 'true' : 'false'} onClick={() => toggle(selection.stepId, candidate.artifactId, selection.maximum)}>
                <span className="canvas-candidate-selection__media">
                  {candidate.mediaKind === 'image'
                    ? <img src={candidate.fileUrl} alt="候选素材" />
                    : <video src={candidate.fileUrl} muted preload="metadata" />}
                  <i>{candidate.mediaKind === 'image' ? <ImageIcon size={12} /> : <Video size={12} />}{active ? <Check size={13} /> : null}</i>
                </span>
                <strong>{candidate.prompt || '未记录提示词'}</strong>
                <small>{candidate.providerId} / {candidate.modelRecordId}</small>
              </button>;
            })}
          </div>
          <footer>
            <span>已选 {selected.length} / {selection.maximum}</span>
            <button type="button" disabled={selected.length === 0 || busyStepId === selection.stepId} onClick={() => void submit(selection)}>
              {busyStepId === selection.stepId ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}确认选择
            </button>
          </footer>
        </article>;
      })}
      {latestCompletion ? <div className="canvas-candidate-selection__result">
        <Check size={14} />
        <span><strong>选择已完成</strong><small>选中 {arrayLength(latestCompletion.payload.selectedArtifactIds)} · 未选中 {arrayLength(latestCompletion.payload.notSelectedArtifactIds)}{typeof latestCompletion.payload.confidence === 'number' ? ` · 置信度 ${Math.round(latestCompletion.payload.confidence * 100)}%` : ' · 人工覆盖'}</small></span>
      </div> : null}
      {error ? <div className="canvas-candidate-selection__error">{error}</div> : null}
    </section>
  );
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}
