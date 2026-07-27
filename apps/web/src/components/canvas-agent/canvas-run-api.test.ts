import { afterEach, describe, expect, it, vi } from 'vitest';

import { isCanvasRunRuntimeUnavailable, readCanvasRunEvents, readWorkflowSupervisionSettings } from './canvas-run-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('workflow supervision settings API', () => {
  it('rejects a successful response without a settings projection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('null', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(readWorkflowSupervisionSettings('canvas-1', 'workflow-1'))
      .rejects.toThrow('托管设置响应无效');
  });

  it('accepts a complete settings projection', async () => {
    const projection = {
      canvasId: 'canvas-1',
      workflowId: 'workflow-1',
      workflowName: '视觉候选工作流',
      workflowRevision: 5,
      settings: {
        defaultRetryCount: 3,
        retryExhaustionPolicy: 'stop',
        maxFallbackCount: 2,
        promptReviewRewriteEnabled: true,
        promptReviewMaxRetries: 1,
        stageConcurrency: 4,
        maxDurationSeconds: 3600,
        maxCost: '20',
        currency: 'CNY',
        candidateSelectionMode: 'manual',
        candidateSelectionCount: 1,
        candidateMinimumConfidence: 70,
        lowConfidenceManualFallback: true,
        nodeRetryOverrides: {},
      },
      sources: {},
      clampedFields: [],
      hasRemembered: false,
      rememberedRevision: null,
      rememberedUpdatedAt: null,
      platformLimits: {},
      appliesTo: 'next_run',
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: projection }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(readWorkflowSupervisionSettings('canvas-1', 'workflow-1')).resolves.toEqual(projection);
  });
});

describe('canvas run event API', () => {
  it('reads owner-scoped persisted events from an explicit sequence cursor', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { items: [], nextSequence: 7 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(readCanvasRunEvents('run/1', 7)).resolves.toEqual({ items: [], nextSequence: 7 });
    expect(fetchMock).toHaveBeenCalledWith('/api/canvas-runs/run%2F1/events?after=7', { credentials: 'same-origin' });
  });
});

describe('canvas run runtime availability', () => {
  it.each([
    'CANVAS_RUN_DISABLED',
    'CANVAS_RUN_POSTGRES_REQUIRED',
    'AGENT_RUNTIME_CAPABILITY_DISABLED:gray:canvasRunsEnabled',
  ])('classifies %s as a non-retriable unavailable runtime', (message) => {
    expect(isCanvasRunRuntimeUnavailable(new Error(message))).toBe(true);
  });

  it('does not hide an ordinary task failure as runtime unavailability', () => {
    expect(isCanvasRunRuntimeUnavailable(new Error('RATE_LIMITED'))).toBe(false);
  });
});
