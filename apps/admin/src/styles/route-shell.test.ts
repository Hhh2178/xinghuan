import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesDir = resolve(__dirname);

describe('admin route shell style boundary', () => {
  it('loads a focused route-shell seam without broad global selectors', () => {
    const mainSource = readFileSync(resolve(stylesDir, '..', 'main.tsx'), 'utf8');
    const routeCss = readFileSync(resolve(stylesDir, 'route-shell.css'), 'utf8');

    expect(mainSource).toContain('styles/route-shell.css');
    expect(routeCss).toContain('.admin-shell');
    expect(routeCss).toContain('.admin-workspace');
    expect(routeCss).toContain('.admin-main');
    expect(routeCss).not.toMatch(/(^|\n)\s*(html|body|\*)\s*[{,]/);
  });
});
