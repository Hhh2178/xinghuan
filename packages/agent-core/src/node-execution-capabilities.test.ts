import { describe, expect, it } from "vitest";

import { buildNodeCapabilityPromptContext, CANVAS_RUN_EXECUTABLE_NODE_TYPES, CANVAS_RUN_NATIVE_NODE_TYPES, getNodeExecutionCapability, CANVAS_RUN_NODE_CAPABILITIES } from "./index.js";

describe("node execution capability catalog", () => {
  it("keeps the maintained contract distinct from server migration state", () => {
    const image = getNodeExecutionCapability("image");
    const pick = getNodeExecutionCapability("pick-from-set");
    const text = getNodeExecutionCapability("text");

    expect(image).toMatchObject({ serverRuntime: "native_server", planEligible: true });
    expect(pick).toMatchObject({ executionKind: "transform", serverRuntime: "native_server", planEligible: true });
    expect(text).toMatchObject({ executionKind: "input", serverRuntime: "native_server", planEligible: true });
    expect(CANVAS_RUN_EXECUTABLE_NODE_TYPES.has("text")).toBe(true);
    expect(CANVAS_RUN_NATIVE_NODE_TYPES.has("pick-from-set")).toBe(true);
    expect(CANVAS_RUN_EXECUTABLE_NODE_TYPES.has("image")).toBe(true);
  });

  it("projects stable node purpose, connection and guardrail data for Agent context", () => {
    const context = buildNodeCapabilityPromptContext();
    expect(context).toContain("Canvas Node Capability Catalog");
    expect(context).toContain("pick-from-set (从合集获取)");
    expect(context).toContain("SET_INDEX_OUT_OF_RANGE");
    expect(context).toContain("legacy_browser");
    expect(context).toContain("not-plan-eligible");
    expect(context).toContain("Connection rules:");
    expect(context).toContain("Examples:");
    expect(context).toContain("Alternatives:");
  });

  it("publishes complete connection, example and alternative facts for every node", () => {
    for (const capability of CANVAS_RUN_NODE_CAPABILITIES) {
      expect(capability.connectionRules.length, capability.nodeType).toBeGreaterThan(0);
      expect(capability.usageExamples.length, capability.nodeType).toBeGreaterThan(0);
      expect(Array.isArray(capability.alternativeNodeTypes), capability.nodeType).toBe(true);
    }
  });
});
