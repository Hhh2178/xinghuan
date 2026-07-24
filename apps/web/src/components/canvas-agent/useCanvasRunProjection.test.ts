import { describe, expect, it } from 'vitest';

import { canvasRunReadMatchesTarget, resolveCanvasRunTargetId } from './useCanvasRunProjection';

describe('canvas run projection ownership', () => {
  it('rejects an old Run response after the selected Run changes', () => {
    expect(canvasRunReadMatchesTarget('run-old', 'run-new', 'run-old')).toBe(false);
  });

  it('rejects a mismatched response for the current request', () => {
    expect(canvasRunReadMatchesTarget('run-new', 'run-new', 'run-old')).toBe(false);
  });

  it('accepts only the response owned by the current selected Run', () => {
    expect(canvasRunReadMatchesTarget('run-new', 'run-new', 'run-new')).toBe(true);
  });

  it('renders a newly requested external Run before effects synchronize local state', () => {
    expect(resolveCanvasRunTargetId('run-new', 'run-old', 'run-old', 'run-old')).toBe('run-new');
  });

  it('keeps an internally created Run while the external selection is unchanged', () => {
    expect(resolveCanvasRunTargetId('run-old', 'run-old', 'run-created', 'run-created')).toBe('run-created');
  });
});
