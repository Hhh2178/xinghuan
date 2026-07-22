import { describe, expect, it } from "vitest";

import {
  compileCanvasRunPlan,
  compileCanvasSnapshotRunPlan,
  selectArtifactCandidates,
  transitionCanvasRunStatus,
  transitionCanvasRunStepStatus,
  transitionAgentApprovalStatus,
  transitionTaskAttemptStatus,
  canvasRunKernelOutcome,
  resolveRunnableCanvasRunSteps,
  CANVAS_RUN_NODE_CAPABILITIES,
} from "./index.js";

describe("compileCanvasRunPlan", () => {
  it("honors user group order and topological dependencies within each group", () => {
    const plan = compileCanvasRunPlan({
      canvasId: "canvas-1",
      ownerId: "user-1",
      revision: 7,
      groups: [
        { id: "generation", order: 20 },
        { id: "inputs", order: 10 },
      ],
      nodes: [
        { id: "prompt", type: "text", groupId: "inputs" },
        { id: "reference", type: "upload", groupId: "inputs" },
        { id: "image", type: "image", groupId: "generation" },
        { id: "video", type: "video", groupId: "generation" },
      ],
      edges: [
        { id: "e1", source: "prompt", target: "image" },
        { id: "e2", source: "reference", target: "image" },
        { id: "e3", source: "image", target: "video" },
      ],
    });

    expect(plan.canvasId).toBe("canvas-1");
    expect(plan.ownerId).toBe("user-1");
    expect(plan.canvasRevision).toBe(7);
    expect(plan.groups.map((group) => group.id)).toEqual(["inputs", "generation"]);
    expect(plan.steps.map((step) => step.nodeId)).toEqual(["prompt", "reference", "image", "video"]);
    expect(plan.steps.find((step) => step.nodeId === "video")?.dependsOn).toEqual(["image"]);
  });

  it("rejects a cycle instead of silently running nodes in source order", () => {
    expect(() => compileCanvasRunPlan({
      canvasId: "canvas-cycle",
      ownerId: "user-1",
      revision: 1,
      groups: [{ id: "group-1", order: 10 }],
      nodes: [
        { id: "a", type: "text", groupId: "group-1" },
        { id: "b", type: "llm", groupId: "group-1" },
      ],
      edges: [
        { id: "ab", source: "a", target: "b" },
        { id: "ba", source: "b", target: "a" },
      ],
    })).toThrowError(/CANVAS_RUN_PLAN_CYCLE/);
  });

  it("rejects an edge that requires reversing the user's group order", () => {
    expect(() => compileCanvasRunPlan({
      canvasId: "canvas-conflict",
      ownerId: "user-1",
      revision: 3,
      groups: [
        { id: "first", order: 10 },
        { id: "second", order: 20 },
      ],
      nodes: [
        { id: "early", type: "video", groupId: "first" },
        { id: "late", type: "image", groupId: "second" },
      ],
      edges: [{ id: "backwards", source: "late", target: "early" }],
    })).toThrowError(/CANVAS_RUN_GROUP_ORDER_CONFLICT:late->early/);
  });
});

describe("node execution capabilities", () => {
  it("provides a unique code-owned catalog without treating structural group nodes as executable", () => {
    const nodeTypes = CANVAS_RUN_NODE_CAPABILITIES.map((item) => item.nodeType);
    expect(new Set(nodeTypes).size).toBe(nodeTypes.length);
    expect(nodeTypes).toContain("image");
    expect(nodeTypes).toContain("runninghub");
    expect(nodeTypes).not.toContain("groupBox");
    expect(nodeTypes).not.toContain("group-execution-manager");
  });
});

describe("canvas run kernel", () => {
  const plan = compileCanvasRunPlan({
    canvasId: "canvas-kernel",
    ownerId: "owner-1",
    revision: 1,
    groups: [{ id: "first", order: 10 }, { id: "second", order: 20 }],
    nodes: [
      { id: "a", type: "image", groupId: "first" },
      { id: "b", type: "image", groupId: "first" },
      { id: "c", type: "video", groupId: "second" },
    ],
    edges: [{ id: "a-c", source: "a", target: "c" }],
  });

  it("releases parallel ready steps only from the earliest incomplete user group", () => {
    const runnable = resolveRunnableCanvasRunSteps(plan, [
      { id: "step-a", nodeId: "a", groupId: "first", sequence: 0, status: "ready" },
      { id: "step-b", nodeId: "b", groupId: "first", sequence: 1, status: "ready" },
      { id: "step-c", nodeId: "c", groupId: "second", sequence: 2, status: "ready" },
    ]);
    expect(runnable.map((step) => step.nodeId)).toEqual(["a", "b"]);
  });

  it("advances to the next group only after prior steps settle and dependencies succeed", () => {
    const runnable = resolveRunnableCanvasRunSteps(plan, [
      { id: "step-a", nodeId: "a", groupId: "first", sequence: 0, status: "succeeded" },
      { id: "step-b", nodeId: "b", groupId: "first", sequence: 1, status: "skipped" },
      { id: "step-c", nodeId: "c", groupId: "second", sequence: 2, status: "ready" },
    ]);
    expect(runnable.map((step) => step.nodeId)).toEqual(["c"]);
    expect(canvasRunKernelOutcome(runnable)).toBe("running");
  });

  it("projects deterministic terminal outcomes", () => {
    expect(canvasRunKernelOutcome([{ id: "a", nodeId: "a", groupId: null, sequence: 0, status: "succeeded" }])).toBe("succeeded");
    expect(canvasRunKernelOutcome([{ id: "a", nodeId: "a", groupId: null, sequence: 0, status: "failed" }])).toBe("failed");
  });
});

describe("compileCanvasSnapshotRunPlan", () => {
  it("derives user group order and membership from the persisted canvas revision", () => {
    const plan = compileCanvasSnapshotRunPlan({
      canvasId: "canvas-persisted",
      ownerId: "owner-1",
      revision: 12,
      data: {
        nodes: [
          { id: "group-a", type: "groupBox", position: { x: 0, y: 0 }, data: { width: 500, height: 400 } },
          { id: "group-b", type: "groupBox", position: { x: 600, y: 0 }, data: { width: 500, height: 400 } },
          { id: "manager", type: "group-execution-manager", data: { groupOrder: ["group-b", "group-a"], skippedGroupIds: ["group-a"] } },
          { id: "image", type: "image", position: { x: 50, y: 50 }, width: 200, height: 100, data: { backendProviderId: "provider-1", backendModelId: "model-1", prompt: "生成产品主图", apiKey: "must-not-snapshot", providerParams: { steps: 24, apiKey: "must-not-snapshot" }, generationAlternatives: [{ providerId: "provider-2", modelId: "image-v2", modelRecordId: "model-2", requiresApproval: false }] } },
          { id: "video", type: "video", position: { x: 650, y: 50 }, width: 200, height: 100 },
          { id: "label", type: "label", position: { x: 700, y: 200 } },
        ],
        edges: [{ id: "e1", source: "video", target: "image" }],
      },
    });

    expect(plan.groups.map((group) => [group.id, group.skipped])).toEqual([["group-b", false], ["group-a", true]]);
    expect(plan.steps.map((step) => [step.nodeId, step.groupId, step.skipped])).toEqual([
      ["video", "group-b", false],
      ["image", "group-a", true],
    ]);
    expect(plan.steps.some((step) => step.nodeId === "label")).toBe(false);
    expect(plan.steps.find((step) => step.nodeId === "image")?.configuration).toMatchObject({
      providerId: "provider-1",
      modelRecordId: "model-1",
      generationAlternatives: [{ providerId: "provider-2", modelRecordId: "model-2", requiresApproval: false }],
      taskCapability: "image",
      executionPayload: { prompt: "生成产品主图", providerParams: { steps: 24 } },
      serverRuntime: "native_server",
    });
    expect(plan.steps.find((step) => step.nodeId === "image")?.configuration).not.toHaveProperty("apiKey");
    expect(JSON.stringify(plan.steps.find((step) => step.nodeId === "image")?.configuration)).not.toContain("must-not-snapshot");
  });

  it("snapshots bounded automatic quality selection settings", () => {
    const plan = compileCanvasSnapshotRunPlan({
      canvasId: "canvas-quality",
      ownerId: "owner-1",
      revision: 3,
      data: {
        nodes: [{
          id: "image-quality",
          type: "image",
          data: {
            agentQualityEvaluation: true,
            agentQualityProfileKey: "public-image-quality",
            agentSelectionPolicy: "top_k",
            agentSelectionMaximum: 99,
            agentSelectionMinimumScore: 72,
          },
        }],
        edges: [],
      },
    });

    expect(plan.steps[0].configuration).toMatchObject({
      qualityEvaluationEnabled: true,
      qualityProfileKey: "public-image-quality",
      selectionPolicy: "top_k",
      selectionMaximum: 16,
      selectionMinimumScore: 72,
    });
  });
});

describe("selectArtifactCandidates", () => {
  it("selects the highest evaluated artifact for a single downstream input", () => {
    const selection = selectArtifactCandidates({
      policy: "best",
      maximum: 1,
      candidates: [
        { artifactId: "image-a", createdAt: 100 },
        { artifactId: "image-b", createdAt: 200 },
        { artifactId: "image-c", createdAt: 300 },
      ],
      evaluations: [
        { artifactId: "image-a", overallScore: 78, confidence: 0.9 },
        { artifactId: "image-b", overallScore: 94, confidence: 0.86 },
        { artifactId: "image-c", overallScore: 82, confidence: 0.95 },
      ],
    });

    expect(selection.selectedArtifactIds).toEqual(["image-b"]);
    expect(selection.rejectedArtifactIds).toEqual(["image-c", "image-a"]);
    expect(selection.reason).toContain("overallScore=94");
  });

  it("supports threshold, deterministic top-k, loop, and strict single bindings", () => {
    const candidates = [
      { artifactId: "a", createdAt: 100, diversityKey: "wide" },
      { artifactId: "b", createdAt: 200, diversityKey: "wide" },
      { artifactId: "c", createdAt: 300, diversityKey: "close" },
    ];
    const evaluations = [
      { artifactId: "a", overallScore: 70, confidence: 0.9 },
      { artifactId: "b", overallScore: 95, confidence: 0.8 },
      { artifactId: "c", overallScore: 88, confidence: 0.9 },
    ];

    expect(selectArtifactCandidates({ policy: "threshold", minimumScore: 85, maximum: 3, candidates, evaluations }).selectedArtifactIds).toEqual(["b", "c"]);
    expect(selectArtifactCandidates({ policy: "top_k", maximum: 2, candidates, evaluations }).selectedArtifactIds).toEqual(["b", "c"]);
    expect(selectArtifactCandidates({ policy: "diverse", maximum: 2, candidates, evaluations }).selectedArtifactIds).toEqual(["b", "c"]);
    expect(selectArtifactCandidates({ policy: "loop", candidates }).executionMode).toBe("loop");
    expect(() => selectArtifactCandidates({ policy: "single", candidates })).toThrowError(/ARTIFACT_BINDING_CARDINALITY/);
  });
});

describe("transitionCanvasRunStatus", () => {
  it("supports the observable start, pause, resume, and completion lifecycle", () => {
    let status = transitionCanvasRunStatus("draft", "planning");
    status = transitionCanvasRunStatus(status, "queued");
    status = transitionCanvasRunStatus(status, "running");
    status = transitionCanvasRunStatus(status, "paused");
    status = transitionCanvasRunStatus(status, "running");
    status = transitionCanvasRunStatus(status, "succeeded");

    expect(status).toBe("succeeded");
  });

  it("supports bounded run and step retry transitions while rejecting terminal rewrites", () => {
    expect(transitionCanvasRunStatus("failed", "queued")).toBe("queued");
    expect(transitionCanvasRunStepStatus("failed", "retry_wait")).toBe("retry_wait");
    expect(transitionCanvasRunStepStatus("retry_wait", "queued")).toBe("queued");
    expect(() => transitionCanvasRunStatus("succeeded", "running")).toThrowError(/CANVAS_RUN_INVALID_TRANSITION/);
  });

  it("keeps approvals and task attempts immutable after a terminal decision", () => {
    expect(transitionAgentApprovalStatus("pending", "approved")).toBe("approved");
    expect(() => transitionAgentApprovalStatus("approved", "rejected")).toThrowError(/AGENT_APPROVAL_INVALID_TRANSITION/);
    expect(transitionTaskAttemptStatus("queued", "running")).toBe("running");
    expect(transitionTaskAttemptStatus("running", "failed")).toBe("failed");
    expect(() => transitionTaskAttemptStatus("failed", "queued")).toThrowError(/TASK_ATTEMPT_INVALID_TRANSITION/);
  });
});
