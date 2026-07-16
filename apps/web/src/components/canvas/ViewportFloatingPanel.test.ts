import { describe, expect, it } from 'vitest';

import { resolveViewportFloatingPanelPosition } from './ViewportFloatingPanel';

describe('resolveViewportFloatingPanelPosition', () => {
  it('prefers the cursor right side and flips left when the panel would overflow', () => {
    expect(resolveViewportFloatingPanelPosition(
      { x: 980, y: 740 },
      { width: 240, height: 320 },
      { width: 1000, height: 800 },
    )).toEqual({ left: 732, top: 468, maxHeight: 776 });
  });

  it('keeps panels inside the padded viewport and constrains oversized content', () => {
    expect(resolveViewportFloatingPanelPosition(
      { x: 5, y: 5 },
      { width: 240, height: 1000 },
      { width: 1000, height: 800 },
    )).toEqual({ left: 13, top: 12, maxHeight: 776 });
  });
});
