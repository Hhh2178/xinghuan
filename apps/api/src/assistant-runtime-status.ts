import { routeLlmCandidates, type LlmRouteCandidate } from "@xinghuan/agent-core";
import type { AssistantRuntimeModel, AssistantRuntimeStatus } from "@xinghuan/shared";

export interface AssistantRuntimeStatusInput {
  environment: "gray" | "production" | "local";
  scope: "canvas" | "admin";
  enabled: boolean;
  agentKey: string;
  agentVersion?: number;
  configurationVersionId?: string;
  poolKey?: string;
  poolVersionId?: string;
  candidates?: LlmRouteCandidate[];
  providerNames?: Record<string, string>;
  modelNames?: Record<string, { modelId?: string; displayName?: string; inputCapabilities?: Record<string, unknown> }>;
  updatedAt?: number;
}

export function buildAssistantRuntimeStatus(input: AssistantRuntimeStatusInput): AssistantRuntimeStatus {
  const candidates = (input.candidates || []).map((candidate): AssistantRuntimeModel => ({
    entryId: candidate.entryId,
    providerId: candidate.providerId,
    providerName: input.providerNames?.[candidate.providerId],
    modelRecordId: candidate.modelId,
    modelId: input.modelNames?.[candidate.modelId]?.modelId,
    modelDisplayName: input.modelNames?.[candidate.modelId]?.displayName,
    state: candidate.state,
    supportsImage: candidate.inputCapabilities?.imageReference === true || candidate.capabilityTags.includes("image_understanding"),
  }));
  let selectedEntryId = "";
  let routeStatus: AssistantRuntimeStatus["routeStatus"] = "not_configured";
  if (input.candidates?.length) {
    try {
      selectedEntryId = routeLlmCandidates({
        role: "planner",
        scenario: "assistant-chat",
        requiredCapabilityTags: ["text_chat"],
        decisionKey: `assistant-status:${input.scope}`,
        candidates: input.candidates,
      }).selectedEntryId;
      routeStatus = "ready";
    } catch {
      routeStatus = "unavailable";
    }
  }
  const selected = candidates.find((candidate) => candidate.entryId === selectedEntryId);
  if (selected && selected.state !== "healthy") routeStatus = "degraded";
  return {
    environment: input.environment,
    scope: input.scope,
    enabled: input.enabled,
    agentKey: input.agentKey,
    agentVersion: input.agentVersion,
    configurationVersionId: input.configurationVersionId,
    poolKey: input.poolKey,
    poolVersionId: input.poolVersionId,
    routeStatus,
    model: selected,
    candidates,
    updatedAt: input.updatedAt || Date.now(),
  };
}
