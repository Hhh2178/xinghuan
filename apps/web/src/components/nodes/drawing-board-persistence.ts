export interface PersistedBoardLayer<TElement> {
  kind: 'layer' | 'group';
  elements: TElement[];
}

export interface BoardPersistencePatch<TLayer, TElement> {
  boardLayers: TLayer[];
  boardElements: TElement[];
}

/**
 * Keep the DrawingBoard node's persisted layer and legacy flat element fields
 * in lockstep. A board containing only groups cannot accept edits, so callers
 * provide a fresh editable layer as the recovery fallback.
 */
export function createBoardPersistencePatch<
  TLayer extends PersistedBoardLayer<TElement>,
  TElement,
>(layers: readonly TLayer[], fallbackLayer: TLayer): BoardPersistencePatch<TLayer, TElement> {
  const safeLayers = layers.some((layer) => layer.kind === 'layer') ? [...layers] : [fallbackLayer];
  return {
    boardLayers: safeLayers,
    boardElements: safeLayers.flatMap((layer) => layer.kind === 'layer' ? layer.elements : []),
  };
}
