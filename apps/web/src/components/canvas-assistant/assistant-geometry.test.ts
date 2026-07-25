import { describe, expect, it } from 'vitest';

import { assistantRectsOverlap, normalizeAssistantAnchor, resolveAssistantLayout, resolveAssistantMovementRegion, snapAssistantAnchor } from './assistant-geometry.js';

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

  it('re-homes both launcher and panel outside a supervision obstacle at 1920x1080', () => {
    const supervision = { x: 1382, y: 122, width: 520, height: 720 };
    const layout = resolveAssistantLayout({
      viewportWidth: 1920,
      viewportHeight: 1080,
      anchor: { x: 1500, y: 500 },
      size: { width: 430, height: 720 },
      supervisionRect: supervision,
      panelOpen: true,
    });
    expect(assistantRectsOverlap(layout.panel, supervision, 12)).toBe(false);
    expect(assistantRectsOverlap(layout.launcher, supervision, 12)).toBe(false);
  });

  it('keeps a valid launcher when supervision closes and restores full panel placement bounds', () => {
    const supervision = { x: 1382, y: 122, width: 520, height: 720 };
    const closed = resolveAssistantLayout({
      viewportWidth: 1920, viewportHeight: 1080, anchor: { x: 900, y: 500 }, size: { width: 430, height: 720 }, supervisionRect: supervision, panelOpen: false,
    });
    const reopenedWithoutObstacle = resolveAssistantLayout({
      viewportWidth: 1920, viewportHeight: 1080, anchor: { x: closed.launcher.x, y: closed.launcher.y }, size: { width: 430, height: 720 }, panelOpen: true,
    });
    expect(closed.launcher).toMatchObject({ x: 900, y: 500 });
    expect(reopenedWithoutObstacle.launcher).toMatchObject({ x: 900, y: 500 });
  });

  it('exposes only movement regions large enough for the stable desktop group', () => {
    const regions = resolveAssistantMovementRegion({
      viewport: { width: 1920, height: 1080 },
      panelSize: { width: 430, height: 720 },
      obstacle: { x: 1382, y: 122, width: 520, height: 720 },
      gap: 12,
    });
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.every((region) => region.panelBounds.width >= 0 && region.launcherBounds.width >= 0)).toBe(true);
  });

  it('clamps sampled desktop drag positions into obstacle-safe visible bounds', () => {
    const supervision = { x: 1382, y: 122, width: 520, height: 720 };
    for (let x = 12; x <= 1860; x += 132) {
      for (let y = 12; y <= 1020; y += 126) {
        const layout = resolveAssistantLayout({
          viewportWidth: 1920,
          viewportHeight: 1080,
          anchor: { x, y },
          size: { width: 430, height: 720 },
          supervisionRect: supervision,
          panelOpen: true,
        });
        expect(assistantRectsOverlap(layout.panel, supervision, 12)).toBe(false);
        expect(assistantRectsOverlap(layout.launcher, supervision, 12)).toBe(false);
        expect(layout.panel.x).toBeGreaterThanOrEqual(12);
        expect(layout.panel.y).toBeGreaterThanOrEqual(12);
        expect(layout.panel.x + layout.panel.width).toBeLessThanOrEqual(1908);
        expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(1068);
      }
    }
  });
});
