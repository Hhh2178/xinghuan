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

  it('exposes an accessible modern rail without duplicating the node catalog', () => {
    expect(sidebarSource).toContain('data-sidebar-presentation={presentation}');
    expect(sidebarSource).toContain('data-expanded={isModern ? String(modernExpanded) : undefined}');
    expect(sidebarSource).toContain('t8-sidebar-rail');
    expect(sidebarSource).toContain("'展开节点面板'");
    expect(sidebarSource).toContain('t8-sidebar-panel');
  });
});
