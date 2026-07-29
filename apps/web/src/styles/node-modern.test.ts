import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const nodeStyles = readFileSync(new URL('./node-modern.css', import.meta.url), 'utf8');
const indexStyles = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const materialPreviewSource = readFileSync(new URL('../components/nodes/MaterialPreviewSection.tsx', import.meta.url), 'utf8');
const thumbnailSource = readFileSync(new URL('../components/nodes/MaterialThumbnail.tsx', import.meta.url), 'utf8');

describe('modern node presentation boundary', () => {
  it('keeps modern typography and layout rules scoped to the new canvas presentation', () => {
    expect(indexStyles).toContain("@import './node-modern.css';");
    expect(nodeStyles).toContain(".t8-app-shell[data-canvas-presentation='modern'] .t8-node-presentation");
    expect(nodeStyles).toContain('font-size: 16px');
    expect(nodeStyles).toContain('font-size: 14px');
    expect(nodeStyles).toContain('font-size: 13px');
    expect(nodeStyles).toContain('font-size: 12px');
    expect(nodeStyles).not.toMatch(/(^|\n)\s*(body|html|\*)\s*\{/);
  });

  it('adds material presentation and origin hooks without changing material callback semantics', () => {
    expect(materialPreviewSource).toContain('presentation?: CanvasPresentation');
    expect(materialPreviewSource).toContain('data-materials-presentation={presentation}');
    expect(thumbnailSource).toContain('data-material-origin={material.origin}');
    expect(materialPreviewSource).toContain('onReorder(moved)');
    expect(materialPreviewSource).toContain('onRemove={onRemoveLocal ? () => onRemoveLocal(m) : undefined}');
    expect(materialPreviewSource).toContain('onExclude={onExcludeUpstream ? () => onExcludeUpstream(m) : undefined}');
  });
});
