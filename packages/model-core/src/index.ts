export type ModelCapability = "chat" | "image" | "video" | "audio";

export type ProviderProtocol = "openai" | "gemini" | "runninghub" | "volcengine" | "apimart" | "aicopy" | "modelscope" | "custom" | "grsai_draw";

export type VideoInputMode = "reference" | "first" | "last" | "firstlast";

export type ModelCapabilityTag =
  | "text_chat"
  | "image_understanding"
  | "video_understanding"
  | "audio_understanding"
  | "reasoning"
  | "long_context"
  | "web_search"
  | "image_generation"
  | "image_edit"
  | "video_generation"
  | "tts"
  | "voice_design"
  | "voice_clone"
  | "music_generation"
  | "audio_cover"
  | "audio_extend";

export interface ModelTestResult {
  ok: boolean;
  status: number;
  message: string;
  checkedAt: number;
  latencyMs?: number;
  inferredTags?: ModelCapabilityTag[];
  sampleOutput?: string;
}

export interface ModelTestState {
  chat?: ModelTestResult;
  imageUnderstanding?: ModelTestResult;
  videoUnderstanding?: ModelTestResult;
  imageGeneration?: ModelTestResult;
  videoGeneration?: ModelTestResult;
  audioGeneration?: ModelTestResult;
  voiceClone?: ModelTestResult;
}

export interface ModelInputCapabilities {
  prompt?: boolean;
  imageReference?: boolean;
  multiImage?: boolean;
  firstFrame?: boolean;
  lastFrame?: boolean;
  mask?: boolean;
  audioReference?: boolean;
  videoReference?: boolean;
}

export interface ModelAdvancedConfig {
  mode?: string;
  submitPath?: string;
  requestMapping?: Record<string, string>;
  referenceImageTransport?: "url" | "data_url";
  fixedBody?: Record<string, unknown>;
  taskStatusPath?: string;
  taskIdPath?: string;
  resultVideoPath?: string;
  pollPathTemplate?: string;
  finalResultTaskIdPath?: string;
  finalResultPathTemplate?: string;
  finalResultVideoPath?: string;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  [key: string]: unknown;
}

export type ModelImageStaticFormat = "png" | "jpeg" | "webp" | "svg";

export interface ModelImageExactPixelOptions {
  step: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  minTotalPixels: number;
  maxTotalPixels: number;
  maxAspectRatio: number;
}

export interface ModelImageOutputGifOptions {
  enabled: boolean;
  allowReferenceImages: boolean;
  frameCount: { min: number; max: number; step: number; default: number };
  frameDurationMs: { min: number; max: number; step: number; default: number };
  size: { step: number; default: string };
}

export interface ModelImageOutputCapabilities {
  size: {
    allowExactPixels: boolean;
    exactPixels?: ModelImageExactPixelOptions;
  };
  staticFormats: ModelImageStaticFormat[];
  gif?: ModelImageOutputGifOptions;
}

export interface ModelParameterSchema {
  prompt?: { type?: string; required?: boolean };
  aspectRatio?: { type?: string; options?: string[]; default?: string };
  size?: { type?: string; options?: string[]; default?: string };
  referenceImages?: { type?: string; max?: number };
  referenceVideos?: { type?: string; max?: number; default?: number; formats?: string[] };
  referenceAudio?: { type?: string; max?: number; default?: number; formats?: string[] };
  duration?: {
    type?: string;
    options?: Array<string | number>;
    default?: string | number;
    mode?: "tiers" | "range" | string;
    min?: number;
    max?: number;
    step?: number;
  };
  resolution?: { type?: string; options?: string[]; default?: string };
  audioFormat?: { type?: string; options?: string[]; default?: string };
  voice?: { type?: string; options?: string[]; default?: string };
  imageOutput?: unknown;
  [key: string]: unknown;
}

export type ModelDurationMode = "tiers" | "range";

export interface ModelDurationRange {
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface ModelUiMetadata {
  aspectRatios: string[];
  defaultAspectRatio: string;
  sizes: string[];
  defaultSize: string;
  supportsReference: boolean;
  maxReferenceImages: number;
  maxReferenceVideos: number;
  maxReferenceAudios: number;
  durationOptions: Array<string | number>;
  defaultDuration: string | number;
  durationMode?: ModelDurationMode;
  durationRange?: ModelDurationRange;
  resolutionOptions: string[];
  defaultResolution: string;
  imageOutput?: ModelImageOutputCapabilities;
  inputCapabilities: {
    prompt: boolean;
    imageReference: boolean;
    videoReference: boolean;
    audioReference: boolean;
    multiImage: boolean;
    firstFrame: boolean;
    lastFrame: boolean;
  };
}

export function durationOptionsFromRange(range?: ModelDurationRange): number[] {
  if (!range) return [];
  const out: number[] = [];
  for (let value = range.min; value <= range.max; value += range.step) {
    out.push(value);
    if (out.length > 128) break;
  }
  if (!out.includes(range.default)) {
    out.push(range.default);
    out.sort((a, b) => a - b);
  }
  return out;
}

export interface ProviderModelDraft {
  providerId: string;
  modelId: string;
  displayName: string;
  capability: ModelCapability;
  enabled: boolean;
}

export const initialProviderModels: ProviderModelDraft[] = [
  {
    providerId: "grsai",
    modelId: "gpt-image-2",
    displayName: "GRSAI gpt-image-2",
    capability: "image",
    enabled: false,
  },
  {
    providerId: "toapis",
    modelId: "grok-video",
    displayName: "ToAPIs Grok Video",
    capability: "video",
    enabled: false,
  },
];

const IMAGE_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
const OPENAI_IMAGE_SIZES = ["1024x1024", "1536x1024", "1024x1536", "auto"];
const LEVEL_IMAGE_SIZES = ["1K", "2K", "4K"];
const APIMART_GPT26_IMAGE_OUTPUT: ModelImageOutputCapabilities = {
  size: {
    allowExactPixels: true,
    exactPixels: {
      step: 16,
      minWidth: 16,
      maxWidth: 3840,
      minHeight: 16,
      maxHeight: 3840,
      minTotalPixels: 655_360,
      maxTotalPixels: 8_294_400,
      maxAspectRatio: 3,
    },
  },
  staticFormats: ["png", "jpeg", "webp", "svg"],
  gif: {
    enabled: true,
    allowReferenceImages: true,
    frameCount: { min: 2, max: 16, step: 1, default: 9 },
    frameDurationMs: { min: 20, max: 2000, step: 10, default: 200 },
    size: { step: 16, default: "512x512" },
  },
};
const VIDEO_RATIOS = ["16:9", "9:16", "1:1"];
const VIDEO_DURATIONS = [4, 6, 8, 10, 15];
const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"];
const AUDIO_FORMATS = ["wav", "mp3", "pcm16"];
const MIMO_VOICES = ["mimo_default", "冰糖", "茉莉", "苏打", "白桦", "Mia", "Chloe", "Milo", "Dean"];

export function parseModelParameterSchema(value: unknown): ModelParameterSchema {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as ModelParameterSchema;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ModelParameterSchema : {};
  } catch {
    return {};
  }
}

export function parseInputCapabilities(value: unknown, capability: ModelCapability): ModelInputCapabilities {
  const source = parsePlainObject(value);
  const schema = parseModelParameterSchema(source.parameterSchema);
  const schemaMaxReferenceImages = Number(schema.referenceImages?.max);
  const schemaSupportsReference = Boolean(schema.referenceImages);
  const defaultImageReference = capability === "image"
    ? schemaSupportsReference || source.imageReference === true || source.multiImage === true
    : capability === "video"
    ? schemaSupportsReference || source.imageReference === true || source.multiImage === true
    : false;
  const defaultMultiImage = capability === "image"
    ? Number.isFinite(schemaMaxReferenceImages) && schemaMaxReferenceImages > 1
    : false;
  return {
    prompt: source.prompt !== false,
    imageReference: source.imageReference === undefined ? defaultImageReference : Boolean(source.imageReference),
    multiImage: source.multiImage === undefined ? defaultMultiImage : Boolean(source.multiImage),
    firstFrame: Boolean(source.firstFrame),
    lastFrame: Boolean(source.lastFrame),
    mask: Boolean(source.mask),
    audioReference: source.audioReference === undefined
      ? capability === "audio" && Boolean(schema.referenceAudio)
      : Boolean(source.audioReference),
    videoReference: Boolean(source.videoReference),
  };
}

export function parseAdvancedConfig(value: unknown): ModelAdvancedConfig {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ModelAdvancedConfig : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value as ModelAdvancedConfig : {};
}

export function defaultParameterSchemaForModel(
  capability: ModelCapability,
  modelId: string,
  protocol: ProviderProtocol = "openai",
): ModelParameterSchema {
  if (capability === "image") {
    const lower = modelId.toLowerCase();
    const isApimartGpt26 = protocol === "apimart" && /^gpt-image-2\.6-(flare|sunburst)$/.test(lower);
    const sizes = protocol === "openai" || lower.includes("gpt-image") ? OPENAI_IMAGE_SIZES : LEVEL_IMAGE_SIZES;
    return {
      prompt: { type: "string", required: true },
      aspectRatio: { type: "select", options: isApimartGpt26 ? ["1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "2:1", "1:2", "21:9", "9:21", "3:1", "1:3"] : IMAGE_RATIOS, default: "1:1" },
      size: { type: "select", options: sizes, default: sizes[0] || "1024x1024" },
      referenceImages: { type: "image[]", max: isApimartGpt26 ? 16 : lower.includes("gpt-image") ? 9 : 4 },
      ...(isApimartGpt26 ? { imageOutput: APIMART_GPT26_IMAGE_OUTPUT } : {}),
    };
  }
  if (capability === "video") {
    return {
      prompt: { type: "string", required: true },
      aspectRatio: { type: "select", options: VIDEO_RATIOS, default: "16:9" },
      duration: { type: "select", options: VIDEO_DURATIONS, default: 6 },
      resolution: { type: "select", options: VIDEO_RESOLUTIONS, default: "720p" },
      referenceImages: { type: "image[]", max: 1 },
    };
  }
  if (capability === "audio") {
    return {
      prompt: { type: "string", required: true },
      audioFormat: { type: "select", options: AUDIO_FORMATS, default: "wav" },
      voice: { type: "select", options: MIMO_VOICES, default: "mimo_default" },
      referenceAudio: { type: "audio[]", max: 1, formats: ["mp3", "wav"] },
    };
  }
  return {
    prompt: { type: "string", required: true },
  };
}

export function mergeModelParameterSchema(
  capability: ModelCapability,
  modelId: string,
  protocol: ProviderProtocol,
  value: unknown,
): ModelParameterSchema {
  return {
    ...defaultParameterSchemaForModel(capability, modelId, protocol),
    ...parseModelParameterSchema(value),
  };
}

export function uiMetadataFromSchema(
  schemaValue: unknown,
  capability: ModelCapability,
  inputCapabilitiesValue?: unknown,
): ModelUiMetadata {
  const schema = parseModelParameterSchema(schemaValue);
  const aspectRatios = compactStrings(schema.aspectRatio?.options, capability === "video" ? VIDEO_RATIOS : IMAGE_RATIOS);
  const sizes = compactStrings(schema.size?.options, capability === "image" ? OPENAI_IMAGE_SIZES : []);
  const durationSchema = parsePlainObject(schema.duration);
  const durationMode = capability === "video" && resolveDurationMode(durationSchema);
  const durationRange = capability === "video" ? resolveDurationRange(durationSchema) : undefined;
  const durationOptions = capability === "video"
    ? durationMode === "range"
      ? durationOptionsFromRange(durationRange)
      : compactValues(schema.duration?.options, VIDEO_DURATIONS)
    : compactValues(schema.duration?.options, []);
  const resolutionOptions = compactStrings(schema.resolution?.options, capability === "video" ? VIDEO_RESOLUTIONS : []);
  const maxReferenceImages = Number(schema.referenceImages?.max);
  const maxReferenceVideos = Number(schema.referenceVideos?.max);
  const maxReferenceAudios = Number(schema.referenceAudio?.max);
  const inputCapabilities = parseInputCapabilities(
    { ...parsePlainObject(inputCapabilitiesValue), parameterSchema: schema },
    capability,
  );
  return {
    aspectRatios,
    defaultAspectRatio: stringInList(schema.aspectRatio?.default, aspectRatios, aspectRatios[0] || "1:1"),
    sizes,
    defaultSize: stringInList(schema.size?.default, sizes, sizes[0] || ""),
    supportsReference: Boolean(schema.referenceImages),
    maxReferenceImages: Number.isFinite(maxReferenceImages) ? Math.max(0, Math.min(16, maxReferenceImages)) : 0,
    maxReferenceVideos: Number.isFinite(maxReferenceVideos) ? Math.max(0, Math.min(10, maxReferenceVideos)) : 0,
    maxReferenceAudios: Number.isFinite(maxReferenceAudios) ? Math.max(0, Math.min(10, maxReferenceAudios)) : 0,
    durationOptions,
    defaultDuration: durationMode === "range"
      ? (durationRange?.default ?? valueInList(schema.duration?.default, durationOptions, durationOptions[0] || 0))
      : valueInList(schema.duration?.default, durationOptions, durationOptions[0] || ""),
    ...(durationMode ? { durationMode } : {}),
    ...(durationRange ? { durationRange } : {}),
    resolutionOptions,
    defaultResolution: stringInList(schema.resolution?.default, resolutionOptions, resolutionOptions[0] || ""),
    ...(capability === "image" ? normalizeModelImageOutput(schema.imageOutput) : {}),
    inputCapabilities: {
      prompt: inputCapabilities.prompt !== false,
      imageReference: Boolean(inputCapabilities.imageReference),
      videoReference: Boolean(inputCapabilities.videoReference),
      audioReference: Boolean(inputCapabilities.audioReference),
      multiImage: Boolean(inputCapabilities.multiImage),
      firstFrame: Boolean(inputCapabilities.firstFrame),
      lastFrame: Boolean(inputCapabilities.lastFrame),
    },
  };
}

function normalizeModelImageOutput(value: unknown): Pick<ModelUiMetadata, "imageOutput"> | Record<string, never> {
  const source = parsePlainObject(value);
  if (!Object.keys(source).length) return {};

  const sizeSource = parsePlainObject(source.size);
  const exactPixelsSource = parsePlainObject(sizeSource.exactPixels);
  const exactPixels = normalizeExactPixelOptions(exactPixelsSource);
  const staticFormats = normalizeImageStaticFormats(source.staticFormats);
  const gifSource = parsePlainObject(source.gif);
  const hasGifConfig = Object.keys(gifSource).length > 0;

  return {
    imageOutput: {
      size: {
        allowExactPixels: sizeSource.allowExactPixels === true && Boolean(exactPixels),
        ...(exactPixels ? { exactPixels } : {}),
      },
      staticFormats,
      ...(hasGifConfig ? { gif: normalizeImageGifOptions(gifSource) } : {}),
    },
  };
}

function normalizeExactPixelOptions(source: Record<string, unknown>): ModelImageExactPixelOptions | undefined {
  const step = positiveInteger(source.step);
  const minWidth = positiveInteger(source.minWidth);
  const maxWidth = positiveInteger(source.maxWidth);
  const minHeight = positiveInteger(source.minHeight);
  const maxHeight = positiveInteger(source.maxHeight);
  const minTotalPixels = positiveInteger(source.minTotalPixels);
  const maxTotalPixels = positiveInteger(source.maxTotalPixels);
  const maxAspectRatio = positiveFiniteNumber(source.maxAspectRatio);
  if (!step || !minWidth || !maxWidth || !minHeight || !maxHeight
    || !minTotalPixels || !maxTotalPixels || !maxAspectRatio
    || minWidth > maxWidth || minHeight > maxHeight || minTotalPixels > maxTotalPixels) {
    return undefined;
  }
  return {
    step,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    minTotalPixels,
    maxTotalPixels,
    maxAspectRatio,
  };
}

function normalizeImageStaticFormats(value: unknown): ModelImageStaticFormat[] {
  const supported = new Set<ModelImageStaticFormat>(["png", "jpeg", "webp", "svg"]);
  if (!Array.isArray(value)) return [];
  const formats: ModelImageStaticFormat[] = [];
  for (const item of value) {
    const format = String(item || "").trim().toLowerCase();
    if (supported.has(format as ModelImageStaticFormat) && !formats.includes(format as ModelImageStaticFormat)) {
      formats.push(format as ModelImageStaticFormat);
    }
  }
  return formats;
}

function normalizeImageGifOptions(source: Record<string, unknown>): ModelImageOutputGifOptions {
  return {
    enabled: source.enabled === true,
    allowReferenceImages: source.allowReferenceImages === true,
    frameCount: normalizeImageOutputRange(source.frameCount, { min: 2, max: 16, step: 1, default: 9 }, 1),
    frameDurationMs: normalizeImageOutputRange(source.frameDurationMs, { min: 20, max: 2000, step: 10, default: 200 }, 1),
    size: normalizeImageGifSize(source.size),
  };
}

function normalizeImageOutputRange(
  value: unknown,
  fallback: { min: number; max: number; step: number; default: number },
  minimumValue: number,
): { min: number; max: number; step: number; default: number } {
  const source = parsePlainObject(value);
  let min = positiveInteger(source.min) ?? fallback.min;
  let max = positiveInteger(source.max) ?? fallback.max;
  const step = positiveInteger(source.step) ?? fallback.step;
  if (min < minimumValue) min = minimumValue;
  if (max < min) max = Math.max(fallback.max, min);
  const requestedDefault = positiveInteger(source.default) ?? fallback.default;
  const normalizedDefault = requestedDefault < min || requestedDefault > max || (requestedDefault - min) % step !== 0
    ? min
    : requestedDefault;
  return { min, max, step, default: normalizedDefault };
}

function normalizeImageGifSize(value: unknown): { step: number; default: string } {
  const source = parsePlainObject(value);
  const candidate = String(source.default || "").trim();
  const step = positiveInteger(source.step) ?? 16;
  const match = /^(\d+)x(\d+)$/i.exec(candidate);
  const width = Number(match?.[1]);
  const height = Number(match?.[2]);
  const defaultSize = match && width % step === 0 && height % step === 0
    ? `${width}x${height}`
    : "512x512";
  return {
    step,
    default: defaultSize,
  };
}

function positiveInteger(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function positiveFiniteNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePlainObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function compactStrings(values: unknown, fallback: string[]): string[] {
  const source = Array.isArray(values) ? values : fallback;
  const out: string[] = [];
  for (const value of source) {
    const text = String(value || "").trim();
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

function compactValues(values: unknown, fallback: Array<string | number>): Array<string | number> {
  const source = Array.isArray(values) ? values : fallback;
  const out: Array<string | number> = [];
  for (const value of source) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

function stringInList(value: unknown, list: string[], fallback: string) {
  const text = String(value || "").trim();
  return text && list.includes(text) ? text : fallback;
}

function valueInList(value: unknown, list: Array<string | number>, fallback: string | number) {
  return list.includes(value as string | number) ? value as string | number : fallback;
}

function resolveDurationMode(durationSchema: Record<string, unknown>): ModelDurationMode | undefined {
  const mode = String(durationSchema.mode || durationSchema.type || "").trim().toLowerCase();
  if (mode === "range") return "range";
  if (mode === "tiers" || mode === "select" || mode === "enum" || mode === "list") return "tiers";
  if (Number.isFinite(Number(durationSchema.min)) && Number.isFinite(Number(durationSchema.max))) return "range";
  if (Array.isArray(durationSchema.options)) return "tiers";
  return undefined;
}

function resolveDurationRange(durationSchema: Record<string, unknown>): ModelDurationRange | undefined {
  const min = Math.max(1, Math.round(Number(durationSchema.min)));
  const max = Math.max(min, Math.round(Number(durationSchema.max)));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  const stepValue = Number(durationSchema.step);
  const step = Number.isFinite(stepValue) && stepValue > 0 ? Math.max(1, Math.round(stepValue)) : 1;
  const defaultValue = Number(durationSchema.default);
  const defaultDuration = Number.isFinite(defaultValue)
    ? clampInteger(defaultValue, min, max, min)
    : min;
  return {
    min,
    max,
    step,
    default: defaultDuration,
  };
}

function clampInteger(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export * from "./aicopy-video-adapter.js";
