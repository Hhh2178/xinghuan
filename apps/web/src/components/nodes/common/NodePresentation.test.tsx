import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NodePresentation, NodePresentationKeyGrid, NodePresentationSection } from './NodePresentation.js';

describe('NodePresentation', () => {
  it('renders visual hierarchy without owning node business state', () => {
    const markup = renderToStaticMarkup(
      <NodePresentation kind="image" title="图像" status="运行中">
        <NodePresentationSection title="生成描述"><textarea defaultValue="保留的已有输入" /></NodePresentationSection>
        <NodePresentationKeyGrid><button type="button">保留的已有模型选择</button></NodePresentationKeyGrid>
      </NodePresentation>,
    );

    expect(markup).toContain('data-node-presentation="image"');
    expect(markup).toContain('图像');
    expect(markup).toContain('运行中');
    expect(markup).toContain('生成描述');
    expect(markup).toContain('保留的已有模型选择');
  });
});
