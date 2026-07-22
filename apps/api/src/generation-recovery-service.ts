import { classifyGenerationFailure, planGenerationRecovery, type GenerationModelAlternative, type RecoveryPolicy } from "@xinghuan/agent-core";

import type { RecoveryContextRecord } from "./recovery-decision-repository.js";

export function createGenerationRecoveryService(deps: {
  repository: {
    readContext(ownerId: string, canvasRunId: string, runStepId: string): Promise<RecoveryContextRecord | null>;
    recordDecision(input: any): Promise<string>;
  };
  createApproval: (input: { ownerId: string; canvasRunId: string; runStepId: string; actionType: string; actionSnapshot: Record<string, unknown>; requestedBy: string }) => Promise<{ id: string }>;
}) {
  async function plan(input: {
    ownerId: string;
    canvasRunId: string;
    runStepId: string;
    idempotencyKey: string;
    taskAttemptId?: string;
    agentRunId?: string;
    error: { statusCode?: number; code?: string; message?: string };
    policy: RecoveryPolicy;
  }) {
    const context = await deps.repository.readContext(input.ownerId, input.canvasRunId, input.runStepId);
    if (!context) throw new Error("RECOVERY_CONTEXT_NOT_FOUND");
    const step = runPlanStep(context);
    const configuration = objectValue(step.configuration);
    const alternatives = generationAlternatives(configuration.generationAlternatives);
    const failureCategory = classifyGenerationFailure(input.error);
    const prior = context.priorActions;
    const recovery = planGenerationRecovery({
      failureCategory,
      state: {
        sameConfigurationRetries: count(prior, "retry_same_configuration"),
        parameterRepairs: count(prior, "apply_parameter_repair"),
        generationModelSwitches: count(prior, "switch_generation_model"),
        qualityRegenerations: count(prior, "regenerate_for_quality"),
        triedModelRecordIds: [context.currentModelRecordId, ...context.triedModelRecordIds].filter(Boolean),
      },
      policy: input.policy,
      alternatives,
      parameterRepair: objectValue(configuration.parameterRepair),
    });
    let approvalId: string | undefined;
    if (recovery.action === "request_approval" && recovery.alternative) {
      const approval = await deps.createApproval({
        ownerId: context.ownerId,
        canvasRunId: context.canvasRunId,
        runStepId: context.runStepId,
        actionType: "switch_generation_model",
        actionSnapshot: { providerId: recovery.alternative.providerId, modelId: recovery.alternative.modelId, modelRecordId: recovery.alternative.modelRecordId, reason: recovery.reason },
        requestedBy: input.agentRunId || "recovery-policy",
      });
      approvalId = approval.id;
    }
    const decisionId = await deps.repository.recordDecision({
      context,
      failureCategory,
      plan: recovery,
      taskAttemptId: input.taskAttemptId,
      agentRunId: input.agentRunId,
      approvalId,
      budgetSnapshot: input.policy,
      idempotencyKey: input.idempotencyKey,
    });
    return { decisionId, approvalId, failureCategory, recovery };
  }

  return { plan };
}

function runPlanStep(context: RecoveryContextRecord): Record<string, unknown> {
  const steps = Array.isArray(context.planSnapshot.steps) ? context.planSnapshot.steps.filter((item) => item && typeof item === "object") as Record<string, unknown>[] : [];
  const step = steps.find((item) => item.nodeId === context.nodeId);
  if (!step) throw new Error("RECOVERY_PLAN_STEP_NOT_FOUND");
  return step;
}

function generationAlternatives(value: unknown): GenerationModelAlternative[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object").map((item) => {
    const row = item as Record<string, unknown>;
    return {
      providerId: text(row.providerId), modelId: text(row.modelId), modelRecordId: text(row.modelRecordId),
      parameterPatch: objectValue(row.parameterPatch), requiresApproval: row.requiresApproval !== false,
    };
  }).filter((item) => item.providerId && item.modelRecordId);
}

function count(values: string[], target: string) {
  return values.filter((value) => value === target).length;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
