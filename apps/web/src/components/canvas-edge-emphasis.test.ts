import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';

import { classifyCanvasEdgeEmphasis } from './canvas-edge-emphasis.js';

const nodes = (selected: string[] = []): Node[] => ['a', 'b', 'c', 'd', 'e', 'x', 'y'].map((id) => ({ id, position: { x: 0, y: 0 }, data: {}, selected: selected.includes(id) }));
const edges: Edge[] = [
  { id: 'a-b', source: 'a', target: 'b' },
  { id: 'b-c', source: 'b', target: 'c' },
  { id: 'c-d', source: 'c', target: 'd' },
  { id: 'd-e', source: 'd', target: 'e' },
  { id: 'x-y', source: 'x', target: 'y' },
];

describe('classifyCanvasEdgeEmphasis', () => {
  it('distinguishes direct and transitive upstream/downstream edges', () => {
    expect(classifyCanvasEdgeEmphasis(nodes(['c']), edges)).toEqual(new Map([
      ['a-b', 'transitive-upstream'],
      ['b-c', 'direct-upstream'],
      ['c-d', 'direct-downstream'],
      ['d-e', 'transitive-downstream'],
      ['x-y', 'muted'],
    ]));
  });

  it('keeps normal styling when no or multiple nodes are selected', () => {
    expect([...classifyCanvasEdgeEmphasis(nodes(), edges).values()]).toEqual(Array(edges.length).fill('normal'));
    expect([...classifyCanvasEdgeEmphasis(nodes(['b', 'c']), edges).values()]).toEqual(Array(edges.length).fill('normal'));
  });

  it('terminates cyclic traversal and gives direct relationships precedence', () => {
    const cyclic = [...edges.slice(0, 3), { id: 'd-b', source: 'd', target: 'b' }];
    expect(classifyCanvasEdgeEmphasis(nodes(['c']), cyclic)).toEqual(new Map([
      ['a-b', 'transitive-upstream'],
      ['b-c', 'direct-upstream'],
      ['c-d', 'direct-downstream'],
      ['d-b', 'transitive-upstream'],
    ]));
  });
});
