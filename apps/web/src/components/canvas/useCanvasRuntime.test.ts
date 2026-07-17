import { describe, expect, it } from 'vitest';
import { runNodeWithRetries } from './useCanvasRuntime';

describe('runNodeWithRetries', () => {
  it('continues after a transient failure', async () => {
    let attempts = 0;
    const result = await runNodeWithRetries('node-a', async () => {
      attempts += 1;
      return { id: 'node-a', ok: attempts === 2, ts: attempts, error: attempts === 1 ? 'temporary' : undefined };
    });
    expect(result?.ok).toBe(true);
    expect(attempts).toBe(2);
  });

  it('allows three retries after the initial attempt', async () => {
    let attempts = 0;
    await expect(runNodeWithRetries('node-a', async () => {
      attempts += 1;
      return { id: 'node-a', ok: false, ts: attempts, error: 'failed' };
    })).rejects.toThrow('NODE_RUN_FAILED_AFTER_RETRIES:node-a:failed');
    expect(attempts).toBe(4);
  });

  it('honors a configured retry count and caps it at ten', async () => {
    let noRetryAttempts = 0;
    await expect(runNodeWithRetries('node-a', async () => {
      noRetryAttempts += 1;
      return { id: 'node-a', ok: false, ts: noRetryAttempts, error: 'failed' };
    }, { maxRetries: 0 })).rejects.toThrow('NODE_RUN_FAILED_AFTER_RETRIES');
    expect(noRetryAttempts).toBe(1);

    let cappedAttempts = 0;
    await expect(runNodeWithRetries('node-b', async () => {
      cappedAttempts += 1;
      return { id: 'node-b', ok: false, ts: cappedAttempts, error: 'failed' };
    }, { maxRetries: 99 })).rejects.toThrow('NODE_RUN_FAILED_AFTER_RETRIES');
    expect(cappedAttempts).toBe(11);
  });
});
