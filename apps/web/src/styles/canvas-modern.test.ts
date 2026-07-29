import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const modernStyles = readFileSync(new URL('./canvas-modern.css', import.meta.url), 'utf8');
const indexStyles = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const canvasSource = readFileSync(new URL('../components/Canvas.tsx', import.meta.url), 'utf8');
const sidebarSource = readFileSync(new URL('../components/Sidebar.tsx', import.meta.url), 'utf8');

describe('modern canvas shell stylesheet boundary', () => {
  it('keeps the sidebar as an unconditional overlay rail without a presentation switch', () => {
    const sidebarOpeningTag = sidebarSource.slice(
      sidebarSource.indexOf('<aside'),
      sidebarSource.indexOf('>', sidebarSource.indexOf('<aside')) + 1,
    );

    expect(indexStyles).toContain("@import './canvas-modern.css';");
    expect(appSource).not.toContain('CanvasPresentationToggle');
    expect(appSource).not.toContain('data-canvas-presentation');
    expect(canvasSource).not.toContain('presentation?: CanvasPresentation');
    expect(canvasSource).not.toContain('data-canvas-presentation');
    expect(sidebarSource).not.toContain('presentation?: CanvasPresentation');
    expect(sidebarSource).toContain('const isModern = true');
    expect(modernStyles).toContain('.t8-sidebar--modern');
    expect(modernStyles).not.toContain("data-canvas-presentation='modern'");
    expect(modernStyles).toContain('width: 56px');
    expect(modernStyles).toContain('position: absolute');
    expect(modernStyles).toContain('width: 232px');
    expect(modernStyles).toContain('overflow: visible');
    expect(sidebarOpeningTag).not.toContain('overflow-hidden');
    expect(modernStyles).not.toMatch(/(^|\n)\s*(body|html|\*)\s*\{/);
  });

  it('exposes only real modern rail actions while hover and focus control expansion', () => {
    expect(sidebarSource).not.toContain('data-sidebar-presentation');
    expect(sidebarSource).toContain('data-expanded={String(modernExpanded)}');
    expect(sidebarSource).toContain('t8-sidebar-rail');
    expect(sidebarSource).toContain('aria-label="打开画布列表"');
    expect(sidebarSource).toContain('aria-label="新建画布"');
    expect(sidebarSource).toContain('aria-label="打开节点搜索"');
    expect(sidebarSource).toContain('aria-label="打开 AI 托管"');
    expect(sidebarSource).not.toContain('PanelLeftClose');
    expect(sidebarSource).not.toContain('PanelLeftOpen');
    expect(sidebarSource).not.toContain('setModernExpanded((expanded) => !expanded)');
    expect(sidebarSource).toContain('t8-sidebar-panel');
  });

  it('keeps canvas presentation styling out of the modern rail stylesheet', () => {
    expect(modernStyles).not.toContain('.t8-canvas-presentation-toggle');
    expect(modernStyles).not.toContain('--canvas-modern-grid-dot');
    expect(modernStyles).not.toContain('.t8-canvas-minimap');
    expect(modernStyles).not.toContain('.agent-assistant-root');
  });
});
