import {
  classifyGenerationFailure,
  planGenerationRecovery,
  type GenerationFailureCategory,
  type GenerationModelAlternative,
  type RecoveryActionType,
} from "@xinghuan/agent-core";

export interface CanvasRunRecoveryPriorDecision {
  actionType: RecoveryActionType | string;
  alternativeModelRecordId?: string;
}

export function planCanvasRunRecovery(input: {
  attemptCount: number;
  nodeId: string;
  planSnapshot: Record<string, unknown>;
  budgetSnapshot: Record<string, unknown>;
  configurationSnapshot: Record<string, unknown>;
  taskResult: Record<string, unknown>;
  priorDecisions: CanvasRunRecoveryPriorDecision[];
}) {
  const planStep = arrayRecords(objectValue(input.planSnapshot).steps).find((step) => text(step.nodeId) === input.nodeId) || {};
  const configuration = objectValue(planStep.configuration);
  const failureCategory = classifyTaskFailure(input.taskResult);
  const priorActions = input.priorDecisions.map((decision) => decision.actionType);
  const recovery = planGenerationRecovery({
    failureCategory,
    state: {
      sameConfigurationRetries: count(priorActions, "retry_same_configuration"),
      parameterRepairs: count(priorActions, "apply_parameter_repair"),
      generationModelSwitches: count(priorActions, "switch_generation_model"),
      qualityRegenerations: count(priorActions, "regenerate_for_quality"),
      promptReviewRewrites: count(priorActions, "rewrite_prompt_for_review"),
      triedModelRecordIds: [
        text(configuration.modelRecordId),
        ...input.priorDecisions.map((decision) => text(decision.alternativeModelRecordId)),
      ].filter(Boolean),
    },
    policy: {
      maxSameConfigurationRetries: retryLimitForNode(input.budgetSnapshot, input.nodeId),
      maxParameterRepairs: 1,
      maxGenerationModelSwitches: input.configurationSnapshot.retryExhaustionPolicy === "compatible_fallback"
        ? integer(input.configurationSnapshot.maxFallbackCount, 0, 10, 0)
        : 0,
      maxQualityRegenerations: 1,
      maxPromptReviewRewrites: integer(input.configurationSnapshot.promptReviewMaxRetries, 0, 10, 0),
    },
    alternatives: generationAlternatives(configuration.generationAlternatives),
    parameterRepair: objectValue(configuration.parameterRepair),
    promptRewriteAllowed: input.configurationSnapshot.promptReviewRewriteEnabled === true,
  });
  const runtimePatch: Record<string, unknown> = {};
  let retryDelayMs = 0;
  if (recovery.action === "retry_same_configuration") {
    retryDelayMs = Math.min(60_000, 2_000 * (2 ** count(priorActions, "retry_same_configuration")));
  } else if (recovery.action === "switch_generation_model" && recovery.alternative) {
    runtimePatch.generationModel = {
      providerId: recovery.alternative.providerId,
      modelId: recovery.alternative.modelId,
      modelRecordId: recovery.alternative.modelRecordId,
    };
    if (recovery.parameterPatch) runtimePatch.executionPayload = recovery.parameterPatch;
  } else if (recovery.action === "apply_parameter_repair" && recovery.parameterPatch) {
    runtimePatch.executionPayload = recovery.parameterPatch;
  } else if (recovery.action === "rewrite_prompt_for_review") {
    runtimePatch.promptRewriteRequested = true;
  }
  return { failureCategory, recovery, retryDelayMs, runtimePatch };
}

export function mergeCanvasRunRecoveryOverrides(
  configurationValue: unknown,
  overridesValue: unknown,
): Record<string, unknown> {
  const configuration = objectValue(configurationValue);
  const overrides = objectValue(overridesValue);
  const generationModel = objectValue(overrides.generationModel);
  return {
    ...configuration,
    ...(text(generationModel.providerId) ? { providerId: text(generationModel.providerId) } : {}),
    ...(text(generationModel.modelId) ? { modelId: text(generationModel.modelId) } : {}),
    ...(text(generationModel.modelRecordId) ? { modelRecordId: text(generationModel.modelRecordId) } : {}),
    executionPayload: {
      ...objectValue(configuration.executionPayload),
      ...objectValue(overrides.executionPayload),
    },
  };
}

export function parseCanvasRunPromptRewriteResult(resultValue: unknown, originalPrompt: string) {
  const result = objectValue(resultValue);
  const content = text(result.content || result.text || result.reply)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (!content) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = objectValue(JSON.parse(content));
  } catch {
    return null;
  }
  const prompt = text(parsed.rewrittenPrompt || parsed.prompt);
  if (!prompt || prompt === originalPrompt || prompt.length > 100_000 || prompt.length > Math.max(2_000, originalPrompt.length * 2)) return null;
  const changes = arrayRecords(parsed.changes).slice(0, 50).map((change) => ({
    before: text(change.before).slice(0, 1_000),
    after: text(change.after).slice(0, 1_000),
    reason: text(change.reason).slice(0, 500),
  })).filter((change) => change.before || change.after);
  return {
    prompt,
    changes: changes.length > 0
      ? changes
      : [{ before: originalPrompt.slice(0, 1_000), after: prompt.slice(0, 1_000), reason: "prompt-review rewrite" }],
  };
}

function classifyTaskFailure(result: Record<string, unknown>): GenerationFailureCategory {
  const statusCode = integer(result.upstreamHttpStatus, 100, 599, 0) || undefined;
  const code = text(result.code || result.failureCategory);
  const message = [result.failureReason, result.providerDiagnostic, result.error, result.upstreamResponseSnippet]
    .map(text)
    .filter(Boolean)
    .join(" ");
  const classified = classifyGenerationFailure({ statusCode, code, message });
  if (classified !== "unknown") return classified;
  const normalized = code.toLowerCase();
  if (/timeout|rate.?limit/.test(normalized)) return "transient";
  if (/gateway|upstream_poll|provider/.test(normalized)) return "provider";
  if (/model_config|capability/.test(normalized)) return "capability";
  if (/auth|quota|credits/.test(normalized)) return "policy";
  return "unknown";
}

function generationAlternatives(value: unknown): GenerationModelAlternative[] {
  return arrayRecords(value).map((item) => ({
    providerId: text(item.providerId),
    modelId: text(item.modelId),
    modelRecordId: text(item.modelRecordId),
    parameterPatch: objectValue(item.parameterPatch),
    requiresApproval: item.requiresApproval !== false,
  })).filter((item) => item.providerId && item.modelRecordId);
}

function retryLimitForNode(budgetValue: unknown, nodeId: string) {
  const budget = objectValue(budgetValue);
  const overrides = objectValue(budget.nodeRetryOverrides);
  if (Object.prototype.hasOwnProperty.call(overrides, nodeId)) return integer(overrides[nodeId], 0, 10, 0);
  return integer(budget.maxAttemptsPerStep, 0, 10, 3);
}

function count(values: string[], target: string) {
  return values.filter((value) => value === target).length;
}

function arrayRecords(value: unknown) {
  return Array.isArray(value) ? value.map(objectValue).filter((item) => Object.keys(item).length > 0) : [];
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}
