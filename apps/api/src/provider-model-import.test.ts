import { describe, expect, it } from 'vitest';
import { importProviderModels, type AdminModelRecord, type ImportModelDependencies } from './provider-model-import.js';
import type { ModelCapabilityTag } from '@xinghuan/model-core';

const deps: ImportModelDependencies = {
  normalizeCapability: (value: unknown) => (value === 'video' || value === 'audio' || value === 'chat' ? value : 'image'),
  normalizeModelCapabilityTags: (value: unknown) => Array.isArray(value) ? value.filter((item): item is ModelCapabilityTag => typeof item === 'string' && item === 'image_understanding') : [],
  inferModelCapabilityTags: () => [],
  normalizeOptionalProtocol: (value: unknown) => typeof value === 'string' && value ? value : undefined,
  normalizeAdminModelRecord: (model: AdminModelRecord) => model,
  normalizeModelTestState: (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : {},
  plainObject: (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : {},
  safeSlug: (value: unknown, fallback: string) => String(value || fallback).replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
  safeText: (value: unknown, fallback = '') => String(value ?? fallback),
};

const existing: AdminModelRecord = {
  id: 'provider-image-old', providerId: 'provider-1', modelId: 'image-old', displayName: 'Old', capability: 'image', enabled: false,
  inputProfile: 'custom', inputCapabilities: { custom: true }, capabilityTags: ['image_understanding'], testState: {},
  parameterSchema: '{"steps":20}', advancedConfig: { executionMode: 'worker_queue' }, protocolOverride: 'openai', createdAt: 10, updatedAt: 20,
};

describe('provider model import normalization', () => {
  it('updates existing records without replacing stable identity or persisted settings', () => {
    const result = importProviderModels({
      providerId: 'provider-1', now: 100, existing: [existing],
      incoming: [{ modelId: 'image-old', capability: 'image', displayName: 'Renamed', protocolOverride: 'custom', capabilityTags: ['image_understanding'] }],
      deps,
    });
    expect(result.imported).toBe(1);
    expect(result.models[0]).toMatchObject({ id: 'provider-image-old', modelId: 'image-old', displayName: 'Renamed', inputProfile: 'custom', parameterSchema: '{"steps":20}', createdAt: 10 });
    expect(result.touched[0]?.protocolOverride).toBe('custom');
  });

  it('creates capability-aware defaults for new models', () => {
    const result = importProviderModels({
      providerId: 'provider-1', now: 100, existing: [],
      incoming: [{ modelId: 'voice', capability: 'audio', displayName: 'Voice' }],
      deps,
    });
    expect(result.imported).toBe(1);
    expect(result.models[0]).toMatchObject({ providerId: 'provider-1', modelId: 'voice', capability: 'audio', inputProfile: 'prompt,audio_reference', inputCapabilities: { prompt: true, audioReference: false }, parameterSchema: '{}' });
  });
});
