import { describe, expect, it, vi } from 'vitest';
import { dispatchWorkerOperation, resolveCanvasRunOperation } from './worker-operation-dispatch.js';

describe('worker operation dispatch', () => {
  it('routes deterministic Canvas nodes separately from Provider nodes', () => {
    expect(resolveCanvasRunOperation('text')).toBe('deterministic_canvas');
    expect(resolveCanvasRunOperation('resize')).toBe('deterministic_canvas');
    expect(resolveCanvasRunOperation('image')).toBe('provider_execution');
  });

  it('passes cancellation through without invoking another handler', async () => {
    const provider = vi.fn(async () => ({ status: 'succeeded' }));
    const recovery = vi.fn(async () => ({ status: 'succeeded' }));
    const signal = new AbortController().signal;
    await dispatchWorkerOperation({
      operation: 'provider_execution',
      signal,
      handlers: { providerExecution: provider, outputRecovery: recovery },
    });
    expect(provider).toHaveBeenCalledWith(signal);
    expect(recovery).not.toHaveBeenCalled();
  });
});
