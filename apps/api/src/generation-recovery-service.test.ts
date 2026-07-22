import { describe, expect, it, vi } from "vitest";

import { createGenerationRecoveryService } from "./generation-recovery-service.js";

function context(priorActions: string[] = []) {
  return {
    ownerId: "owner-1", canvasRunId: "run-1", runStepId: "step-1", nodeId: "image-node",
    planSnapshot: { steps: [{ nodeId: "image-node", configuration: { providerId: "provider-1", modelRecordId: "model-primary", parameterRepair: { duration: 5 }, generationAlternatives: [{ providerId: "provider-2", modelId: "image-v2", modelRecordId: "model-backup", requiresApproval: true }] } }] },
    currentProviderId: "provider-1", currentModelId: "image-v1", currentModelRecordId: "model-primary", attempts: 1, priorActions, triedModelRecordIds: [],
  };
}

describe("generation recovery service", () => {
  const policy = { maxSameConfigurationRetries: 2, maxParameterRepairs: 1, maxGenerationModelSwitches: 1, maxQualityRegenerations: 1 };

  it("uses immutable run plan alternatives and requests approval after retry budget", async () => {
    const createApproval = vi.fn(async () => ({ id: "approval-1" }));
    const recordDecision = vi.fn(async () => "decision-1");
    const service = createGenerationRecoveryService({ repository: { readContext: async () => context(["retry_same_configuration", "retry_same_configuration"]), recordDecision }, createApproval });
    const result = await service.plan({ ownerId: "owner-1", canvasRunId: "run-1", runStepId: "step-1", idempotencyKey: "recover-1", error: { statusCode: 503 }, policy });
    expect(result).toMatchObject({ decisionId: "decision-1", approvalId: "approval-1", failureCategory: "provider", recovery: { action: "request_approval", alternative: { modelRecordId: "model-backup" } } });
    expect(createApproval).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-1", actionType: "switch_generation_model" }));
    expect(recordDecision).toHaveBeenCalledWith(expect.objectContaining({ context: expect.objectContaining({ ownerId: "owner-1" }), approvalId: "approval-1" }));
  });

  it("does not switch generation models before same-configuration retries are exhausted", async () => {
    const service = createGenerationRecoveryService({ repository: { readContext: async () => context(), recordDecision: async () => "decision-1" }, createApproval: vi.fn() });
    const result = await service.plan({ ownerId: "owner-1", canvasRunId: "run-1", runStepId: "step-1", idempotencyKey: "recover-1", error: { message: "temporary timeout" }, policy });
    expect(result.recovery.action).toBe("retry_same_configuration");
  });
});
