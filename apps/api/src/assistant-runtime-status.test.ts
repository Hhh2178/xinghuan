import { describe, expect, it } from "vitest";
import { buildAssistantRuntimeStatus } from "./assistant-runtime-status.js";

describe("buildAssistantRuntimeStatus", () => {
  it("exposes the selected model and route health without secrets", () => {
    const status = buildAssistantRuntimeStatus({
      environment: "gray",
      scope: "canvas",
      enabled: true,
      agentKey: "assistant-planner",
      poolKey: "assistant-diagnosis",
      candidates: [{ entryId: "entry-1", providerId: "provider-1", modelId: "model-1", capability: "chat", capabilityTags: ["text_chat", "image_understanding"], inputCapabilities: { imageReference: true }, priority: 1, weight: 1, state: "healthy", estimatedCost: 0, p95LatencyMs: 0 }],
      providerNames: { "provider-1": "OpenAI" },
      modelNames: { "model-1": { modelId: "gpt-4.1", displayName: "GPT-4.1" } },
    });
    expect(status).toMatchObject({ routeStatus: "ready", model: { providerName: "OpenAI", modelDisplayName: "GPT-4.1", supportsImage: true } });
  });
});
