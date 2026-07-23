import { describe, expect, it } from "vitest";

import { mergeCanvasRunRecoveryOverrides, parseCanvasRunPromptRewriteResult, planCanvasRunRecovery } from "./canvas-run-recovery-runtime.js";

const base = {
  attemptCount: 1,
  nodeId: "image-1",
  budgetSnapshot: { maxAttemptsPerStep: 2 },
  configurationSnapshot: { retryExhaustionPolicy: "compatible_fallback", maxFallbackCount: 2, promptReviewRewriteEnabled: true, promptReviewMaxRetries: 1 },
  planSnapshot: {
    steps: [{
      nodeId: "image-1",
      configuration: {
        providerId: "provider-1",
        modelId: "image-primary",
        modelRecordId: "model-primary",
        parameterRepair: { duration: 5 },
        generationAlternatives: [{ providerId: "provider-2", modelId: "image-backup", modelRecordId: "model-backup", requiresApproval: false }],
      },
    }],
  },
  priorDecisions: [],
};

describe("Canvas Run recovery runtime", () => {
  it("uses normalized timeout evidence for bounded exponential backoff", () => {
    const decision = planCanvasRunRecovery({
      ...base,
      taskResult: { failureCategory: "upstream_poll_timeout", failureReason: "provider timeout", upstreamHttpStatus: 504 },
    });
    expect(decision).toMatchObject({
      failureCategory: "transient",
      recovery: { action: "retry_same_configuration" },
      retryDelayMs: 2_000,
    });
  });

  it("switches only to the next frozen preauthorized model after retries are exhausted", () => {
    const decision = planCanvasRunRecovery({
      ...base,
      taskResult: { failureCategory: "upstream_poll_gateway_failed", failureReason: "503 bad gateway" },
      priorDecisions: [
        { actionType: "retry_same_configuration" },
        { actionType: "retry_same_configuration" },
      ],
    });
    expect(decision).toMatchObject({
      failureCategory: "provider",
      recovery: { action: "switch_generation_model", alternative: { modelRecordId: "model-backup" } },
      runtimePatch: { generationModel: { modelRecordId: "model-backup" } },
    });
  });

  it("stops after retry exhaustion when compatible fallback is disabled", () => {
    const decision = planCanvasRunRecovery({
      ...base,
      configurationSnapshot: { ...base.configurationSnapshot, retryExhaustionPolicy: "stop" },
      taskResult: { failureCategory: "upstream_poll_gateway_failed", failureReason: "503 bad gateway" },
      priorDecisions: [
        { actionType: "retry_same_configuration" },
        { actionType: "retry_same_configuration" },
      ],
    });

    expect(decision.recovery.action).toBe("stop");
    expect(decision.runtimePatch).toEqual({});
  });

  it("applies only the frozen safe parameter repair", () => {
    const decision = planCanvasRunRecovery({
      ...base,
      taskResult: { failureCategory: "model_config", failureReason: "invalid parameter duration" },
    });
    expect(decision).toMatchObject({
      failureCategory: "parameter",
      recovery: { action: "apply_parameter_repair", parameterPatch: { duration: 5 } },
      runtimePatch: { executionPayload: { duration: 5 } },
    });
  });

  it("requests a governed prompt rewrite only for content-review evidence and within budget", () => {
    expect(planCanvasRunRecovery({
      ...base,
      taskResult: { failureCategory: "unknown", failureReason: "content policy moderation blocked" },
    })).toMatchObject({
      failureCategory: "content",
      recovery: { action: "rewrite_prompt_for_review" },
      runtimePatch: { promptRewriteRequested: true },
    });
    expect(planCanvasRunRecovery({
      ...base,
      taskResult: { failureReason: "content policy blocked" },
      priorDecisions: [{ actionType: "rewrite_prompt_for_review" }],
    }).recovery.action).toBe("stop");
  });

  it("overlays audited runtime choices without mutating the immutable configuration", () => {
    const configuration = { providerId: "provider-1", modelId: "primary", modelRecordId: "model-primary", executionPayload: { prompt: "original", duration: 10 } };
    const merged = mergeCanvasRunRecoveryOverrides(configuration, {
      generationModel: { providerId: "provider-2", modelId: "backup", modelRecordId: "model-backup" },
      executionPayload: { prompt: "safe rewrite", duration: 5 },
    });
    expect(merged).toMatchObject({ providerId: "provider-2", modelId: "backup", modelRecordId: "model-backup", executionPayload: { prompt: "safe rewrite", duration: 5 } });
    expect(configuration).toEqual({ providerId: "provider-1", modelId: "primary", modelRecordId: "model-primary", executionPayload: { prompt: "original", duration: 10 } });
  });

  it("accepts only bounded structured prompt rewrites and keeps a diff ledger", () => {
    expect(parseCanvasRunPromptRewriteResult({
      content: '```json\n{"rewrittenPrompt":"safe portrait","changes":[{"before":"unsafe","after":"safe","reason":"review"}]}\n```',
    }, "unsafe portrait")).toEqual({
      prompt: "safe portrait",
      changes: [{ before: "unsafe", after: "safe", reason: "review" }],
    });
    expect(parseCanvasRunPromptRewriteResult({ content: "not json" }, "unsafe portrait")).toBeNull();
    expect(parseCanvasRunPromptRewriteResult({ content: '{"rewrittenPrompt":"unsafe portrait"}' }, "unsafe portrait")).toBeNull();
  });
});
