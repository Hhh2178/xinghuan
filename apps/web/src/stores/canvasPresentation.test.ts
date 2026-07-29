import { beforeEach, describe, expect, it } from 'vitest';

import {
  resolveCanvasPresentation,
  useCanvasPresentationStore,
} from './canvasPresentation.js';

describe('resolveCanvasPresentation', () => {
  it('falls back to legacy for an absent, malformed, or unrelated preference', () => {
    expect(resolveCanvasPresentation(undefined, {})).toBe('legacy');
    expect(resolveCanvasPresentation('user-1', {})).toBe('legacy');
    expect(resolveCanvasPresentation('user-1', { 'user-2': 'modern' })).toBe('legacy');
    expect(resolveCanvasPresentation('user-1', { 'user-1': 'unknown' })).toBe('legacy');
  });

  it('resolves only the current users saved modern preference', () => {
    expect(resolveCanvasPresentation('user-1', { 'user-1': 'modern' })).toBe('modern');
  });
});

describe('useCanvasPresentationStore', () => {
  beforeEach(() => {
    useCanvasPresentationStore.setState({ byUser: {} });
  });

  it('keeps presentation choices isolated by user id', () => {
    useCanvasPresentationStore.getState().setPresentation('user-1', 'modern');

    expect(useCanvasPresentationStore.getState().byUser).toEqual({ 'user-1': 'modern' });
    expect(resolveCanvasPresentation('user-1', useCanvasPresentationStore.getState().byUser)).toBe('modern');
    expect(resolveCanvasPresentation('user-2', useCanvasPresentationStore.getState().byUser)).toBe('legacy');
  });
});
