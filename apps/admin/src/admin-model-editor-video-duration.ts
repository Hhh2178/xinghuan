import { durationOptionsFromRange } from "@xinghuan/model-core";

export function normalizeVideoDurationTierList(value: string) {
  return value
    .split(/[\n,，]/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.round(item))
    .filter((item, index, list) => list.indexOf(item) === index);
}

export function readVideoDurationSchema(schemaObject: Record<string, unknown>) {
  const duration = schemaObject.duration && typeof schemaObject.duration === "object" && !Array.isArray(schemaObject.duration)
    ? schemaObject.duration as Record<string, unknown>
    : {};
  const mode = String(duration.mode || duration.type || "").trim().toLowerCase();
  const isRange = mode === "range" || Number.isFinite(Number(duration.min)) && Number.isFinite(Number(duration.max));
  const range = isRange
    ? {
        min: Number(duration.min),
        max: Number(duration.max),
        step: Number(duration.step) || 1,
        default: Number(duration.default) || Number(duration.min) || 1,
      }
    : null;
  const tiers = Array.isArray(duration.options)
    ? duration.options.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0).map((item) => Math.round(item))
    : [];
  return { duration, mode: isRange ? "range" : "tiers", range, tiers };
}

export function syncVideoDurationSchema(
  schema: Record<string, unknown>,
  mode: "tiers" | "range",
  tierText: string,
  range: { minText: string; maxText: string; stepText: string; defaultText: string },
) {
  const nextSchema = { ...schema };
  if (mode === "range") {
    const min = Math.max(1, Math.round(Number(range.minText) || 1));
    const max = Math.max(min, Math.round(Number(range.maxText) || min));
    const step = Math.max(1, Math.round(Number(range.stepText) || 1));
    const defaultValue = Math.min(max, Math.max(min, Math.round(Number(range.defaultText) || min)));
    const options = durationOptionsFromRange({ min, max, step, default: defaultValue });
    const existingDuration = nextSchema.duration && typeof nextSchema.duration === "object" && !Array.isArray(nextSchema.duration)
      ? nextSchema.duration as Record<string, unknown>
      : {};
    nextSchema.duration = {
      ...existingDuration,
      type: "range",
      mode: "range",
      min,
      max,
      step,
      default: defaultValue,
      options,
    };
    return nextSchema;
  }
  const options = normalizeVideoDurationTierList(tierText);
  const defaultValue = options[0] ?? 5;
  const existingDuration = nextSchema.duration && typeof nextSchema.duration === "object" && !Array.isArray(nextSchema.duration)
    ? nextSchema.duration as Record<string, unknown>
    : {};
  nextSchema.duration = {
    ...existingDuration,
    type: "select",
    mode: "tiers",
    options,
    default: defaultValue,
  };
  return nextSchema;
}
