import { describe, expect, it } from 'vitest';

import { buildCanvasRunNodeProjection } from './canvas-run-node-projection';

describe('canvas run node projection', () => {
  it('projects persisted step state and generation batch progress onto the matching canvas node', () => {
    expect(buildCanvasRunNodeProjection({
      run: { status: 'running', planSnapshot: { canvasId: 'canvas-1', canvasRevision: 1, groups: [], steps: [{ id: 'step-1', nodeId: 'image-1', nodeType: 'image', groupId: null, dependsOn: [], skipped: false, configuration: { executionPayload: { generationCount: 3 } } }] } },
      events: [{ id: 'event-1', runId: 'run-1', runStepId: 'step-1', nodeId: 'image-1', sequence: 1, eventType: 'canvas_run.step_dispatched', payload: { generationCount: 3, providerRequestCount: 1 }, createdAt: 1 }],
    })).toEqual({ 'image-1': { status: 'running', label: '运行中 1/3' } });
  });
});
