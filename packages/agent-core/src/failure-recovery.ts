export type GenerationFailureCategory = "transient" | "provider" | "capability" | "input" | "parameter" | "policy" | "content" | "quality" | "unknown";
export type RecoveryActionType = "retry_same_configuration" | "apply_parameter_repair" | "switch_generation_model" | "regenerate_for_quality" | "rewrite_prompt_for_review" | "request_approval" | "stop";

export interface GenerationModelAlternative {
  providerId: string;
  modelId: string;
  modelRecordId: string;
  parameterPatch?: Record<string, unknown>;
  requiresApproval: boolean;
}

export interface RecoveryPolicy {
  maxSameConfigurationRetries: number;
  maxParameterRepairs: number;
  maxGenerationModelSwitches: number;
  maxQualityRegenerations: number;
  maxPromptReviewRewrites?: number;
}

export interface RecoveryState {
  sameConfigurationRetries: number;
  parameterRepairs: number;
  generationModelSwitches: number;
  qualityRegenerations: number;
  promptReviewRewrites?: number;
  triedModelRecordIds: string[];
}

export interface RecoveryPlan {
  action: RecoveryActionType;
  failureCategory: GenerationFailureCategory;
  alternative?: GenerationModelAlternative;
  parameterPatch?: Record<string, unknown>;
  reason: string;
}

export function classifyGenerationFailure(input: { statusCode?: number; code?: string; message?: string }): GenerationFailureCategory {
  const text = `${input.code || ""} ${input.message || ""}`.toLowerCase();
  if (input.statusCode === 429 || /rate.?limit|too many requests|timeout|temporar|econnreset|socket hang up/.test(text)) return "transient";
  if (input.statusCode && input.statusCode >= 500) return "provider";
  if (/unsupported|capability|not support|model.+not found/.test(text)) return "capability";
  if (/missing input|invalid input|input required|empty prompt|bad reference/.test(text)) return "input";
  if (/invalid parameter|parameter|resolution|aspect ratio|duration/.test(text)) return "parameter";
  if (/content policy|moderation|unsafe|blocked content/.test(text)) return "content";
  if (/permission|forbidden|budget|policy|not allowed/.test(text)) return "policy";
  if (/quality|artifact[_ ]below[_ ]threshold/.test(text)) return "quality";
  if (input.statusCode && input.statusCode >= 400) return "input";
  return "unknown";
}

export function planGenerationRecovery(input: {
  failureCategory: GenerationFailureCategory;
  state: RecoveryState;
  policy: RecoveryPolicy;
  alternatives: GenerationModelAlternative[];
  parameterRepair?: Record<string, unknown>;
  promptRewriteAllowed?: boolean;
}): RecoveryPlan {
  const { failureCategory, state, policy } = input;
  if (failureCategory === "content"
    && input.promptRewriteAllowed === true
    && (state.promptReviewRewrites || 0) < (policy.maxPromptReviewRewrites || 0)) {
    return {
      action: "rewrite_prompt_for_review",
      failureCategory,
      reason: `prompt-review rewrite ${(state.promptReviewRewrites || 0) + 1}/${policy.maxPromptReviewRewrites || 0}`,
    };
  }
  if (failureCategory === "policy" || failureCategory === "content" || failureCategory === "input") {
    return { action: "stop", failureCategory, reason: `${failureCategory} failures require user correction or policy resolution` };
  }
  if (failureCategory === "quality" && state.qualityRegenerations < policy.maxQualityRegenerations) {
    return { action: "regenerate_for_quality", failureCategory, reason: `quality regeneration ${state.qualityRegenerations + 1}/${policy.maxQualityRegenerations}` };
  }
  if (failureCategory === "parameter" && input.parameterRepair && state.parameterRepairs < policy.maxParameterRepairs) {
    return { action: "apply_parameter_repair", failureCategory, parameterPatch: input.parameterRepair, reason: `controlled parameter repair ${state.parameterRepairs + 1}/${policy.maxParameterRepairs}` };
  }
  if (["transient", "provider", "unknown"].includes(failureCategory) && state.sameConfigurationRetries < policy.maxSameConfigurationRetries) {
    return { action: "retry_same_configuration", failureCategory, reason: `same configuration retry ${state.sameConfigurationRetries + 1}/${policy.maxSameConfigurationRetries}` };
  }
  const alternative = input.alternatives.find((candidate) => !state.triedModelRecordIds.includes(candidate.modelRecordId));
  if (alternative && state.generationModelSwitches < policy.maxGenerationModelSwitches) {
    if (alternative.requiresApproval) return { action: "request_approval", failureCategory, alternative, reason: "generation model alternative requires explicit approval" };
    return { action: "switch_generation_model", failureCategory, alternative, parameterPatch: alternative.parameterPatch, reason: `node-configured generation alternative ${state.generationModelSwitches + 1}/${policy.maxGenerationModelSwitches}` };
  }
  return { action: "stop", failureCategory, reason: "recovery budget exhausted or no untried node-configured alternative" };
}
