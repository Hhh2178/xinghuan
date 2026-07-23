import type { CanvasRunPlan } from "@xinghuan/agent-core";

export interface CanvasRunModelCatalogEntry {
  id: string;
  providerId: string;
  modelId: string;
  capability: string;
  enabled: boolean;
  providerEnabled: boolean;
  inputCapabilities?: Record<string, unknown>;
}

export async function resolveCanvasRunPlanModelReferences(input: {
  plan: CanvasRunPlan;
  models: CanvasRunModelCatalogEntry[];
  assertCanExecute: (modelRecordId: string) => Promise<void>;
}): Promise<CanvasRunPlan> {
  const enabled = input.models.filter((model) => model.enabled && model.providerEnabled);
  const steps = [];

  for (const step of input.plan.steps) {
    const configuration = objectValue(step.configuration);
    const capability = generationCapability(configuration.taskCapability);
    if (step.skipped || configuration.serverRuntime !== "native_server" || step.nodeType === "runninghub" || !capability) {
      steps.push(step);
      continue;
    }

    const primary = resolvePrimaryModel(enabled, {
      nodeId: step.nodeId,
      capability,
      providerId: text(configuration.providerId),
      modelId: text(configuration.modelId),
      modelRecordId: text(configuration.modelRecordId),
    });
    assertModelInputCompatibility(step.nodeId, primary, objectValue(configuration.executionPayload));
    await input.assertCanExecute(primary.id);

    const alternatives = [];
    for (const item of arrayRecords(configuration.generationAlternatives)) {
      const modelRecordId = text(item.modelRecordId);
      const candidate = enabled.find((model) => model.id === modelRecordId);
      if (!candidate
        || candidate.capability !== capability
        || (text(item.providerId) && candidate.providerId !== text(item.providerId))
        || (text(item.modelId) && candidate.modelId !== text(item.modelId))) {
        throw new Error(`CANVAS_RUN_FALLBACK_MODEL_UNAVAILABLE:${step.nodeId}:${modelRecordId || "missing"}`);
      }
      assertModelInputCompatibility(step.nodeId, candidate, objectValue(configuration.executionPayload), true);
      await input.assertCanExecute(candidate.id);
      alternatives.push({
        ...item,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        modelRecordId: candidate.id,
      });
    }

    steps.push({
      ...step,
      configuration: {
        ...configuration,
        providerId: primary.providerId,
        modelId: primary.modelId,
        modelRecordId: primary.id,
        generationAlternatives: alternatives,
      },
    });
  }

  return { ...input.plan, steps };
}

function resolvePrimaryModel(
  models: CanvasRunModelCatalogEntry[],
  input: { nodeId: string; capability: string; providerId: string; modelId: string; modelRecordId: string },
) {
  if (input.modelRecordId) {
    const exact = models.find((model) => model.id === input.modelRecordId
      && model.capability === input.capability
      && (!input.providerId || model.providerId === input.providerId)
      && (!input.modelId || model.modelId === input.modelId));
    if (!exact) throw new Error(`CANVAS_RUN_MODEL_UNAVAILABLE:${input.nodeId}`);
    return exact;
  }
  const matches = models.filter((model) => model.capability === input.capability
    && Boolean(input.modelId)
    && model.modelId === input.modelId
    && (!input.providerId || model.providerId === input.providerId));
  if (matches.length === 0) throw new Error(`CANVAS_RUN_MODEL_UNAVAILABLE:${input.nodeId}`);
  if (matches.length > 1) throw new Error(`CANVAS_RUN_MODEL_AMBIGUOUS:${input.nodeId}`);
  return matches[0];
}

function assertModelInputCompatibility(
  nodeId: string,
  model: CanvasRunModelCatalogEntry,
  payload: Record<string, unknown>,
  fallback = false,
) {
  const capabilities = objectValue(model.inputCapabilities);
  const incompatible = (hasMedia(payload, ["image", "imageUrl", "imageUrls", "images"])
    && !["imageReference", "firstFrame", "lastFrame"].some((key) => capabilities[key] === true))
    || (hasMedia(payload, ["video", "videoUrl", "videoUrls", "videos"]) && capabilities.videoReference !== true)
    || (hasMedia(payload, ["audio", "audioUrl", "audioUrls", "audios"]) && capabilities.audioReference !== true)
    || (text(payload.prompt) && capabilities.prompt === false);
  if (incompatible) {
    const prefix = fallback ? "CANVAS_RUN_FALLBACK_MODEL_INPUT_INCOMPATIBLE" : "CANVAS_RUN_MODEL_INPUT_INCOMPATIBLE";
    throw new Error(`${prefix}:${nodeId}:${model.id}`);
  }
}

function hasMedia(payload: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => {
    const value = payload[key];
    return Array.isArray(value) ? value.some((item) => Boolean(text(item))) : Boolean(text(value));
  });
}

function generationCapability(value: unknown) {
  const capability = text(value);
  return ["chat", "image", "video", "audio"].includes(capability) ? capability : "";
}

function arrayRecords(value: unknown) {
  return Array.isArray(value) ? value.map(objectValue).filter((item) => Object.keys(item).length > 0) : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
