import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const imageSource = readFileSync(new URL('./ImageNode.tsx', import.meta.url), 'utf8');
const videoSource = readFileSync(new URL('./VideoNode.tsx', import.meta.url), 'utf8');
const llmSource = readFileSync(new URL('./LLMNode.tsx', import.meta.url), 'utf8');

describe('generation node modern presentation hooks', () => {
  it.each([
    ['image', imageSource],
    ['video', videoSource],
    ['llm', llmSource],
  ])('%s keeps its existing upstream material path while opting into modern presentation', (_kind, source) => {
    expect(source).toContain('presentation="modern"');
    expect(source).toContain('t8-generation-node');
    expect(source).toContain('useUpstreamMaterials');
    expect(source).toContain('useOrderedMaterials');
  });
});
