import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shellStyles = readFileSync(new URL('./canvas-shell.css', import.meta.url), 'utf8');
const indexStyles = readFileSync(new URL('./index.css', import.meta.url), 'utf8');

describe('canvas shell stylesheet boundary', () => {
  it('keeps shell layering in a dedicated imported boundary', () => {
    expect(indexStyles).toContain("@import './canvas-shell.css';");
    expect(shellStyles).toContain('.t8-canvas-shell > .react-flow');
    expect(shellStyles).toContain('.t8-canvas-shell .react-flow__background');
    expect(shellStyles).toContain('.t8-canvas-shell .react-flow__edges');
    expect(shellStyles).not.toMatch(/(^|\n)\s*(body|html|\*)\s*\{/);
  });
});
