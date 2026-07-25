import { describe, expect, it } from 'vitest';

import { createImeTextState, isImeSubmissionEvent, transitionImeTextState } from './useImeSafeTextControl.js';

describe('IME-safe text control', () => {
  it('buffers composition changes and commits the finalized text once', () => {
    let state = createImeTextState('');

    ({ state } = transitionImeTextState(state, { type: 'composition-start' }));
    const interim = transitionImeTextState(state, { type: 'change', value: 'ni' });
    state = interim.state;
    expect(interim.commit).toBeUndefined();
    expect(state).toEqual({ value: 'ni', isComposing: true });

    const staleExternal = transitionImeTextState(state, { type: 'external', value: '' });
    state = staleExternal.state;
    expect(state.value).toBe('ni');

    const completed = transitionImeTextState(state, { type: 'composition-end', value: '你' });
    expect(completed.state).toEqual({ value: '你', isComposing: false });
    expect(completed.commit).toBe('你');
  });

  it('commits ordinary changes immediately and blocks Enter while the browser is composing', () => {
    const changed = transitionImeTextState(createImeTextState('你'), { type: 'change', value: '你好' });
    expect(changed.commit).toBe('你好');
    expect(isImeSubmissionEvent({ isComposing: true, keyCode: 13 }, false)).toBe(true);
    expect(isImeSubmissionEvent({ isComposing: false, keyCode: 229 }, false)).toBe(true);
    expect(isImeSubmissionEvent({ isComposing: false, keyCode: 13 }, false)).toBe(false);
  });
});
