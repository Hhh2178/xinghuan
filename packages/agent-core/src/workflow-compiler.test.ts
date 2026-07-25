import { describe, expect, it } from "vitest";

import { compileCanvasRunPlan, compileCanvasSnapshotRunPlan, compileWorkflowSnapshotRunPlan } from "./index.js";

describe("workflow compiler", () => {
  it("freezes a human display identity from the canvas node label", () => {
    const plan = compileCanvasSnapshotRunPlan({
      canvasId: "canvas-1",
      ownerId: "owner-1",
      revision: 1,
      data: {
        nodes: [{
          id: "image-1784938575967-v3uy",
          type: "image",
          data: { label: "人物生成" },
        }],
        edges: [],
      },
    });

    expect(plan.steps[0].displayIdentity).toEqual({
      label: "人物生成",
      suffix: "v3uy",
      displayName: "人物生成 #v3uy",
    });
  });

  it("freezes a bounded generation count into the immutable execution payload", () => {
    const plan = compileCanvasSnapshotRunPlan({
      canvasId: "canvas-1",
      ownerId: "owner-1",
      revision: 10,
      data: {
        nodes: [{
          id: "image-1",
          type: "image",
          data: {
            prompt: "two skyline candidates",
            generationCount: 2,
            backendProviderId: "provider-1",
            providerParams: { modelRecordId: "model-1" },
          },
        }],
        edges: [],
      },
    });

    expect(plan.steps[0].configuration?.executionPayload).toMatchObject({
      prompt: "two skyline candidates",
      generationCount: 2,
    });

    const clamped = compileCanvasSnapshotRunPlan({
      canvasId: "canvas-1",
      ownerId: "owner-1",
      revision: 11,
      data: {
        nodes: [{ id: "image-1", type: "image", data: { generationCount: 99 } }],
        edges: [],
      },
    });
    expect(clamped.steps[0].configuration?.executionPayload).toMatchObject({ generationCount: 4 });
  });

  it("includes native deterministic input and selection nodes in the immutable server plan", () => {
    const plan = compileCanvasSnapshotRunPlan({
      canvasId: "canvas-1",
      ownerId: "owner-1",
      revision: 7,
      data: {
        nodes: [
          { id: "text-1", type: "text", data: { prompt: "city in rain" } },
          { id: "image-1", type: "image", data: { backendProviderId: "provider-1", providerParams: { modelRecordId: "model-1" } } },
          { id: "pick-1", type: "pick-from-set", data: { pickKind: "image", pickIndex: 1 } },
        ],
        edges: [{ source: "text-1", target: "image-1" }, { source: "image-1", target: "pick-1" }],
      },
    });

    expect(plan.steps.map((step) => step.nodeType)).toEqual(["text", "image", "pick-from-set"]);
    expect(plan.steps[0].configuration?.serverRuntime).toBe("native_server");
    expect(plan.steps[2].configuration?.executionPayload).toMatchObject({ pickKind: "image", pickIndex: 1 });
  });

  it("freezes native resize dimensions and fit into the server plan", () => {
    const plan = compileCanvasSnapshotRunPlan({
      canvasId: "canvas-1",
      ownerId: "owner-1",
      revision: 1,
      data: {
        nodes: [{ id: "resize-1", type: "resize", data: { width: 1024, height: 768, fit: "contain" } }],
        edges: [],
      },
    });

    expect(plan.steps[0].configuration).toMatchObject({
      serverRuntime: "native_server",
      executionPayload: { width: 1024, height: 768, fit: "contain" },
    });
  });

  it("locks only the executable text-split configuration into the server plan", () => {
    const plan = compileCanvasSnapshotRunPlan({
      canvasId: "canvas-1",
      ownerId: "owner-1",
      revision: 8,
      data: {
        nodes: [{
          id: "split-1",
          type: "text-split",
          data: {
            sourceText: "one\ntwo",
            splitMode: "line",
            prefix: "{{index}}. ",
            segmentsOverride: ["first", "second"],
            textSplitFavorites: [{ name: "not execution state" }],
          },
        }],
        edges: [],
      },
    });

    expect(plan.steps[0].configuration).toMatchObject({
      serverRuntime: "native_server",
      executionPayload: {
        sourceText: "one\ntwo",
        splitMode: "line",
        prefix: "{{index}}. ",
        segmentsOverride: ["first", "second"],
      },
    });
    expect(plan.steps[0].configuration?.executionPayload).not.toHaveProperty("textSplitFavorites");
  });

  it("freezes the explicit smart candidate selector policy without transient UI state", () => {
    const plan = compileCanvasSnapshotRunPlan({
      canvasId: "canvas-1",
      ownerId: "owner-1",
      revision: 9,
      data: {
        nodes: [{
          id: "selector-1",
          type: "smart-candidate-selector",
          data: {
            selectorMediaKind: "video",
            selectorMode: "ai",
            selectorMaximum: 2,
            selectorMinimumConfidence: 0.82,
            selectorLowConfidencePolicy: "request_manual",
            selectorNote: "Keep character identity and the complete building.",
            previewSelection: ["browser-only"],
          },
        }],
        edges: [],
      },
    });

    expect(plan.steps[0]).toMatchObject({
      nodeType: "smart-candidate-selector",
      configuration: {
        serverRuntime: "native_server",
        smartCandidateSelector: {
          mediaKind: "video",
          mode: "ai",
          maximum: 2,
          minimumConfidence: 0.82,
          lowConfidencePolicy: "request_manual",
          note: "Keep character identity and the complete building.",
        },
      },
    });
    expect(JSON.stringify(plan.steps[0].configuration)).not.toContain("browser-only");
  });

  it("locks a bounded RunningHub execution reference without browser metadata or secrets", () => {
    const plan = compileCanvasSnapshotRunPlan({
      canvasId: "canvas-1",
      ownerId: "owner-1",
      revision: 9,
      data: {
        nodes: [{
          id: "rh-1",
          type: "runninghub",
          data: {
            rhWorkflowPresetId: "runninghub:workflow:workflow-1",
            instanceType: "plus",
            appInfo: {
              targetType: "workflow",
              runTargetId: "workflow-1",
              nodeInfoList: [{ nodeId: "1", fieldName: "prompt", valueType: "text", secret: "do-not-copy" }],
              rawResponse: { apiKey: "do-not-copy" },
            },
            paramValues: {
              "1::prompt": { value: "night city", sourceMaterialId: "browser-only" },
              apiKey: { value: "do-not-copy" },
            },
          },
        }],
        edges: [],
      },
    });

    expect(plan.steps[0].configuration).toMatchObject({
      runningHub: {
        catalogId: "runninghub:workflow:workflow-1",
        targetType: "workflow",
        runTargetId: "workflow-1",
        instanceType: "plus",
        fields: [{ nodeId: "1", fieldName: "prompt", valueType: "text" }],
        values: { "1::prompt": "night city" },
      },
    });
    expect(JSON.stringify(plan.steps[0].configuration)).not.toContain("do-not-copy");
    expect(JSON.stringify(plan.steps[0].configuration)).not.toContain("sourceMaterialId");
  });

  it("compiles only the requested workflow subgraph and ignores visual-only region changes", () => {
    const data = {
      nodes: [
        { id: "outside", type: "text", data: { prompt: "outside" } },
        { id: "input-1", type: "workflow-input", data: { portType: "text", variableId: "var-theme" } },
        { id: "text-1", type: "text", data: { prompt: "inside" } },
        { id: "output-1", type: "workflow-output", data: { portType: "text" } },
        { id: "outside-output", type: "output", data: {} },
      ],
      edges: [
        { id: "edge-in", source: "outside", target: "input-1" },
        { id: "edge-a", source: "input-1", target: "text-1" },
        { id: "edge-b", source: "text-1", target: "output-1" },
        { id: "edge-out", source: "output-1", target: "outside-output" },
      ],
      workflows: [{
        schemaVersion: 1,
        id: "workflow-1",
        name: "Workflow",
        revision: 5,
        memberNodeIds: ["input-1", "text-1", "output-1"],
        variables: [{ id: "var-theme", key: "theme", label: "Theme", type: "text", required: true, constraints: {}, allowAiFill: false, allowAiRewrite: true, version: 1 }],
        inputValues: { "var-theme": "inside" },
        bindings: [],
        region: { x: 20, y: 20, width: 800, height: 500, color: "#2F6B5F" },
      }],
    };
    const plan = compileWorkflowSnapshotRunPlan({ canvasId: "canvas-1", ownerId: "owner-1", revision: 12, workflowId: "workflow-1", data });
    expect(plan).toMatchObject({ workflowId: "workflow-1", workflowRevision: 5, canvasRevision: 12 });
    expect(plan.steps.map((step) => step.nodeId)).toEqual(["input-1", "text-1", "output-1"]);
    expect(plan.steps.find((step) => step.nodeId === "text-1")?.dependsOn).toEqual(["input-1"]);
    expect(plan.workflowSubgraphHash).toMatch(/^[a-f0-9]{64}$/);

    const moved = structuredClone(data);
    moved.workflows[0].region = { x: 900, y: 700, width: 900, height: 600, color: "#AA3344" };
    expect(compileWorkflowSnapshotRunPlan({ canvasId: "canvas-1", ownerId: "owner-1", revision: 13, workflowId: "workflow-1", data: moved }).workflowSubgraphHash)
      .toBe(plan.workflowSubgraphHash);
  });

  it("rejects ordinary cross-boundary edges and invalid boundary direction", () => {
    const workflow = {
      schemaVersion: 1,
      id: "workflow-1",
      name: "Workflow",
      revision: 1,
      memberNodeIds: ["text-1"],
      variables: [],
      inputValues: {},
      bindings: [],
      region: { x: 0, y: 0, width: 640, height: 420, color: "#2F6B5F" },
    };
    expect(() => compileWorkflowSnapshotRunPlan({
      canvasId: "canvas-1",
      ownerId: "owner-1",
      revision: 1,
      workflowId: "workflow-1",
      data: { nodes: [{ id: "outside", type: "text" }, { id: "text-1", type: "text" }], edges: [{ source: "outside", target: "text-1" }], workflows: [workflow] },
    })).toThrow("WORKFLOW_BOUNDARY_EDGE_INVALID:outside->text-1");
  });

  it("ignores a structurally verified automatic display output outside a workflow", () => {
    const workflow = {
      schemaVersion: 1,
      id: "workflow-1",
      name: "Workflow",
      revision: 1,
      memberNodeIds: ["task-image-0"],
      variables: [],
      inputValues: {},
      bindings: [],
      region: { x: 0, y: 0, width: 640, height: 420, color: "#2F6B5F" },
    };
    const autoOutputId = "output-auto-task-image-0-123456-image-abc";
    const plan = compileWorkflowSnapshotRunPlan({
      canvasId: "canvas-1",
      ownerId: "owner-1",
      revision: 1,
      workflowId: "workflow-1",
      data: {
        nodes: [{ id: "task-image-0", type: "image" }, { id: autoOutputId, type: "output" }],
        edges: [{ id: `e-auto-${autoOutputId}`, source: "task-image-0", target: autoOutputId }],
        workflows: [workflow],
      },
    });

    expect(plan.steps.map((step) => step.nodeId)).toEqual(["task-image-0"]);
  });

  it("keeps a manually connected output outside a workflow invalid", () => {
    const workflow = {
      schemaVersion: 1,
      id: "workflow-1",
      name: "Workflow",
      revision: 1,
      memberNodeIds: ["task-image-0"],
      variables: [],
      inputValues: {},
      bindings: [],
      region: { x: 0, y: 0, width: 640, height: 420, color: "#2F6B5F" },
    };
    expect(() => compileWorkflowSnapshotRunPlan({
      canvasId: "canvas-1",
      ownerId: "owner-1",
      revision: 1,
      workflowId: "workflow-1",
      data: {
        nodes: [{ id: "task-image-0", type: "image" }, { id: "output-manual", type: "output" }],
        edges: [{ id: "edge-manual", source: "task-image-0", target: "output-manual" }],
        workflows: [workflow],
      },
    })).toThrow("WORKFLOW_BOUNDARY_EDGE_INVALID:task-image-0->output-manual");
  });

  it("compiles workflow-owned stages including an explicit ungrouped stage", () => {
    const data = {
      nodes: [
        { id: "group-image", type: "groupBox", position: { x: 0, y: 0 }, data: { name: "图片阶段", width: 420, height: 260, memberIds: ["image"] } },
        { id: "group-video", type: "groupBox", position: { x: 500, y: 0 }, data: { name: "视频阶段", width: 420, height: 260, memberIds: ["video"] } },
        { id: "image", type: "image", position: { x: 40, y: 60 } },
        { id: "video", type: "video", position: { x: 540, y: 60 } },
        { id: "output", type: "output", position: { x: 980, y: 60 } },
      ],
      edges: [{ id: "image-video", source: "image", target: "video" }, { id: "video-output", source: "video", target: "output" }],
      workflows: [{
        schemaVersion: 1,
        id: "workflow-staged",
        name: "Staged",
        revision: 8,
        memberNodeIds: ["group-image", "group-video", "image", "video", "output"],
        variables: [], inputValues: {}, bindings: [],
        stages: [
          { id: "stage-image", name: "图片", sourceGroupNodeId: "group-image", order: 0, mode: "serial", skipped: false },
          { id: "stage-video", name: "视频", sourceGroupNodeId: "group-video", order: 1, mode: "parallel", skipped: false },
        ],
        region: { x: 0, y: 0, width: 1300, height: 500, color: "#2F6B5F" },
      }],
    };

    const plan = compileWorkflowSnapshotRunPlan({ canvasId: "canvas-1", ownerId: "owner-1", revision: 20, workflowId: "workflow-staged", data });
    expect(plan.groups.map((group) => [group.id, group.name, group.mode])).toEqual([
      ["stage-image", "图片", "serial"],
      ["stage-video", "视频", "parallel"],
      ["workflow-stage:workflow-staged:ungrouped", "未分组阶段", "serial"],
    ]);
    expect(plan.steps.map((step) => [step.nodeId, step.groupId])).toEqual([
      ["image", "stage-image"],
      ["video", "stage-video"],
      ["output", "workflow-stage:workflow-staged:ungrouped"],
    ]);

    const invalid = structuredClone(data);
    invalid.workflows[0].stages = [invalid.workflows[0].stages[1], invalid.workflows[0].stages[0]];
    invalid.workflows[0].stages.forEach((stage, index) => { stage.order = index; });
    expect(() => compileWorkflowSnapshotRunPlan({ canvasId: "canvas-1", ownerId: "owner-1", revision: 21, workflowId: "workflow-staged", data: invalid }))
      .toThrow("WORKFLOW_STAGE_ORDER_CONFLICT:image-video");
  });

  it("derives stable execution layers from dependencies", () => {
    const plan = compileCanvasRunPlan({
      canvasId: "canvas-layers",
      ownerId: "owner-1",
      revision: 1,
      groups: [{ id: "stage-1", order: 0, mode: "parallel" }],
      nodes: [
        { id: "A", type: "image", groupId: "stage-1" },
        { id: "B", type: "image", groupId: "stage-1" },
        { id: "C", type: "smart-candidate-selector", groupId: "stage-1" },
        { id: "D", type: "resize", groupId: "stage-1" },
      ],
      edges: [
        { id: "A-C", source: "A", target: "C" },
        { id: "B-C", source: "B", target: "C" },
        { id: "C-D", source: "C", target: "D" },
      ],
    });

    expect(plan.executionLayers?.map((layer) => layer.stepIds)).toEqual([
      ["step:A", "step:B"],
      ["step:C"],
      ["step:D"],
    ]);
  });

  it("keeps serial stages ordered, starts later stages after the barrier and omits skipped steps", () => {
    const plan = compileCanvasRunPlan({
      canvasId: "canvas-stages",
      ownerId: "owner-1",
      revision: 1,
      groups: [
        { id: "serial", order: 0, mode: "serial" },
        { id: "skipped", order: 1, mode: "parallel", skipped: true },
        { id: "parallel", order: 2, mode: "parallel" },
      ],
      nodes: [
        { id: "A", type: "image", groupId: "serial" },
        { id: "B", type: "image", groupId: "serial" },
        { id: "SKIP", type: "image", groupId: "skipped" },
        { id: "C", type: "image", groupId: "parallel" },
        { id: "D", type: "image", groupId: "parallel" },
      ],
      edges: [],
    });

    expect(plan.executionLayers?.map((layer) => layer.stepIds)).toEqual([
      ["step:A"],
      ["step:B"],
      ["step:C", "step:D"],
    ]);
    expect(plan.steps.find((step) => step.nodeId === "SKIP")?.executionLayer).toBeNull();
  });
});
