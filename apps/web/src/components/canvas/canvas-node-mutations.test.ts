import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/react';
import { createAnimationFrameBatch, patchNodeData, patchNodesById } from './canvas-node-mutations';

const nodes = (): Node[] => [
  { id: 'a', type: 'text', position: { x: 0, y: 0 }, data: { status: 'idle', value: 1 } },
  { id: 'b', type: 'image', position: { x: 10, y: 10 }, data: { status: 'idle' } },
];

describe('canvas node mutation semantics', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('preserves untouched node references and returns the same list for no-op patches', () => {
    const source = nodes();
    const next = patchNodeData(source, 'a', { status: 'running' });
    expect(next).not.toBe(source);
    expect(next[0]).not.toBe(source[0]);
    expect(next[1]).toBe(source[1]);
    expect(patchNodeData(next, 'a', { status: 'running' })).toBe(next);
    expect(patchNodeData(next, 'missing', { status: 'running' })).toBe(next);
  });

  it('applies a stable multi-node snapshot without cloning untouched nodes', () => {
    const source = nodes();
    const next = patchNodesById(source, new Map([
      ['a', { status: 'running' }],
      ['b', { outputUrl: '/files/output/a.png' }],
    ]));
    expect(next.map((node) => node.data)).toEqual([
      { status: 'running', value: 1 },
      { status: 'idle', outputUrl: '/files/output/a.png' },
    ]);
    expect(next[0]).not.toBe(source[0]);
    expect(next[1]).not.toBe(source[1]);
  });

  it('flushes rapid updates once per animation frame and drops updates after dispose', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const flush = vi.fn();
    const batch = createAnimationFrameBatch(flush);
    batch.enqueue({ id: 'a' });
    batch.enqueue({ id: 'b' });
    expect(flush).not.toHaveBeenCalled();
    callbacks.shift()?.(0);
    expect(flush).toHaveBeenCalledOnce();
    expect(flush).toHaveBeenCalledWith([{ id: 'a' }, { id: 'b' }]);
    batch.dispose();
    batch.enqueue({ id: 'c' });
    expect(callbacks).toHaveLength(0);
  });
});
