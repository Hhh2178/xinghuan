import { describe, expect, it } from 'vitest';

import { assistantRectsOverlap, normalizeAssistantAnchor, resolveAssistantLayout, snapAssistantAnchor } from './assistant-geometry.js';

describe('assistant geometry', () => {
  it('keeps a launcher at the pointer position instead of snapping it to an edge', () => {
    expect(snapAssistantAnchor({ pointerX: 720, pointerY: 420, viewportWidth: 1440, viewportHeight: 900 })).toEqual({ x: 696, y: 396 });
  });

  it('migrates persisted edge anchors and clamps free coordinates into the visible viewport', () => {
    expect(normalizeAssistantAnchor({ side: 'left', y: 9999 }, { width: 1200, height: 800 })).toEqual({ x: 12, y: 740 });
    expect(normalizeAssistantAnchor({ x: 9999, y: -999 }, { width: 1200, height: 800 })).toEqual({ x: 1140, y: 12 });
  });

  it('positions the workbench beside a freely placed launcher and avoids supervision when possible', () => {
    const supervision = { x: 902, y: 122, width: 520, height: 720 };
    const layout = resolveAssistantLayout({ viewportWidth: 1440, viewportHeight: 900, anchor: { x: 500, y: 680 }, size: { width: 430, height: 720 }, supervisionRect: supervision });
    expect(layout.effectiveSide).toBe('left');
    expect(assistantRectsOverlap(layout.panel, supervision)).toBe(false);
    expect(layout.launcher).toMatchObject({ x: 500, y: 680 });
  });

  it('uses one bounded full-height drawer on compact viewports', () => {
    const layout = resolveAssistantLayout({ viewportWidth: 390, viewportHeight: 844, anchor: { x: 320, y: 780 }, size: { width: 430, height: 720 } });
    expect(layout).toMatchObject({ compact: true, panel: { x: 8, y: 8, width: 374, height: 828 } });
  });
});
