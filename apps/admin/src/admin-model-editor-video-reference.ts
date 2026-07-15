const MAX_REFERENCE_IMAGES = 16;

export function readVideoReferenceImageMax(schema: Record<string, unknown>, fallback = 1) {
  const referenceImages = schema.referenceImages && typeof schema.referenceImages === "object" && !Array.isArray(schema.referenceImages)
    ? schema.referenceImages as Record<string, unknown>
    : {};
  const value = Number(referenceImages.max);
  return clampReferenceImageMax(Number.isFinite(value) ? value : fallback);
}

export function syncVideoReferenceImageSchema(
  schema: Record<string, unknown>,
  enabled: boolean,
  maxReferenceImages: number,
) {
  const next = { ...schema };
  if (!enabled) {
    delete next.referenceImages;
    return next;
  }
  const current = next.referenceImages && typeof next.referenceImages === "object" && !Array.isArray(next.referenceImages)
    ? next.referenceImages as Record<string, unknown>
    : {};
  next.referenceImages = {
    ...current,
    type: String(current.type || "image[]"),
    max: clampReferenceImageMax(maxReferenceImages),
  };
  return next;
}

export function legacyMultiImageFromReferenceLimit(enabled: boolean, maxReferenceImages: number) {
  return enabled && clampReferenceImageMax(maxReferenceImages) > 1;
}

function clampReferenceImageMax(value: number) {
  return Math.max(1, Math.min(MAX_REFERENCE_IMAGES, Math.floor(Number(value) || 1)));
}
