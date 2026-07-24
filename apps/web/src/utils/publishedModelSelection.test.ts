import { describe, expect, it } from 'vitest';

import {
  buildPublishedModelPersistencePatch,
  resolvePublishedModelSelection,
} from './publishedModelSelection';

const model = {
  id: 'catalog-image-1',
  providerId: 'provider-1',
  modelId: 'native-image-1',
  provider: { id: 'provider-1', name: 'Provider 1' },
} as any;

describe('published model selection persistence', () => {
  it('persists the catalog fallback that the node actually displays', () => {
    const selection = resolvePublishedModelSelection([model]);

    expect(buildPublishedModelPersistencePatch(selection, {})).toEqual({
      modelSource: 'backend',
      backendProviderId: 'provider-1',
      backendModelId: 'catalog-image-1',
      providerSource: '',
      providerId: 'provider-1',
      providerModel: 'native-image-1',
    });
  });

  it('does not emit a patch when visible and persisted selections agree', () => {
    const selection = resolvePublishedModelSelection([model]);

    expect(buildPublishedModelPersistencePatch(selection, {
      modelSource: 'backend',
      backendProviderId: 'provider-1',
      backendModelId: 'catalog-image-1',
      providerSource: '',
      providerId: 'provider-1',
      providerModel: 'native-image-1',
    })).toBeNull();
  });
});
