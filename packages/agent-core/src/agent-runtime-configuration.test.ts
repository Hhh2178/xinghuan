import { describe, expect, it } from "vitest";

import { diffAgentRuntimeConfiguration, normalizeAgentRuntimeConfiguration } from "./index.js";

describe("published Agent runtime configuration", () => {
  it("normalizes every runtime-effective field into one bounded schema", () => {
    const value = normalizeAgentRuntimeConfiguration({
      promptTemplate: "Plan carefully for {{scenario}}.",
      roleDescription: "Canvas planner",
      llmPoolKey: "assistant-planner",
      knowledge: { collectionAllowlist: ["public-canvas", "public-canvas"], audience: "public", topK: 6, tokenBudget: 2400 },
      toolAllowlist: ["knowledge.node.get", "canvas.patch.propose"],
      maxTokens: 5000,
      timeoutMs: 90000,
      budget: { maximumEstimatedCost: 1.25 },
      approvalPolicy: { structuralChanges: "required", generationModelSwitch: "required" },
      automaticRecovery: { enabled: true, maxAttempts: 2 },
      qualityProfileKey: "image-default",
    });

    expect(value).toEqual({
      promptTemplate: "Plan carefully for {{scenario}}.",
      roleDescription: "Canvas planner",
      llmPoolKey: "assistant-planner",
      knowledge: { collectionAllowlist: ["public-canvas"], audience: "public", topK: 6, tokenBudget: 2400 },
      toolAllowlist: ["canvas.patch.propose", "knowledge.node.get"],
      maxTokens: 5000,
      timeoutMs: 90000,
      budget: { maximumEstimatedCost: 1.25 },
      approvalPolicy: { structuralChanges: "required", generationModelSwitch: "required" },
      automaticRecovery: { enabled: true, maxAttempts: 2 },
      qualityProfileKey: "image-default",
    });
  });

  it("rejects unknown tools and attempts to bypass structural approval", () => {
    expect(() => normalizeAgentRuntimeConfiguration({ toolAllowlist: ["shell.exec"] })).toThrow("AGENT_CONFIGURATION_TOOL_UNKNOWN");
    expect(() => normalizeAgentRuntimeConfiguration({ approvalPolicy: { structuralChanges: "allow" } })).toThrow("AGENT_CONFIGURATION_STRUCTURAL_APPROVAL_REQUIRED");
  });

  it("produces a structured field diff instead of raw JSON", () => {
    const before = normalizeAgentRuntimeConfiguration({ maxTokens: 4000, knowledge: { collectionAllowlist: ["public-canvas"] } });
    const after = normalizeAgentRuntimeConfiguration({ maxTokens: 8000, knowledge: { collectionAllowlist: ["public-canvas", "internal-ops"] } });
    expect(diffAgentRuntimeConfiguration(before, after)).toEqual([
      { field: "knowledge.collectionAllowlist", before: ["public-canvas"], after: ["internal-ops", "public-canvas"] },
      { field: "maxTokens", before: 4000, after: 8000 },
    ]);
  });
});
