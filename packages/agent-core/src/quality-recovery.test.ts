import { describe, expect, it } from "vitest";

import { classifyGenerationFailure, evaluateArtifactQuality, planGenerationRecovery } from "./index.js";

describe("artifact quality evaluation", () => {
  it("uses distinct image and video dimensions with deterministic weighted scores", () => {
    const image = evaluateArtifactQuality({ mediaKind: "image", artifactId: "image-1", technicalValidity: 100, promptAlignment: 90, composition: 80, visualQuality: 70, defects: [], evidence: ["sharp"], confidence: 0.9 }, {
      id: "image-default", version: 1, mediaKind: "image", minimumOverallScore: 80, minimumConfidence: 0.8,
      weights: { technicalValidity: 2, promptAlignment: 2, composition: 1, visualQuality: 1 },
    });
    const video = evaluateArtifactQuality({ mediaKind: "video", artifactId: "video-1", technicalValidity: 100, promptAlignment: 90, composition: 80, visualQuality: 70, temporalCoherence: 40, motionQuality: 50, keyframeConsistency: 60, defects: ["flicker"], evidence: ["frame 12"], sampledTimestampsMs: [0, 1000], confidence: 0.9 }, {
      id: "video-default", version: 1, mediaKind: "video", minimumOverallScore: 75, minimumConfidence: 0.8,
      weights: { technicalValidity: 1, promptAlignment: 1, composition: 1, visualQuality: 1, temporalCoherence: 2, motionQuality: 2, keyframeConsistency: 1 },
    });
    expect(image).toMatchObject({ overallScore: 88.33, passed: true });
    expect(video.overallScore).toBeLessThan(image.overallScore);
    expect(video.passed).toBe(false);
  });
});

describe("generation failure recovery", () => {
  const policy = { maxSameConfigurationRetries: 2, maxParameterRepairs: 1, maxGenerationModelSwitches: 2, maxQualityRegenerations: 1 };
  const alternative = { providerId: "provider-backup", modelId: "image-v2", modelRecordId: "model-backup", requiresApproval: false };
  const state = { sameConfigurationRetries: 0, parameterRepairs: 0, generationModelSwitches: 0, qualityRegenerations: 0, triedModelRecordIds: ["model-primary"] };

  it("classifies technical, input, policy, content, and quality failures separately", () => {
    expect(classifyGenerationFailure({ statusCode: 429, message: "rate limited" })).toBe("transient");
    expect(classifyGenerationFailure({ statusCode: 503 })).toBe("provider");
    expect(classifyGenerationFailure({ message: "invalid parameter duration" })).toBe("parameter");
    expect(classifyGenerationFailure({ message: "content policy blocked" })).toBe("content");
    expect(classifyGenerationFailure({ code: "ARTIFACT_BELOW_THRESHOLD" })).toBe("quality");
  });

  it("retries before switching to node-configured generation alternatives", () => {
    expect(planGenerationRecovery({ failureCategory: "transient", state, policy, alternatives: [alternative] }).action).toBe("retry_same_configuration");
    expect(planGenerationRecovery({ failureCategory: "provider", state: { ...state, sameConfigurationRetries: 2 }, policy, alternatives: [alternative] })).toMatchObject({ action: "switch_generation_model", alternative });
  });

  it("requires approval when the node alternative is not pre-authorized and stops policy failures", () => {
    expect(planGenerationRecovery({ failureCategory: "provider", state: { ...state, sameConfigurationRetries: 2 }, policy, alternatives: [{ ...alternative, requiresApproval: true }] }).action).toBe("request_approval");
    expect(planGenerationRecovery({ failureCategory: "content", state, policy, alternatives: [alternative] }).action).toBe("stop");
  });

  it("applies only bounded parameter repairs and quality regenerations", () => {
    expect(planGenerationRecovery({ failureCategory: "parameter", state, policy, alternatives: [], parameterRepair: { duration: 5 } })).toMatchObject({ action: "apply_parameter_repair", parameterPatch: { duration: 5 } });
    expect(planGenerationRecovery({ failureCategory: "parameter", state: { ...state, parameterRepairs: 1 }, policy, alternatives: [], parameterRepair: { duration: 5 } }).action).toBe("stop");
    expect(planGenerationRecovery({ failureCategory: "quality", state, policy, alternatives: [] }).action).toBe("regenerate_for_quality");
    expect(planGenerationRecovery({ failureCategory: "quality", state: { ...state, qualityRegenerations: 1 }, policy, alternatives: [] }).action).toBe("stop");
  });

  it("stops after retry, model-switch, and alternative budgets are exhausted", () => {
    expect(planGenerationRecovery({
      failureCategory: "provider",
      state: { ...state, sameConfigurationRetries: 2, generationModelSwitches: 2, triedModelRecordIds: ["model-primary", "model-backup"] },
      policy,
      alternatives: [alternative],
    })).toMatchObject({ action: "stop", reason: "recovery budget exhausted or no untried node-configured alternative" });
  });
});
