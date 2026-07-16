import { describe, expect, it } from 'vitest';
import type { NodeChange } from '@xyflow/react';
import { filterLockedNodePositionChanges } from './groupBoxGuards';

describe('filterLockedNodePositionChanges', () => {
  it('drops position commits for the locked drag target', () => {
    const changes: NodeChange[] = [
      { id: 'locked', type: 'position', position: { x: 90, y: 80 }, dragging: false },
      { id: 'other', type: 'position', position: { x: 10, y: 20 }, dragging: false },
      { id: 'locked', type: 'select', selected: true },
    ];
    expect(filterLockedNodePositionChanges(changes, 'locked')).toEqual([
      changes[1],
      changes[2],
    ]);
  });
});
