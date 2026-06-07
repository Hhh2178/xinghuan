export type ModelCapability = "chat" | "image" | "video";

export type ProviderProtocol = "openai" | "gemini" | "runninghub" | "volcengine" | "apimart" | "custom" | "grsai_draw";

export interface ModelParameterSchema {
  prompt?: { type?: string; required?: boolean };
  aspectRatio?: { type?: string; options?: string[]; default?: string };
  size?: { type?: string; options?: string[]; default?: string };
  referenceImages?: { type?: string; max?: number };
  duration?: { type?: string; options?: Array<string | number>; default?: string | number };
  resolution?: { type?: string; options?: string[]; default?: string };
  [key: string]: unknown;
}

export interface ModelUiMetadata {
  aspectRatios: string[];
  defaultAspectRatio: string;
  sizes: string[];
  defaultSize: string;
  supportsReference: boolean;
  maxReferenceImages: number;
  durationOptions: Array<string | number>;
  defaultDuration: string | number;
  resolutionOptions: string[];
  defaultResolution: string;
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
const VIDEO_RATIOS = ["16:9", "9:16", "1:1"];
const VIDEO_DURATIONS = [4, 6, 8, 10, 15];
const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"];

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

export function defaultParameterSchemaForModel(
  capability: ModelCapability,
  modelId: string,
  protocol: ProviderProtocol = "openai",
): ModelParameterSchema {
  if (capability === "image") {
    const lower = modelId.toLowerCase();
    const sizes = protocol === "openai" || lower.includes("gpt-image") ? OPENAI_IMAGE_SIZES : LEVEL_IMAGE_SIZES;
    return {
      prompt: { type: "string", required: true },
      aspectRatio: { type: "select", options: IMAGE_RATIOS, default: "1:1" },
      size: { type: "select", options: sizes, default: sizes[0] || "1024x1024" },
      referenceImages: { type: "image[]", max: lower.includes("gpt-image") ? 9 : 4 },
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

export function uiMetadataFromSchema(schemaValue: unknown, capability: ModelCapability): ModelUiMetadata {
  const schema = parseModelParameterSchema(schemaValue);
  const aspectRatios = compactStrings(schema.aspectRatio?.options, capability === "video" ? VIDEO_RATIOS : IMAGE_RATIOS);
  const sizes = compactStrings(schema.size?.options, capability === "image" ? OPENAI_IMAGE_SIZES : []);
  const durationOptions = compactValues(schema.duration?.options, capability === "video" ? VIDEO_DURATIONS : []);
  const resolutionOptions = compactStrings(schema.resolution?.options, capability === "video" ? VIDEO_RESOLUTIONS : []);
  const maxReferenceImages = Number(schema.referenceImages?.max);
  return {
    aspectRatios,
    defaultAspectRatio: stringInList(schema.aspectRatio?.default, aspectRatios, aspectRatios[0] || "1:1"),
    sizes,
    defaultSize: stringInList(schema.size?.default, sizes, sizes[0] || ""),
    supportsReference: Boolean(schema.referenceImages),
    maxReferenceImages: Number.isFinite(maxReferenceImages) ? Math.max(0, Math.min(16, maxReferenceImages)) : 0,
    durationOptions,
    defaultDuration: valueInList(schema.duration?.default, durationOptions, durationOptions[0] || ""),
    resolutionOptions,
    defaultResolution: stringInList(schema.resolution?.default, resolutionOptions, resolutionOptions[0] || ""),
  };
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
