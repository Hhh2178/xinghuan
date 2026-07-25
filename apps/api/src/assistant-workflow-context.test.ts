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
        expect.objectContaining({ displayName: "text #text", technical: { nodeId: "text" }, data: { prompt: "创作提示" } }),
        expect.objectContaining({ displayName: "image #image", technical: { nodeId: "image" }, data: { backendProviderId: "provider-1", backendModelId: "model-1", providerModel: "nano", providerParams: { seed: 7 } } }),
      ],
      edges: [{ source: "text #text", target: "image #image", technical: { edgeId: "text-image", sourceNodeId: "text", targetNodeId: "image" } }],
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
      displayName: "video #3",
      nodeType: "video",
      planContext: { groupId: "group-1", layer: 2 },
      diagnostic: { category: "provider", title: "渠道拒绝了本次请求", technical: { code: "UPSTREAM_REJECTED", taskId: "task-9" } },
      technical: {
        runId: "run-1",
        nodeId: "video-3",
        upstreamNodeIds: ["image-2"],
        downstreamNodeIds: ["output-4"],
      },
    });
    expect(JSON.stringify(summary)).not.toMatch(/must-not-leak|apiKey|authorization/i);
  });

  it("uses human node identity by default and exposes raw identifiers only in technical detail", () => {
    const payload = {
      nodeId: "smart-candidate-selector-1784938612965-ydhc",
      nodeType: "smart-candidate-selector",
      displayName: "人物候选选择 #ydhc",
      upstreamNodeIds: ["image-1784938575967-v3uy"],
      downstreamNodeIds: ["image-1784938646749-0-jk4"],
      diagnostic: { title: "候选溯源不完整", observed: "缺少模型来源", repair: ["重跑人物生成"], technical: { taskId: "task-internal-1" } },
    };

    const brief = summarizeNodeAssistantAttachment(payload, { detailLevel: "brief" });
    expect(brief).toMatchObject({ displayName: "人物候选选择 #ydhc", nodeType: "smart-candidate-selector" });
    expect(JSON.stringify(brief)).not.toContain("smart-candidate-selector-1784938612965-ydhc");
    expect(JSON.stringify(brief)).not.toContain("image-1784938575967-v3uy");
    expect(JSON.stringify(brief)).not.toContain("task-internal-1");

    const technical = summarizeNodeAssistantAttachment(payload, { detailLevel: "technical" });
    expect(technical).toMatchObject({
      displayName: "人物候选选择 #ydhc",
      technical: {
        nodeId: "smart-candidate-selector-1784938612965-ydhc",
        upstreamNodeIds: ["image-1784938575967-v3uy"],
        downstreamNodeIds: ["image-1784938646749-0-jk4"],
      },
    });
  });

  it("projects workflow topology with display names in brief mode", () => {
    const payload = {
      nodes: [
        { id: "image-1784938575967-v3uy", type: "image", data: { label: "人物生成" } },
        { id: "smart-candidate-selector-1784938612965-ydhc", type: "smart-candidate-selector", data: { label: "人物候选选择" } },
      ],
      edges: [{ id: "edge-internal-1", source: "image-1784938575967-v3uy", target: "smart-candidate-selector-1784938612965-ydhc" }],
    };

    const brief = summarizeWorkflowAssistantAttachment(payload, { detailLevel: "brief" });
    expect(brief.nodes).toEqual([
      expect.objectContaining({ displayName: "人物生成 #v3uy", nodeType: "image" }),
      expect.objectContaining({ displayName: "人物候选选择 #ydhc", nodeType: "smart-candidate-selector" }),
    ]);
    expect(brief.edges).toEqual([{ source: "人物生成 #v3uy", target: "人物候选选择 #ydhc" }]);
    expect(JSON.stringify(brief)).not.toMatch(/178493|edge-internal/);
  });

  it("keeps edge display names aligned when a legacy node entry is malformed", () => {
    const brief = summarizeWorkflowAssistantAttachment({
      nodes: [
        {},
        { id: "image-good", type: "image", data: { label: "有效图像" } },
        { id: "output-good", type: "output", data: { label: "最终输出" } },
      ],
      edges: [{ source: "image-good", target: "output-good" }],
    }, { detailLevel: "brief" });

    expect(brief.edges).toEqual([{ source: "有效图像 #good", target: "最终输出 #good" }]);
  });
});
