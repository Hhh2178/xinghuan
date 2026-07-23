import { describe, expect, it, vi } from "vitest";

import { resolveCanvasRunPlanModelReferences } from "./canvas-run-model-preflight.js";

const plan = {
  canvasId: "canvas-1",
  ownerId: "owner-1",
  canvasRevision: 3,
  groups: [{ id: "stage-1", order: 0, skipped: false, stepIds: ["step-image"] }],
  steps: [{
    id: "step-image",
    nodeId: "image-1",
    nodeType: "image",
    groupId: "stage-1",
    dependsOn: [],
    skipped: false,
    configuration: {
      providerId: "",
      modelId: "gpt-image-2",
      modelRecordId: "",
      taskCapability: "image",
      serverRuntime: "native_server",
      executionPayload: { prompt: "portrait" },
      generationAlternatives: [],
    },
  }],
} as any;

const models = [{
  id: "model-record-1",
  providerId: "provider-1",
  modelId: "gpt-image-2",
  capability: "image",
  enabled: true,
  providerEnabled: true,
  inputCapabilities: { prompt: true },
}];

describe("Canvas Run model preflight", () => {
  it("repairs a unique enabled legacy model name before the immutable Run is created", async () => {
    const assertCanExecute = vi.fn(async () => undefined);
    const resolved = await resolveCanvasRunPlanModelReferences({ plan, models, assertCanExecute });

    expect(resolved.steps[0].configuration).toMatchObject({
      providerId: "provider-1",
      modelId: "gpt-image-2",
      modelRecordId: "model-record-1",
    });
    expect(assertCanExecute).toHaveBeenCalledWith("model-record-1");
    expect(plan.steps[0].configuration.modelRecordId).toBe("");
  });

  it("rejects ambiguous legacy names instead of choosing a provider silently", async () => {
    await expect(resolveCanvasRunPlanModelReferences({
      plan,
      models: [...models, { ...models[0], id: "model-record-2", providerId: "provider-2" }],
      assertCanExecute: async () => undefined,
    })).rejects.toThrow("CANVAS_RUN_MODEL_AMBIGUOUS:image-1");
  });

  it("rejects disabled, capability-mismatched and input-incompatible records", async () => {
    await expect(resolveCanvasRunPlanModelReferences({
      plan,
      models: [{ ...models[0], enabled: false }],
      assertCanExecute: async () => undefined,
    })).rejects.toThrow("CANVAS_RUN_MODEL_UNAVAILABLE:image-1");

    await expect(resolveCanvasRunPlanModelReferences({
      plan,
      models: [{ ...models[0], capability: "video" }],
      assertCanExecute: async () => undefined,
    })).rejects.toThrow("CANVAS_RUN_MODEL_UNAVAILABLE:image-1");

    await expect(resolveCanvasRunPlanModelReferences({
      plan: {
        ...plan,
        steps: [{ ...plan.steps[0], configuration: { ...plan.steps[0].configuration, executionPayload: { prompt: "animate", images: ["asset.png"] } } }],
      },
      models: [{ ...models[0], inputCapabilities: { prompt: true, imageReference: false } }],
      assertCanExecute: async () => undefined,
    })).rejects.toThrow("CANVAS_RUN_MODEL_INPUT_INCOMPATIBLE:image-1:model-record-1");
  });

  it("validates every frozen fallback without reordering the published node chain", async () => {
    const fallback = { ...models[0], id: "model-record-2", providerId: "provider-2", modelId: "image-backup" };
    const resolved = await resolveCanvasRunPlanModelReferences({
      plan: {
        ...plan,
        steps: [{
          ...plan.steps[0],
          configuration: {
            ...plan.steps[0].configuration,
            generationAlternatives: [{ providerId: "provider-2", modelId: "image-backup", modelRecordId: "model-record-2", requiresApproval: false }],
          },
        }],
      },
      models: [...models, fallback],
      assertCanExecute: async () => undefined,
    });

    expect((resolved.steps[0].configuration?.generationAlternatives as any[])[0]).toMatchObject({
      providerId: "provider-2",
      modelId: "image-backup",
      modelRecordId: "model-record-2",
    });

    await expect(resolveCanvasRunPlanModelReferences({
      plan: {
        ...plan,
        steps: [{ ...plan.steps[0], configuration: { ...plan.steps[0].configuration, generationAlternatives: [{ providerId: "provider-2", modelId: "missing", modelRecordId: "missing-record" }] } }],
      },
      models,
      assertCanExecute: async () => undefined,
    })).rejects.toThrow("CANVAS_RUN_FALLBACK_MODEL_UNAVAILABLE:image-1:missing-record");
  });
});
