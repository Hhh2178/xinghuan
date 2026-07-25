import { useEffect, useRef, useState, type ChangeEventHandler, type CompositionEventHandler } from 'react';

export interface ImeTextState {
  value: string;
  isComposing: boolean;
}

export type ImeTextEvent =
  | { type: 'external'; value: string }
  | { type: 'change'; value: string }
  | { type: 'composition-start' }
  | { type: 'composition-end'; value: string }
  | { type: 'commit' };

export interface ImeTextTransition {
  state: ImeTextState;
  commit?: string;
}

type TextControlElement = HTMLInputElement | HTMLTextAreaElement;

export function createImeTextState(value: string): ImeTextState {
  return { value, isComposing: false };
}

export function transitionImeTextState(state: ImeTextState, event: ImeTextEvent): ImeTextTransition {
  if (event.type === 'composition-start') return { state: { ...state, isComposing: true } };
  if (event.type === 'external') {
    return state.isComposing ? { state } : { state: { value: event.value, isComposing: false } };
  }
  if (event.type === 'change') {
    const next = { ...state, value: event.value };
    return state.isComposing ? { state: next } : { state: next, commit: event.value };
  }
  if (event.type === 'composition-end') {
    return { state: { value: event.value, isComposing: false }, commit: event.value };
  }
  return { state, commit: state.value };
}

export function isImeSubmissionEvent(event: { isComposing?: boolean; keyCode?: number; which?: number }, localIsComposing: boolean) {
  return localIsComposing || event.isComposing === true || event.keyCode === 229 || event.which === 229;
}

export function useImeSafeTextControl(input: { value: string; onCommit: (value: string) => void }) {
  const [state, setState] = useState(() => createImeTextState(input.value));
  const stateRef = useRef(state);

  const apply = (event: ImeTextEvent) => {
    const transition = transitionImeTextState(stateRef.current, event);
    stateRef.current = transition.state;
    setState(transition.state);
    if (transition.commit !== undefined) input.onCommit(transition.commit);
  };

  useEffect(() => {
    const transition = transitionImeTextState(stateRef.current, { type: 'external', value: input.value });
    if (transition.state === stateRef.current) return;
    stateRef.current = transition.state;
    setState(transition.state);
  }, [input.value]);

  const onChange: ChangeEventHandler<TextControlElement> = (event) => apply({ type: 'change', value: event.currentTarget.value });
  const onCompositionStart: CompositionEventHandler<TextControlElement> = () => apply({ type: 'composition-start' });
  const onCompositionEnd: CompositionEventHandler<TextControlElement> = (event) => apply({ type: 'composition-end', value: event.currentTarget.value });

  return {
    value: state.value,
    isComposing: state.isComposing,
    onChange,
    onCompositionStart,
    onCompositionEnd,
    commit: (value = stateRef.current.value) => apply({ type: 'composition-end', value }),
  };
}
