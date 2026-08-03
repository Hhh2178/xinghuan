import { describe, expect, it } from 'vitest';

import { buildAssistantFailureTarget, isAssistantFailureEvent } from './useAssistantSession.js';

describe('assistant failure context', () => {
  it('projects selected-node configuration and dependency impact without secrets', () => {
    const target = buildAssistantFailureTarget({
      node: {
        id: 'image-2',
        type: 'image',
        data: {
          prompt: 'cinematic harbor',
          backendModelId: 'model-1',
          providerParams: { seed: 42, apiKey: 'must-not-leak', nested: { token: 'must-not-leak' } },
          internalRuntimeJson: { secret: 'must-not-leak' },
        },
      } as any,
      edges: [
        { id: 'e1', source: 'text-1', target: 'image-2' },
        { id: 'e2', source: 'image-2', target: 'video-3' },
      ] as any,
      source: 'selected_node',
    });

    expect(target.attachment.payload).toMatchObject({
      nodeId: 'image-2',
      nodeType: 'image',
      upstreamNodeIds: ['text-1'],
      downstreamNodeIds: ['video-3'],
      configuration: { prompt: 'cinematic harbor', backendModelId: 'model-1', providerParams: { seed: 42 } },
    });
    expect(JSON.stringify(target)).not.toMatch(/must-not-leak|internalRuntimeJson|apiKey|token/);
  });

  it('recognizes normalized failed-step events without treating ordinary progress as failure', () => {
    expect(isAssistantFailureEvent({ eventType: 'canvas_run.step_failed', payload: {} } as any)).toBe(true);
    expect(isAssistantFailureEvent({ eventType: 'canvas_run.step_status_changed', payload: { status: 'failed' } } as any)).toBe(true);
    expect(isAssistantFailureEvent({ eventType: 'canvas_run.step_succeeded', payload: {} } as any)).toBe(false);
  });

  it('attaches the normalized diagnostic and bounded plan context without provider secrets', () => {
    const target = buildAssistantFailureTarget({
      node: { id: 'video-3', type: 'video', data: { prompt: 'slow push' } } as any,
      edges: [{ id: 'e1', source: 'image-2', target: 'video-3' }] as any,
      source: 'recent_failed_run',
      runId: 'run-1',
      event: {
        eventType: 'canvas_run.step_failed',
        runStepId: 'step-3',
        runStepKey: 'step-3',
        nodeId: 'video-3',
        payload: {
          code: 'UPSTREAM_REJECTED',
          failureCategory: 'provider',
          providerDiagnostic: 'Bearer private-key https://private.example/result.mp4?token=secret',
          providerName: 'RunningHub',
          modelName: 'RH Video',
          taskId: 'task-9',
        },
      } as any,
      planContext: { groupId: 'group-1', groupOrder: 2, layer: 3 },
    });

    expect(target.attachment.payload).toMatchObject({
      planContext: { groupId: 'group-1', groupOrder: 2, layer: 3 },
      diagnostic: {
        category: 'provider',
        title: '渠道拒绝了本次请求',
        location: { runId: 'run-1', runStepId: 'step-3', nodeId: 'video-3', nodeType: 'video', providerName: 'RunningHub', modelName: 'RH Video' },
        technical: { code: 'UPSTREAM_REJECTED', taskId: 'task-9' },
      },
    });
    expect(JSON.stringify(target)).not.toMatch(/private-key|private\.example|token=secret/);
  });

  it('includes the selected node runtime error when no run event is available', () => {
    const target = buildAssistantFailureTarget({
      node: { id: 'image-2', type: 'image', data: { prompt: 'portrait', error: '上游返回 HTTP 404：任务不存在', errorCode: 'UPSTREAM_NOT_FOUND', taskId: 'task-404' } } as any,
      edges: [],
      source: 'selected_node',
    });
    expect(target.attachment.payload).toMatchObject({ diagnostic: { observed: expect.stringContaining('HTTP 404'), technical: { code: 'UPSTREAM_NOT_FOUND', taskId: 'task-404' } } });
  });
});
