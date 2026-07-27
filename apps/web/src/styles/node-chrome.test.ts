import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesDir = resolve(__dirname);

describe('node chrome style boundary', () => {
  it('imports the node chrome seam and keeps scrollbar/action rules node-scoped', () => {
    const indexCss = readFileSync(resolve(stylesDir, 'index.css'), 'utf8');
    const chromeCss = readFileSync(resolve(stylesDir, 'node-chrome.css'), 'utf8');

    expect(indexCss).toContain("@import './node-chrome.css';");
    expect(chromeCss).toContain('.react-flow__node ::-webkit-scrollbar');
    expect(chromeCss).toContain('.t8-node-action-bar');
    expect(chromeCss).not.toMatch(/(^|\n)\s*(html|body|\*)\s*[{,]/);
  });
});
