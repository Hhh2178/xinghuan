import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const imageSource = readFileSync(new URL('./ImageNode.tsx', import.meta.url), 'utf8');
const videoSource = readFileSync(new URL('./VideoNode.tsx', import.meta.url), 'utf8');
const llmSource = readFileSync(new URL('./LLMNode.tsx', import.meta.url), 'utf8');
const materialPreviewSource = readFileSync(new URL('./MaterialPreviewSection.tsx', import.meta.url), 'utf8');
const indexStyles = readFileSync(new URL('../../styles/index.css', import.meta.url), 'utf8');

describe('generation node presentation rollback', () => {
  it.each([
    ['image', imageSource],
    ['video', videoSource],
    ['llm', llmSource],
  ])('%s preserves material hooks without modern presentation markers', (_kind, source) => {
    expect(source).toContain('t8-generation-node');
    expect(source).toContain('useUpstreamMaterials');
    expect(source).toContain('useOrderedMaterials');
    expect(source).not.toContain('presentation="modern"');
    expect(source).not.toContain('data-node-presentation="generation"');
    expect(source).not.toContain('data-node-kind=');
    expect(source).not.toContain('data-node-zone=');
  });

  it('removes the material presentation prop and modern-only stylesheet import', () => {
    expect(materialPreviewSource).not.toContain('CanvasPresentation');
    expect(materialPreviewSource).not.toContain('presentation?:');
    expect(materialPreviewSource).not.toContain('data-materials-presentation');
    expect(indexStyles).not.toContain("@import './node-modern.css';");
  });
});
