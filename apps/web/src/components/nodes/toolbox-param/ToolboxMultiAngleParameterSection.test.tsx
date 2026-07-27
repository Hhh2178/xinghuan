import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ToolboxMultiAngleParameterSection,
  type ToolboxMultiAngleParameterSectionProps,
} from './ToolboxMultiAngleParameterSection';

const props: ToolboxMultiAngleParameterSectionProps = {
  azimuth: 0,
  elevation: 0,
  distance: 5,
  selectedAzimuthPresetId: '',
  selectedElevationPresetId: '',
  selectedDistancePresetId: '',
  selectedCreativePresetId: '',
  batchMode: 'single',
  batchAngles: [],
  promptMode: 'qwen',
  language: 'en',
  customAngles: '',
  azimuthPresets: [],
  elevationPresets: [],
  distancePresets: [],
  creativePresets: [],
  batchPresets: [{ id: 'single', label: '单条', angles: [] }],
  compactSelectClass: 'select',
  onPatch: () => undefined,
};

describe('Toolbox multi-angle parameter section', () => {
  it('owns the adjustment, angle and output parameter controls', () => {
    const markup = renderToStaticMarkup(<ToolboxMultiAngleParameterSection {...props} />);
    expect(markup).toContain('精准调节');
    expect(markup).toContain('角度列表');
    expect(markup).toContain('输出设置');
    expect(markup).toContain('Prompt：Qwen');
  });
});
