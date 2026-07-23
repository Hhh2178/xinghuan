import { afterEach, describe, expect, it, vi } from 'vitest';

import { readWorkflowSupervisionSettings } from './canvas-run-api';

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
