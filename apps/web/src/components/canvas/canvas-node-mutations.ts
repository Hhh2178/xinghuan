import type { Node } from '@xyflow/react';

export type NodePatch = Record<string, unknown>;

/** Patch one node while preserving every untouched node reference. */
export function patchNodeData<T extends Node>(nodes: T[], id: string, patch: NodePatch): T[] {
  const target = nodes.find((node) => node.id === id);
  if (!target || Object.keys(patch).length === 0) return nodes;
  const currentData = (target.data || {}) as Record<string, unknown>;
  const changed = Object.entries(patch).some(([key, value]) => currentData[key] !== value);
  if (!changed) return nodes;
  return nodes.map((node) => node.id === id
    ? { ...node, data: { ...(node.data || {}), ...patch } }
    : node);
}

/** Apply multiple per-node patches in one immutable pass. */
export function patchNodesById<T extends Node>(nodes: T[], patches: ReadonlyMap<string, NodePatch>): T[] {
  if (patches.size === 0) return nodes;
  let changed = false;
  const next = nodes.map((node) => {
    const patch = patches.get(node.id);
    if (!patch || Object.keys(patch).length === 0) return node;
    const currentData = (node.data || {}) as Record<string, unknown>;
    if (!Object.entries(patch).some(([key, value]) => currentData[key] !== value)) return node;
    changed = true;
    return { ...node, data: { ...(node.data || {}), ...patch } };
  });
  return changed ? next : nodes;
}

export function createAnimationFrameBatch<T>(flush: (items: T[]) => void) {
  let disposed = false;
  let frame: number | ReturnType<typeof globalThis.setTimeout> | null = null;
  const pending: T[] = [];
  const schedule = (callback: FrameRequestCallback) => typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame(callback)
    : globalThis.setTimeout(() => callback(Date.now()), 0);
  const cancel = (handle: number | ReturnType<typeof globalThis.setTimeout>) => typeof globalThis.cancelAnimationFrame === 'function' && typeof handle === 'number'
    ? globalThis.cancelAnimationFrame(handle)
    : globalThis.clearTimeout(handle);
  const drain = () => {
    frame = null;
    if (disposed || pending.length === 0) return;
    const items = pending.splice(0, pending.length);
    flush(items);
  };
  return {
    enqueue(item: T) {
      if (disposed) return;
      pending.push(item);
      if (frame === null) frame = schedule(drain);
    },
    dispose() {
      disposed = true;
      if (frame !== null) cancel(frame);
      frame = null;
      pending.length = 0;
    },
  };
}
