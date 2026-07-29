import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CanvasPresentationToggle } from './CanvasPresentationToggle.js';

describe('CanvasPresentationToggle', () => {
  it('renders an accessible legacy-default choice and modern preview choice', () => {
    const onChange = vi.fn();
    const markup = renderToStaticMarkup(
      <CanvasPresentationToggle presentation="legacy" onChange={onChange} />,
    );

    expect(markup).toContain('画布界面');
    expect(markup).toContain('旧版画布');
    expect(markup).toContain('新版画布（预览）');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-pressed="false"');
  });
});
