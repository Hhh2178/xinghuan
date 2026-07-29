import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CanvasPresentationToggle } from './CanvasPresentationToggle.js';

describe('CanvasPresentationToggle', () => {
  it('renders a compact canvas-style switch with a separate modern preview status', () => {
    const onChange = vi.fn();
    const markup = renderToStaticMarkup(
      <CanvasPresentationToggle presentation="legacy" onChange={onChange} />,
    );

    expect(markup).toContain('画布样式');
    expect(markup).toContain('旧版');
    expect(markup).toContain('新版');
    expect(markup).toContain('预览');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-pressed="false"');
  });
});
