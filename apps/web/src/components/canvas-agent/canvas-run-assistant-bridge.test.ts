import { describe, expect, it } from 'vitest';
import { projectCanvasRunFailureDiagnostic } from '@xinghuan/shared';
import { buildCanvasRunAssistantContextDetail, CANVAS_RUN_FAILURE_ASSISTANT_DRAFT } from './canvas-run-assistant-bridge';

describe('Canvas Run assistant diagnostic bridge', () => {
  it('opens the assistant with one exact normalized diagnostic and a direct draft', () => {
    const diagnostic = projectCanvasRunFailureDiagnostic({
      code: 'RATE_LIMITED',
      runId: 'run-1',
      runStepId: 'step-2',
      nodeId: 'image-3',
      nodeType: 'image',
      providerName: 'RunningHub',
      modelName: 'RH Image',
      upstreamHttpStatus: 429,
    });

    const detail = buildCanvasRunAssistantContextDetail(diagnostic);

    expect(detail.open).toBe(true);
    expect(detail.draft).toBe(CANVAS_RUN_FAILURE_ASSISTANT_DRAFT);
    expect(detail.attachments).toHaveLength(1);
    expect(detail.attachments[0]).toMatchObject({
      id: 'canvas-run-failure-run-1-step-2',
      kind: 'node',
      payload: {
        source: 'canvas_run_error',
        runId: 'run-1',
        nodeId: 'image-3',
        nodeType: 'image',
        diagnostic,
      },
    });
    expect(detail.attachments[0]?.payload?.diagnostic).toEqual(diagnostic);
  });

  it('uses a bounded fallback identity when the diagnostic has no run location', () => {
    const diagnostic = projectCanvasRunFailureDiagnostic({ code: 'CANVAS_RUN_DISABLED' });
    expect(buildCanvasRunAssistantContextDetail(diagnostic, 'run-fallback').attachments[0]?.id)
      .toBe('canvas-run-failure-run-fallback-CANVAS_RUN_DISABLED');
  });
});
