import { describe, expect, it } from 'vitest';

import { decideCanvasRevisionSync, withCanvasSaveLock } from './canvasRevisionSync';

describe('canvas revision sync', () => {
  it('reloads a newer remote revision when the local canvas is clean', () => {
    expect(decideCanvasRevisionSync({
      knownRevision: 7,
      incomingRevision: 8,
      hasLocalChanges: false,
    })).toBe('reload');
  });

  it('blocks a stale tab before it writes over unsaved local changes', () => {
    expect(decideCanvasRevisionSync({
      knownRevision: 7,
      incomingRevision: 8,
      hasLocalChanges: true,
    })).toBe('block');
  });

  it('ignores duplicate and older revision notices', () => {
    expect(decideCanvasRevisionSync({
      knownRevision: 8,
      incomingRevision: 8,
      hasLocalChanges: false,
    })).toBe('ignore');
  });

  it('runs saves through the browser lock when available', async () => {
    const calls: string[] = [];
    const locks = {
      request: async <T>(name: string, callback: () => Promise<T>) => {
        calls.push(name);
        return callback();
      },
    };

    await expect(withCanvasSaveLock('canvas/a', async () => 42, locks)).resolves.toBe(42);
    expect(calls).toEqual(['xinghuan-canvas-save:canvas%2Fa']);
  });
});
