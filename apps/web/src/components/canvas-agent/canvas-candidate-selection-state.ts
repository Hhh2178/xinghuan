import type { CanvasRunEvent } from './canvas-run-api';

export function isCandidateEvaluationActive(
  latestEvaluation: CanvasRunEvent | undefined,
  latestCompletion: CanvasRunEvent | undefined,
  terminal: boolean,
) {
  return !terminal && Boolean(latestEvaluation && (!latestCompletion || latestEvaluation.sequence > latestCompletion.sequence));
}
