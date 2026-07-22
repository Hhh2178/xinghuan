import { describe, expect, it } from "vitest";

import { compileCanvasSnapshotRunPlan } from "./index.js";

describe("workflow compiler", () => {
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
});
