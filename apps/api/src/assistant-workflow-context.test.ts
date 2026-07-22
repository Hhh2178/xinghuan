import { describe, expect, it } from "vitest";

import { summarizeWorkflowAssistantAttachment } from "./assistant-workflow-context.js";

describe("summarizeWorkflowAssistantAttachment", () => {
  it("keeps topology and model configuration while removing sensitive fields", () => {
    expect(summarizeWorkflowAssistantAttachment({
      nodes: [{ id: "text", type: "text", data: { prompt: "创作提示", apiKey: "must-not-leak" } }, { id: "image", type: "image", data: { backendProviderId: "provider-1", backendModelId: "model-1", providerModel: "nano", providerParams: { seed: 7, token: "must-not-leak" } } }],
      edges: [{ id: "text-image", source: "text", target: "image" }],
    })).toEqual(expect.objectContaining({
      nodeCount: 2,
      edgeCount: 1,
      nodes: [
        expect.objectContaining({ id: "text", data: { prompt: "创作提示" } }),
        expect.objectContaining({ id: "image", data: { backendProviderId: "provider-1", backendModelId: "model-1", providerModel: "nano", providerParams: { seed: 7 } } }),
      ],
      edges: [{ id: "text-image", source: "text", target: "image" }],
    }));
  });
});
