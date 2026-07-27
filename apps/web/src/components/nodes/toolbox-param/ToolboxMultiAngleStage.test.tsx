import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ToolboxMultiAngleStage } from './ToolboxMultiAngleStage';

describe('Toolbox multi-angle preview', () => {
  it('keeps the accessible preview surface and angle labels', () => {
    const markup = renderToStaticMarkup(
      <ToolboxMultiAngleStage
        azimuth={45}
        elevation={10}
        distance={4}
        clipId="preview-test"
        labels={{ hZh: '右前方四分之三视角', vZh: '平视镜头', zZh: '中景' }}
        onChange={() => undefined}
      />,
    );
    expect(markup).toContain('可视化多角度相机控制');
    expect(markup).toContain('右前方四分之三视角');
    expect(markup).toContain('preview-test-card');
  });
});
