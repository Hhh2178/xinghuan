import { describe, expect, it } from 'vitest';
import { createBoardPersistencePatch, type PersistedBoardLayer } from './drawing-board-persistence';

type Element = { id: string };
type Layer = PersistedBoardLayer<Element> & { id: string };

const editable = (id: string, elements: Element[] = []): Layer => ({ id, kind: 'layer', elements });
const group = (id: string, elements: Element[] = []): Layer => ({ id, kind: 'group', elements });

describe('createBoardPersistencePatch', () => {
  it('flattens only editable layers while preserving layer order', () => {
    const first = editable('first', [{ id: 'a' }]);
    const second = editable('second', [{ id: 'b' }, { id: 'c' }]);

    expect(createBoardPersistencePatch([group('group'), first, second], editable('fallback'))).toEqual({
      boardLayers: [group('group'), first, second],
      boardElements: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    });
  });

  it('recovers an editable layer when persisted data contains groups only', () => {
    const fallback = editable('recovered');

    expect(createBoardPersistencePatch([group('group', [{ id: 'legacy' }])], fallback)).toEqual({
      boardLayers: [fallback],
      boardElements: [],
    });
  });
});
