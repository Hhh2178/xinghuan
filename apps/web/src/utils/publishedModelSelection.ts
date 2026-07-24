import type { PublicModelRecord } from '../services/api';

export interface PublishedModelProviderGroup {
  providerId: string;
  providerName: string;
  provider: PublicModelRecord['provider'];
  models: PublicModelRecord[];
}

export interface PublishedModelSelection {
  providerGroups: PublishedModelProviderGroup[];
  selectedProviderId: string;
  selectedProviderGroup: PublishedModelProviderGroup | null;
  selectedModel: PublicModelRecord | null;
}

export interface PublishedModelPersistenceState {
  modelSource?: string;
  backendProviderId?: string;
  backendModelId?: string;
  providerSource?: string;
  providerId?: string;
  providerModel?: string;
}

export type AudioProviderMode = 'tts' | 'voice_clone' | 'voice_design';

const DIMENSION_RE = /^(\d{2,5})x(\d{2,5})$/i;

export function resolvePublishedModelSelection(
  models: PublicModelRecord[],
  current?: { selectedModelId?: string; selectedProviderId?: string },
): PublishedModelSelection {
  const providerGroups = groupPublishedModelsByProvider(models);
  if (!providerGroups.length) {
    return {
      providerGroups: [],
      selectedProviderId: '',
      selectedProviderGroup: null,
      selectedModel: null,
    };
  }

  const requestedModelId = String(current?.selectedModelId || '').trim();
  const requestedProviderId = String(current?.selectedProviderId || '').trim();
  const modelMatch = requestedModelId
    ? providerGroups.flatMap((group) => group.models).find((model) => model.id === requestedModelId) || null
    : null;
  const selectedProviderGroup = modelMatch
    ? providerGroups.find((group) => group.providerId === modelMatch.providerId) || providerGroups[0]
    : providerGroups.find((group) => group.providerId === requestedProviderId) || providerGroups[0];
  const selectedModel = modelMatch && modelMatch.providerId === selectedProviderGroup.providerId
    ? modelMatch
    : selectedProviderGroup.models[0] || null;

  return {
    providerGroups,
    selectedProviderId: selectedProviderGroup.providerId,
    selectedProviderGroup,
    selectedModel,
  };
}

export function buildPublishedModelPersistencePatch(
  selection: PublishedModelSelection,
  current: PublishedModelPersistenceState,
): PublishedModelPersistenceState | null {
  const model = selection.selectedModel;
  const provider = selection.selectedProviderGroup;
  if (!model || !provider) return null;
  const next: PublishedModelPersistenceState = {
    modelSource: 'backend',
    backendProviderId: provider.providerId,
    backendModelId: model.id,
    providerSource: '',
    providerId: model.providerId,
    providerModel: model.modelId,
  };
  return Object.entries(next).every(([key, value]) => current[key as keyof PublishedModelPersistenceState] === value)
    ? null
    : next;
}

export function filterAudioModelsByMode(
  models: PublicModelRecord[],
  mode: AudioProviderMode,
): PublicModelRecord[] {
  return models.filter((model) => isAudioModelCompatible(model, mode));
}

export function resolveCompatibleAudioProviderSelection(
  models: PublicModelRecord[],
  mode: AudioProviderMode,
  current?: { selectedModelId?: string; selectedProviderId?: string },
): PublishedModelSelection {
  return resolvePublishedModelSelection(filterAudioModelsByMode(models, mode), current);
}

export function shouldShowImageSizeControl(sizeOptions: string[]): boolean {
  const options = uniqueCompactStrings(sizeOptions);
  if (!options.length) return false;
  return options.some((option) => !isDimensionOrAutoSize(option));
}

export function pickImageSizeOptionForAspectRatio(
  sizeOptions: string[],
  aspectRatio: string,
  fallback = '',
): string {
  const options = uniqueCompactStrings(sizeOptions);
  if (!options.length) return fallback;
  if (shouldShowImageSizeControl(options)) return fallback || options[0];

  const desiredRatio = parseAspectRatio(aspectRatio);
  const desiredOrientation = ratioOrientation(desiredRatio);
  const parsed = options
    .map((option) => ({ option, dimensions: parseSizeDimensions(option) }))
    .filter((item): item is { option: string; dimensions: [number, number] } => Boolean(item.dimensions));
  if (!parsed.length) return options.find((option) => option.toLowerCase() === 'auto') || fallback || options[0];

  const best = [...parsed].sort((left, right) => {
    const leftScore = scoreSizeForAspectRatio(left.dimensions, desiredRatio, desiredOrientation);
    const rightScore = scoreSizeForAspectRatio(right.dimensions, desiredRatio, desiredOrientation);
    return leftScore - rightScore;
  })[0];
  return best?.option || fallback || options[0];
}

function groupPublishedModelsByProvider(models: PublicModelRecord[]): PublishedModelProviderGroup[] {
  const map = new Map<string, PublishedModelProviderGroup>();
  for (const model of models) {
    const key = model.providerId;
    const existing = map.get(key);
    if (existing) {
      existing.models.push(model);
      continue;
    }
    map.set(key, {
      providerId: model.providerId,
      providerName: model.provider.name,
      provider: model.provider,
      models: [model],
    });
  }
  return [...map.values()];
}

function isAudioModelCompatible(model: PublicModelRecord, mode: AudioProviderMode): boolean {
  const tags = Array.isArray(model.capabilityTags)
    ? model.capabilityTags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  const hasTts = tags.includes('tts');
  const hasVoiceClone = tags.includes('voice_clone');
  const hasVoiceDesign = tags.includes('voice_design');
  if (mode === 'voice_clone') return hasVoiceClone;
  if (mode === 'voice_design') return hasVoiceDesign && !hasVoiceClone;
  return hasTts && !hasVoiceClone && !hasVoiceDesign;
}

function uniqueCompactStrings(values: string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

function isDimensionOrAutoSize(value: string): boolean {
  const text = String(value || '').trim().toLowerCase();
  return text === 'auto' || DIMENSION_RE.test(text);
}

function parseSizeDimensions(value: string): [number, number] | null {
  const match = String(value || '').trim().match(DIMENSION_RE);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return [width, height];
}

function parseAspectRatio(value: string): number {
  const [left, right] = String(value || '').split(':').map((item) => Number(item));
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) return 1;
  return left / right;
}

function ratioOrientation(value: number): 'landscape' | 'portrait' | 'square' {
  if (Math.abs(value - 1) < 0.03) return 'square';
  return value > 1 ? 'landscape' : 'portrait';
}

function scoreSizeForAspectRatio(
  [width, height]: [number, number],
  desiredRatio: number,
  desiredOrientation: 'landscape' | 'portrait' | 'square',
): number {
  const actualRatio = width / height;
  const actualOrientation = ratioOrientation(actualRatio);
  const orientationPenalty = actualOrientation === desiredOrientation ? 0 : 1000;
  return orientationPenalty + Math.abs(actualRatio - desiredRatio);
}
