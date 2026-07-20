const MAX_REFERENCE_MEDIA = 10;
const DEFAULT_REFERENCE_MEDIA = 2;

export function readVideoReferenceMediaMax(
  schema: Record<string, unknown>,
  key: "referenceVideos" | "referenceAudio",
  fallback = DEFAULT_REFERENCE_MEDIA,
) {
  const value = schema[key] && typeof schema[key] === "object" && !Array.isArray(schema[key])
    ? schema[key] as Record<string, unknown>
    : {};
  const max = Number(value.max);
  return clampReferenceMediaMax(Number.isFinite(max) ? max : fallback);
}

export function syncVideoReferenceMediaSchema(
  schema: Record<string, unknown>,
  key: "referenceVideos" | "referenceAudio",
  enabled: boolean,
  max: number,
) {
  const next = { ...schema };
  if (!enabled) {
    delete next[key];
    return next;
  }
  const current = next[key] && typeof next[key] === "object" && !Array.isArray(next[key])
    ? next[key] as Record<string, unknown>
    : {};
  next[key] = {
    ...current,
    type: String(current.type || (key === "referenceVideos" ? "video[]" : "audio[]")),
    max: clampReferenceMediaMax(max),
    default: Math.min(DEFAULT_REFERENCE_MEDIA, clampReferenceMediaMax(max)),
  };
  return next;
}

export function clampReferenceMediaMax(value: number) {
  return Math.max(1, Math.min(MAX_REFERENCE_MEDIA, Math.floor(Number(value) || DEFAULT_REFERENCE_MEDIA)));
}

export const DEFAULT_VIDEO_REFERENCE_MEDIA_MAX = DEFAULT_REFERENCE_MEDIA;
