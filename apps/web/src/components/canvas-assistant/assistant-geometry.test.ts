import { describe, expect, it } from 'vitest';

import {
  assistantRectsOverlap,
  normalizeAssistantAnchor,
  resolveAssistantLayout,
  snapAssistantAnchor,
} from './assistant-geometry.js';

describe('assistant geometry', () => {
  it('snaps the launcher to the nearest safe edge and clamps vertical position', () => {
    expect(snapAssistantAnchor({ pointerX: 20, pointerY: -100, viewportWidth: 1440, viewportHeight: 900 }))
      .toMatchObject({ side: 'left', y: 12 });
    expect(snapAssistantAnchor({ pointerX: 1400, pointerY: 1000, viewportWidth: 1440, viewportHeight: 900 }))
      .toMatchObject({ side: 'right', y: 840 });
  });

  it('recovers persisted geometry into the visible viewport', () => {
    expect(normalizeAssistantAnchor({ side: 'left', y: 9999, offsetX: -999, offsetY: 999 }, { width: 1200, height: 800 }))
      .toEqual({ side: 'left', y: 740, offsetX: -64, offsetY: 240 });
  });

  it('moves the anchored assistant to the opposite edge when supervision occupies its preferred rectangle', () => {
    const supervision = { x: 902, y: 122, width: 520, height: 720 };
    const layout = resolveAssistantLayout({
      viewportWidth: 1440,
      viewportHeight: 900,
      anchor: { side: 'right', y: 700, offsetX: 0, offsetY: 0 },
      size: { width: 430, height: 720 },
      supervisionRect: supervision,
    });

    expect(layout.effectiveSide).toBe('left');
    expect(assistantRectsOverlap(layout.panel, supervision)).toBe(false);
    expect(layout.panel.x).toBeGreaterThan(layout.launcher.x);
  });

  it('uses one bounded full-height drawer on compact viewports', () => {
    const layout = resolveAssistantLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      anchor: { side: 'right', y: 780, offsetX: 20, offsetY: 50 },
      size: { width: 430, height: 720 },
    });

    expect(layout).toMatchObject({ compact: true, panel: { x: 8, y: 8, width: 374, height: 828 } });
  });

  it('keeps the panel outside the launcher gap at both horizontal offset extremes', () => {
    const left = resolveAssistantLayout({
      viewportWidth: 1440,
      viewportHeight: 900,
      anchor: { side: 'left', y: 400, offsetX: -64, offsetY: 0 },
      size: { width: 520, height: 720 },
    });
    const right = resolveAssistantLayout({
      viewportWidth: 1440,
      viewportHeight: 900,
      anchor: { side: 'right', y: 400, offsetX: 64, offsetY: 0 },
      size: { width: 520, height: 720 },
    });

    expect(left.panel.x).toBe(left.launcher.x + left.launcher.width + 10);
    expect(right.panel.x + right.panel.width + 10).toBe(right.launcher.x);
    expect(assistantRectsOverlap(left.panel, left.launcher)).toBe(false);
    expect(assistantRectsOverlap(right.panel, right.launcher)).toBe(false);
  });
});
