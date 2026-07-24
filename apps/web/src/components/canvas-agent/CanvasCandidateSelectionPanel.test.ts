import { describe, expect, it } from 'vitest';

import { isCandidateEvaluationActive } from './canvas-candidate-selection-state';
import type { CanvasRunEvent } from './canvas-run-api';

const event = (sequence: number): CanvasRunEvent => ({
  id: `event-${sequence}`,
  runId: 'run-1',
  runStepId: 'step-1',
  sequence,
  eventType: 'canvas_run.candidate_evaluation_started',
  payload: {},
  createdAt: sequence,
});

describe('candidate evaluation status', () => {
  it('does not project an active evaluation after the Run becomes terminal', () => {
    expect(isCandidateEvaluationActive(event(2), undefined, true)).toBe(false);
  });

  it('stays active only until a later completion event arrives', () => {
    expect(isCandidateEvaluationActive(event(2), undefined, false)).toBe(true);
    expect(isCandidateEvaluationActive(event(2), event(3), false)).toBe(false);
  });
});
