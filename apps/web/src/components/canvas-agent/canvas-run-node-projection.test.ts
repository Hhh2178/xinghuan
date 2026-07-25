import { describe, expect, it } from 'vitest';

import { buildCanvasRunNodeProjection } from './canvas-run-node-projection';

describe('canvas run node projection', () => {
  it('projects detailed Run child state and materialized outputs into the matching node', () => {
    expect(buildCanvasRunNodeProjection({
      id: 'run-detail',
      status: 'running',
      planSnapshot: { canvasId: 'canvas-1', canvasRevision: 1, groups: [], steps: [] },
      runtimeSteps: [{
        authority: 'workflow_run',
        runId: 'run-detail',
        runStepId: 'step-1',
        nodeId: 'image-v3uy',
        nodeType: 'image',
        status: 'running',
        progress: '2/3',
        taskId: 'task-1',
        taskRuns: [
          { batchIndex: 0, status: 'success', generationArtifactIds: ['artifact-0'] },
          { batchIndex: 1, status: 'success', generationArtifactIds: ['artifact-1'] },
          { batchIndex: 2, status: 'running', generationArtifactIds: [] },
        ],
        outputs: {
          generationArtifactIds: ['artifact-0', 'artifact-1'],
          imageUrls: ['/files/output/0.png', '/files/output/1.png'],
          videoUrls: [],
          audioUrls: [],
        },
      }],
    } as any)).toMatchObject({
      'image-v3uy': {
        runId: 'run-detail',
        status: 'running',
        progress: '2/3',
        label: '运行中 2/3',
        taskRuns: [
          { batchIndex: 0, status: 'success' },
          { batchIndex: 1, status: 'success' },
          { batchIndex: 2, status: 'running' },
        ],
        outputs: { imageUrls: ['/files/output/0.png', '/files/output/1.png'] },
      },
    });
  });

  it('projects persisted step state and generation batch progress onto the matching canvas node', () => {
    expect(buildCanvasRunNodeProjection({
      run: { id: 'run-1', status: 'running', planSnapshot: { canvasId: 'canvas-1', canvasRevision: 1, groups: [], steps: [{ id: 'step-1', nodeId: 'image-1', nodeType: 'image', groupId: null, dependsOn: [], skipped: false, configuration: { executionPayload: { generationCount: 3 } } }] } },
      events: [{ id: 'event-1', runId: 'run-1', runStepId: 'step-1', nodeId: 'image-1', sequence: 1, eventType: 'canvas_run.step_dispatched', payload: { generationCount: 3, providerRequestCount: 1 }, createdAt: 1 }],
    })).toMatchObject({ 'image-1': { runId: 'run-1', status: 'running', progress: '1/3', label: '运行中 1/3' } });
  });

  it('starts an active batch at zero and advances from durable Worker progress events', () => {
    const run = { id: 'run-1', status: 'running' as const, planSnapshot: { canvasId: 'canvas-1', canvasRevision: 1, groups: [], steps: [{ id: 'step-1', nodeId: 'image-1', nodeType: 'image', groupId: null, dependsOn: [], skipped: false, configuration: { executionPayload: { generationCount: 3 } } }] } };
    expect(buildCanvasRunNodeProjection({ run, events: [{ id: 'dispatch', runId: 'run-1', runStepId: 'step-1', nodeId: 'image-1', sequence: 1, eventType: 'canvas_run.step_dispatched', payload: {}, createdAt: 1 }] }))
      .toMatchObject({ 'image-1': { status: 'running', progress: '0/3', label: '运行中 0/3' } });
    expect(buildCanvasRunNodeProjection({ run, events: [
      { id: 'dispatch', runId: 'run-1', runStepId: 'step-1', nodeId: 'image-1', sequence: 1, eventType: 'canvas_run.step_dispatched', payload: {}, createdAt: 1 },
      { id: 'progress', runId: 'run-1', runStepId: 'step-1', nodeId: 'image-1', sequence: 2, eventType: 'canvas_run.step_progress', payload: { completed: 2, generationCount: 3, providerRequestCount: 2 }, createdAt: 2 },
    ] }))
      .toMatchObject({ 'image-1': { status: 'running', progress: '2/3', label: '运行中 2/3' } });
  });
});
