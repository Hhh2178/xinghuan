import { describe, expect, it } from "vitest";

import { summarizeNodeAssistantAttachment, summarizeWorkflowAssistantAttachment } from "./assistant-workflow-context.js";

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

  it("keeps normalized failure evidence and neighboring nodes while stripping secrets", () => {
    const summary = summarizeNodeAssistantAttachment({
      source: "recent_failed_run",
      runId: "run-1",
      nodeId: "video-3",
      nodeType: "video",
      configuration: { prompt: "slow push", providerParams: { seed: 7, apiKey: "must-not-leak" } },
      upstreamNodeIds: ["image-2"],
      downstreamNodeIds: ["output-4"],
      planContext: { groupId: "group-1", layer: 2 },
      diagnostic: {
        category: "provider",
        title: "渠道拒绝了本次请求",
        observed: "Bearer must-not-leak",
        technical: { code: "UPSTREAM_REJECTED", taskId: "task-9", authorization: "must-not-leak" },
      },
    });

    expect(summary).toMatchObject({
      source: "recent_failed_run",
      runId: "run-1",
      nodeId: "video-3",
      nodeType: "video",
      upstreamNodeIds: ["image-2"],
      downstreamNodeIds: ["output-4"],
      planContext: { groupId: "group-1", layer: 2 },
      diagnostic: { category: "provider", title: "渠道拒绝了本次请求", technical: { code: "UPSTREAM_REJECTED", taskId: "task-9" } },
    });
    expect(JSON.stringify(summary)).not.toMatch(/must-not-leak|apiKey|authorization/i);
  });
});
