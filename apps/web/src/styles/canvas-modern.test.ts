import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const modernStyles = readFileSync(new URL('./canvas-modern.css', import.meta.url), 'utf8');
const indexStyles = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const sidebarSource = readFileSync(new URL('../components/Sidebar.tsx', import.meta.url), 'utf8');

describe('modern canvas shell stylesheet boundary', () => {
  it('keeps the modern sidebar as an overlay rail scoped to modern presentation only', () => {
    expect(indexStyles).toContain("@import './canvas-modern.css';");
    expect(modernStyles).toContain(".t8-app-shell[data-canvas-presentation='modern'] .t8-sidebar--modern");
    expect(modernStyles).toContain('width: 56px');
    expect(modernStyles).toContain('position: absolute');
    expect(modernStyles).toContain('width: 232px');
    expect(modernStyles).not.toMatch(/(^|\n)\s*(body|html|\*)\s*\{/);
  });

  it('exposes only real modern rail actions while hover and focus control expansion', () => {
    expect(sidebarSource).toContain('data-sidebar-presentation={presentation}');
    expect(sidebarSource).toContain('data-expanded={isModern ? String(modernExpanded) : undefined}');
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

  it('defines a 32px segmented presentation control that matches topbar actions', () => {
    expect(modernStyles).toContain('.t8-canvas-presentation-toggle');
    expect(modernStyles).toContain('height: 32px');
    expect(modernStyles).toContain('.t8-canvas-presentation-toggle__option.is-active');
  });
});
