import { describe, expect, it } from 'vitest';
import {
  MULTI_ANGLE_BATCH_PRESETS,
  MULTI_ANGLE_PROMPT_MODES,
  PROMPT_LANGUAGES,
  normalizeMultiAngleBatchMode,
  parseMultiAngleCustomAngles,
} from './toolbox-param-schema';

describe('toolbox parameter schema', () => {
  it('keeps persisted language, prompt-mode and batch-mode IDs stable', () => {
    expect(PROMPT_LANGUAGES).toEqual(['en', 'zh']);
    expect(MULTI_ANGLE_PROMPT_MODES).toEqual(['qwen', 'general', 'dual']);
    expect(MULTI_ANGLE_BATCH_PRESETS.map((item) => item.id)).toEqual(['single', 'three', 'four', 'eight', 'custom']);
  });

  it('normalizes persisted batch values and deduplicates custom angles', () => {
    expect(normalizeMultiAngleBatchMode('four')).toBe('four');
    expect(normalizeMultiAngleBatchMode('unknown')).toBe('single');
    expect(parseMultiAngleCustomAngles('0, 360, 90° 450')).toEqual([0, 90]);
  });
});
