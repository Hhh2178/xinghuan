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
});
