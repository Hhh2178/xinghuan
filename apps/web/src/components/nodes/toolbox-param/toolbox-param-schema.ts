export type PromptLanguage = 'en' | 'zh';
export type MultiAnglePromptMode = 'qwen' | 'general' | 'dual';
export type MultiAngleBatchMode = 'single' | 'three' | 'four' | 'eight' | 'custom';

export interface MultiAnglePreset {
  id: string;
  label: string;
  azimuth: number;
  elevation: number;
  distance: number;
}

export interface MultiAngleFavorite extends MultiAnglePreset {
  createdAt?: number;
}

export type MultiAnglePatch = Partial<{
  multiAngleAzimuth: string | number;
  multiAngleElevation: string | number;
  multiAngleDistance: string | number;
  multiAnglePromptMode: string;
  multiAngleLanguage: string;
  multiAngleBatchMode: string;
  multiAngleBatchCustomAngles: string;
  multiAnglePrefix: string;
  multiAngleSuffix: string;
  multiAngleCustom: string;
  multiAngleFavorites: MultiAngleFavorite[];
}>;

export interface CinematicFavorite {
  id: string;
  label: string;
  cinematicPresetId?: string;
  cinematicShotId?: string;
  cinematicLightId?: string;
  cinematicColorId?: string;
  cinematicTextureId?: string;
  cinematicStrength?: string;
  cinematicCustom?: string;
  cinematicLanguage?: PromptLanguage;
  createdAt?: number;
}

export type CinematicPatch = Partial<{
  cinematicPresetId: string;
  cinematicShotId: string;
  cinematicLightId: string;
  cinematicColorId: string;
  cinematicTextureId: string;
  cinematicStrength: string;
  cinematicCustom: string;
  cinematicLanguage: PromptLanguage;
  cinematicFavorites: CinematicFavorite[];
}>;

export interface MotionFavorite {
  id: string;
  label: string;
  motionSceneId?: string;
  motionActionId?: string;
  motionPathId?: string;
  motionTempoId?: string;
  motionStabilityId?: string;
  motionSubjectId?: string;
  motionCustom?: string;
  motionLanguage?: PromptLanguage;
  createdAt?: number;
}

export type MotionPatch = Partial<{
  motionSceneId: string;
  motionActionId: string;
  motionPathId: string;
  motionTempoId: string;
  motionStabilityId: string;
  motionSubjectId: string;
  motionCustom: string;
  motionLanguage: PromptLanguage;
  motionFavorites: MotionFavorite[];
}>;

export const PROMPT_LANGUAGES = ['en', 'zh'] as const satisfies readonly PromptLanguage[];
export const MULTI_ANGLE_PROMPT_MODES = ['qwen', 'general', 'dual'] as const satisfies readonly MultiAnglePromptMode[];

export const MULTI_ANGLE_BATCH_PRESETS: ReadonlyArray<{ id: MultiAngleBatchMode; label: string; angles: number[] }> = [
  { id: 'single', label: '单条', angles: [] },
  { id: 'three', label: '三视图', angles: [0, 90, 180] },
  { id: 'four', label: '四视图', angles: [0, 90, 180, 270] },
  { id: 'eight', label: '八方位', angles: [0, 45, 90, 135, 180, 225, 270, 315] },
  { id: 'custom', label: '自定义', angles: [] },
];

export function normalizeMultiAngleBatchMode(value: unknown): MultiAngleBatchMode {
  return value === 'three' || value === 'four' || value === 'eight' || value === 'custom' ? value : 'single';
}

export function parseMultiAngleCustomAngles(value: unknown): number[] {
  if (typeof value !== 'string') return [];
  const seen = new Set<number>();
  return value
    .split(/[,，\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part.replace('°', '')))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.round(((n % 360) + 360) % 360))
    .filter((n) => {
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
}
