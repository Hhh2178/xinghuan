import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const canvasSource = readFileSync(new URL('./Canvas.tsx', import.meta.url), 'utf8');
const overlaysSource = readFileSync(new URL('./canvas/CanvasFlowOverlays.tsx', import.meta.url), 'utf8');
const modernStyles = readFileSync(new URL('../styles/canvas-modern.css', import.meta.url), 'utf8');

describe('Canvas modern presentation boundary', () => {
  it('adds a presentation hook without removing the existing canvas runtime surface', () => {
    expect(canvasSource).toContain('presentation?: CanvasPresentation');
    expect(canvasSource).toContain('data-canvas-presentation={presentation}');
    expect(canvasSource).toContain('<CanvasToolbar');
    expect(canvasSource).toContain('<CanvasOverlayLayer');
    expect(canvasSource).toContain('<ReactFlow');
    expect(canvasSource).toContain('<Background');
    expect(canvasSource).toContain('<CanvasFlowOverlays');
    expect(canvasSource).toContain('<NodeActionBar');
    expect(canvasSource).toContain('<MaterialDragOverlay');
    expect(canvasSource).toContain('<CanvasAssistant');
  });

  it('uses a modern-only grid variable and keeps minimap mounted with a safe slot class', () => {
    expect(canvasSource).toContain("color={presentation === 'modern' ? 'var(--canvas-modern-grid-dot)' : dotColor}");
    expect(overlaysSource).toContain('<MiniMap');
    expect(overlaysSource).toContain('className="t8-canvas-minimap"');
    expect(modernStyles).toContain('--canvas-modern-grid-dot');
    expect(modernStyles).toContain('.t8-canvas-minimap');
    expect(modernStyles).toContain('.agent-assistant-root');
  });
});
