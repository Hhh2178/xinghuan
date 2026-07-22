import { describe, expect, it } from "vitest";

import { authorizeAgentToolCall, nextLlmRouteState, routeLlmCandidates, routeStateAfterCooldown, routeVideoUnderstandingCandidates, validateAgentRoleTask } from "./index.js";

describe("LLM routing", () => {
  it("hard-rejects generation models and routes only capable chat models", () => {
    const decision = routeLlmCandidates({
      role: "image_understanding",
      scenario: "artifact-quality",
      requiredCapabilityTags: ["image_understanding"],
      maximumEstimatedCost: 0.05,
      decisionKey: "run-1:step-2",
      candidates: [
        { entryId: "image-generator", providerId: "p1", modelId: "m-image", capability: "image", capabilityTags: ["image_understanding"], priority: 1, weight: 1, state: "healthy", estimatedCost: 0.01, p95LatencyMs: 100 },
        { entryId: "vision-expensive", providerId: "p2", modelId: "m-vision-x", capability: "chat", capabilityTags: ["image_understanding"], priority: 1, weight: 1, state: "healthy", estimatedCost: 0.1, p95LatencyMs: 100 },
        { entryId: "vision-primary", providerId: "p3", modelId: "m-vision", capability: "chat", capabilityTags: ["image_understanding", "text_chat"], priority: 1, weight: 3, state: "healthy", estimatedCost: 0.02, p95LatencyMs: 200 },
        { entryId: "vision-backup", providerId: "p4", modelId: "m-vision-b", capability: "chat", capabilityTags: ["image_understanding"], priority: 2, weight: 1, state: "degraded", estimatedCost: 0.01, p95LatencyMs: 300 },
      ],
    });

    expect(decision.selectedEntryId).toBe("vision-primary");
    expect(decision.orderedEntryIds).toEqual(["vision-primary", "vision-backup"]);
    expect(decision.rejected).toEqual(expect.arrayContaining([
      { entryId: "image-generator", reason: "non_llm_capability" },
      { entryId: "vision-expensive", reason: "cost_limit" },
    ]));
  });

  it("keeps quality failure separate from technical circuit state", () => {
    expect(nextLlmRouteState({ current: "healthy", outcome: "quality_failure", consecutiveTechnicalFailures: 0, failureThreshold: 3 })).toBe("healthy");
    expect(nextLlmRouteState({ current: "degraded", outcome: "technical_failure", consecutiveTechnicalFailures: 2, failureThreshold: 3 })).toBe("circuit_open");
    expect(routeStateAfterCooldown({ current: "circuit_open", openedAt: 100, now: 1_100, cooldownMs: 1_000 })).toBe("half_open");
  });

  it("rejects an open circuit but admits the same route in half-open state", () => {
    const base = { entryId: "probe", providerId: "p1", modelId: "m1", capability: "chat", capabilityTags: ["checker"], priority: 1, weight: 1, estimatedCost: 0, p95LatencyMs: 100 };
    expect(() => routeLlmCandidates({ role: "checker", scenario: "review", requiredCapabilityTags: ["checker"], decisionKey: "open", candidates: [{ ...base, state: "circuit_open" }] })).toThrow("LLM_ROUTE_UNAVAILABLE:checker:review");
    expect(routeLlmCandidates({ role: "checker", scenario: "review", requiredCapabilityTags: ["checker"], decisionKey: "probe", candidates: [{ ...base, state: "half_open" }] }).selectedEntryId).toBe("probe");
  });

  it("hard-rejects video models that cannot accept the requested input transport", () => {
    const decision = routeLlmCandidates({
      role: "video_understanding",
      scenario: "artifact-quality",
      requiredCapabilityTags: ["video_understanding"],
      requiredInputCapabilities: ["videoReference"],
      decisionKey: "run-1:video-native",
      candidates: [
        { entryId: "frame-only", providerId: "p1", modelId: "m1", capability: "chat", capabilityTags: ["video_understanding"], inputCapabilities: { imageReference: true }, priority: 1, weight: 1, state: "healthy", estimatedCost: 0.01, p95LatencyMs: 100 },
        { entryId: "native-video", providerId: "p2", modelId: "m2", capability: "chat", capabilityTags: ["video_understanding"], inputCapabilities: { videoReference: true }, priority: 2, weight: 1, state: "healthy", estimatedCost: 0.02, p95LatencyMs: 200 },
      ],
    });

    expect(decision.selectedEntryId).toBe("native-video");
    expect(decision.rejected).toContainEqual({ entryId: "frame-only", reason: "missing_input_capability" });
  });

  it("prefers native full-video understanding before sampled-frame candidates", () => {
    const routed = routeVideoUnderstandingCandidates({
      scenario: "artifact-quality",
      decisionKey: "run-1:artifact-1",
      hasSampledFrames: true,
      candidates: [
        { entryId: "frame-first", providerId: "p1", modelId: "m1", capability: "chat", capabilityTags: ["video_understanding"], inputCapabilities: { imageReference: true }, mediaInputTransports: ["sampled_frames"], priority: 1, weight: 1, state: "healthy", estimatedCost: 0.01, p95LatencyMs: 100 },
        { entryId: "gemini-native", providerId: "p2", modelId: "m2", capability: "chat", capabilityTags: ["video_understanding"], inputCapabilities: { videoReference: true }, mediaInputTransports: ["gemini_file"], priority: 2, weight: 1, state: "healthy", estimatedCost: 0.02, p95LatencyMs: 200 },
      ],
    });

    expect(routed.mode).toBe("native_video");
    expect(routed.decision.selectedEntryId).toBe("gemini-native");
    expect(routed.fallbackDecision?.selectedEntryId).toBe("frame-first");
  });

  it("does not enable remote URL delivery from a route snapshot alone", () => {
    const candidates = [
      { entryId: "remote-url", providerId: "p1", modelId: "m1", capability: "chat", capabilityTags: ["video_understanding"], inputCapabilities: { videoReference: true }, mediaInputTransports: ["remote_url"], priority: 1, weight: 1, state: "healthy" as const, estimatedCost: 0.01, p95LatencyMs: 100 },
      { entryId: "gemini-file", providerId: "p2", modelId: "m2", capability: "chat", capabilityTags: ["video_understanding"], inputCapabilities: { videoReference: true }, mediaInputTransports: ["gemini_file"], priority: 2, weight: 1, state: "healthy" as const, estimatedCost: 0.02, p95LatencyMs: 100 },
    ];

    expect(routeVideoUnderstandingCandidates({ scenario: "artifact-quality", decisionKey: "default", hasSampledFrames: false, candidates }).decision.selectedEntryId).toBe("gemini-file");
    expect(routeVideoUnderstandingCandidates({ scenario: "artifact-quality", decisionKey: "gateway", hasSampledFrames: false, candidates, enabledNativeTransports: ["remote_url"] }).decision.selectedEntryId).toBe("remote-url");
  });

  it("uses an existing sampled-frame route when no native-video route is eligible", () => {
    const routed = routeVideoUnderstandingCandidates({
      scenario: "artifact-quality",
      decisionKey: "run-1:artifact-frames",
      hasSampledFrames: true,
      candidates: [
        { entryId: "frame-route", providerId: "p1", modelId: "m1", capability: "chat", capabilityTags: ["video_understanding"], inputCapabilities: { imageReference: true }, mediaInputTransports: ["sampled_frames"], priority: 1, weight: 1, state: "healthy", estimatedCost: 0.01, p95LatencyMs: 100 },
      ],
    });

    expect(routed.mode).toBe("sampled_frames");
    expect(routed.decision.selectedEntryId).toBe("frame-route");
    expect(routed.fallbackDecision).toBeUndefined();
  });

  it("fails explicitly when neither native video nor existing frame evidence is available", () => {
    expect(() => routeVideoUnderstandingCandidates({
      scenario: "artifact-quality",
      decisionKey: "run-1:artifact-no-input",
      hasSampledFrames: false,
      candidates: [
        { entryId: "frame-route", providerId: "p1", modelId: "m1", capability: "chat", capabilityTags: ["video_understanding"], inputCapabilities: { imageReference: true }, mediaInputTransports: ["sampled_frames"], priority: 1, weight: 1, state: "healthy", estimatedCost: 0.01, p95LatencyMs: 100 },
      ],
    })).toThrow("LLM_ROUTE_UNAVAILABLE:video_understanding:artifact-quality");
  });
});

describe("agent policy", () => {
  const task = {
    id: "agent-task-1", ownerId: "owner-1", role: "planner" as const, scenario: "canvas-plan",
    inputSchema: "canvas-plan-input/v1", outputSchema: "canvas-plan-output/v1",
    toolAllowlist: ["canvas.read", "canvas-run.preview"], maxTokens: 4_000, timeoutMs: 30_000,
  };

  it("enforces bounded schemas, tools, owner, revision, budget, and approval", () => {
    expect(validateAgentRoleTask(task).toolAllowlist).toEqual(["canvas.read", "canvas-run.preview"]);
    expect(authorizeAgentToolCall({ task, tool: "canvas.read", ownerId: "owner-1", canvasRevisionMatches: true, budgetAvailable: true, approvalRequired: false, approvalGranted: false })).toMatchObject({ allowed: true });
    expect(() => authorizeAgentToolCall({ task, tool: "canvas.write", ownerId: "owner-1", canvasRevisionMatches: true, budgetAvailable: true, approvalRequired: false, approvalGranted: false })).toThrowError(/AGENT_TOOL_NOT_ALLOWED/);
    expect(() => validateAgentRoleTask({ ...task, toolAllowlist: ["shell"] })).toThrowError(/AGENT_TASK_TOOL_FORBIDDEN:shell/);
  });
});
