export type AgentRole = "planner" | "image_understanding" | "video_understanding" | "checker" | "recovery" | "manager";
export type LlmRouteEntryState = "healthy" | "degraded" | "rate_limited" | "unavailable" | "circuit_open" | "half_open" | "draining" | "disabled";
export type NativeVideoTransport = "gemini_file" | "remote_url";

// A route snapshot alone must not turn on an external media handoff path.
export const DEFAULT_NATIVE_VIDEO_TRANSPORTS: readonly NativeVideoTransport[] = ["gemini_file"];

export interface LlmRouteCandidate {
  entryId: string;
  providerId: string;
  modelId: string;
  capability: string;
  capabilityTags: string[];
  inputCapabilities?: Record<string, unknown>;
  mediaInputTransports?: string[];
  priority: number;
  weight: number;
  state: LlmRouteEntryState;
  estimatedCost: number;
  p95LatencyMs: number;
}

export interface LlmRoutingRequest {
  role: AgentRole;
  scenario: string;
  requiredCapabilityTags: string[];
  requiredInputCapabilities?: string[];
  maximumEstimatedCost?: number;
  decisionKey: string;
  candidates: LlmRouteCandidate[];
}

export interface LlmRouteRejection {
  entryId: string;
  reason: "non_llm_capability" | "missing_capability_tag" | "missing_input_capability" | "state_unavailable" | "cost_limit";
}

export interface LlmRoutingDecision {
  role: AgentRole;
  scenario: string;
  selectedEntryId: string;
  orderedEntryIds: string[];
  rejected: LlmRouteRejection[];
  reason: string;
}

const ELIGIBLE_STATES = new Set<LlmRouteEntryState>(["healthy", "degraded", "half_open"]);
const STATE_RANK: Record<LlmRouteEntryState, number> = {
  healthy: 0,
  half_open: 1,
  degraded: 2,
  rate_limited: 3,
  unavailable: 4,
  circuit_open: 5,
  draining: 6,
  disabled: 7,
};

export function routeLlmCandidates(input: LlmRoutingRequest): LlmRoutingDecision {
  const rejected: LlmRouteRejection[] = [];
  const eligible = input.candidates.filter((candidate) => {
    if (candidate.capability !== "chat") return reject(candidate, "non_llm_capability", rejected);
    if (input.requiredCapabilityTags.some((tag) => !candidate.capabilityTags.includes(tag))) return reject(candidate, "missing_capability_tag", rejected);
    if ((input.requiredInputCapabilities || []).some((key) => candidate.inputCapabilities?.[key] !== true)) return reject(candidate, "missing_input_capability", rejected);
    if (!ELIGIBLE_STATES.has(candidate.state)) return reject(candidate, "state_unavailable", rejected);
    if (input.maximumEstimatedCost !== undefined && candidate.estimatedCost > input.maximumEstimatedCost) return reject(candidate, "cost_limit", rejected);
    return true;
  });
  if (eligible.length === 0) throw new Error(`LLM_ROUTE_UNAVAILABLE:${input.role}:${input.scenario}`);

  eligible.sort(compareCandidates);
  const bestPriority = eligible[0].priority;
  const bestStateRank = STATE_RANK[eligible[0].state];
  const weightedGroup = eligible.filter((candidate) => candidate.priority === bestPriority && STATE_RANK[candidate.state] === bestStateRank);
  const selected = deterministicWeightedChoice(weightedGroup, input.decisionKey);
  const ordered = [selected, ...eligible.filter((candidate) => candidate.entryId !== selected.entryId)];
  return {
    role: input.role,
    scenario: input.scenario,
    selectedEntryId: selected.entryId,
    orderedEntryIds: ordered.map((candidate) => candidate.entryId),
    rejected,
    reason: `priority=${selected.priority} state=${selected.state} weighted among ${weightedGroup.length} candidate(s)`,
  };
}

export function routeVideoUnderstandingCandidates(input: {
  scenario: string;
  decisionKey: string;
  candidates: LlmRouteCandidate[];
  hasSampledFrames: boolean;
  maximumEstimatedCost?: number;
  enabledNativeTransports?: readonly NativeVideoTransport[];
}) {
  const enabledNativeTransports = new Set(input.enabledNativeTransports || DEFAULT_NATIVE_VIDEO_TRANSPORTS);
  const nativeCandidates = input.candidates.filter((candidate) =>
    candidate.inputCapabilities?.videoReference === true
    && (candidate.mediaInputTransports || []).some((transport) => enabledNativeTransports.has(transport as NativeVideoTransport)));
  const frameCandidates = input.hasSampledFrames
    ? input.candidates.filter((candidate) => candidate.inputCapabilities?.imageReference === true && candidate.mediaInputTransports?.includes("sampled_frames"))
    : [];
  const route = (candidates: LlmRouteCandidate[], suffix: string) => candidates.length > 0 ? routeLlmCandidates({
    role: "video_understanding",
    scenario: input.scenario,
    requiredCapabilityTags: ["video_understanding"],
    maximumEstimatedCost: input.maximumEstimatedCost,
    decisionKey: `${input.decisionKey}:${suffix}`,
    candidates,
  }) : undefined;
  const nativeDecision = tryRoute(() => route(nativeCandidates, "native"));
  const frameDecision = tryRoute(() => route(frameCandidates, "frames"));
  if (nativeDecision) return { mode: "native_video" as const, decision: nativeDecision, fallbackDecision: frameDecision };
  if (frameDecision) return { mode: "sampled_frames" as const, decision: frameDecision, fallbackDecision: undefined };
  throw new Error(`LLM_ROUTE_UNAVAILABLE:video_understanding:${input.scenario}`);
}

export function nextLlmRouteState(input: {
  current: LlmRouteEntryState;
  outcome: "success" | "technical_failure" | "rate_limited" | "quality_failure";
  consecutiveTechnicalFailures: number;
  failureThreshold: number;
}): LlmRouteEntryState {
  if (input.outcome === "quality_failure") return input.current;
  if (input.outcome === "success") return "healthy";
  if (input.outcome === "rate_limited") return "rate_limited";
  return input.consecutiveTechnicalFailures + 1 >= input.failureThreshold ? "circuit_open" : "degraded";
}

export function routeStateAfterCooldown(input: { current: LlmRouteEntryState; openedAt: number; now: number; cooldownMs: number }) {
  return input.current === "circuit_open" && input.now - input.openedAt >= input.cooldownMs ? "half_open" : input.current;
}

function reject(candidate: LlmRouteCandidate, reason: LlmRouteRejection["reason"], rejected: LlmRouteRejection[]) {
  rejected.push({ entryId: candidate.entryId, reason });
  return false;
}

function tryRoute(factory: () => LlmRoutingDecision | undefined) {
  try {
    return factory();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("LLM_ROUTE_UNAVAILABLE:")) return undefined;
    throw error;
  }
}

function compareCandidates(left: LlmRouteCandidate, right: LlmRouteCandidate) {
  return left.priority - right.priority
    || STATE_RANK[left.state] - STATE_RANK[right.state]
    || left.estimatedCost - right.estimatedCost
    || left.p95LatencyMs - right.p95LatencyMs
    || left.entryId.localeCompare(right.entryId);
}

function deterministicWeightedChoice(candidates: LlmRouteCandidate[], key: string) {
  const total = candidates.reduce((sum, candidate) => sum + Math.max(1, candidate.weight), 0);
  let cursor = stableHash(key) % total;
  for (const candidate of candidates) {
    cursor -= Math.max(1, candidate.weight);
    if (cursor < 0) return candidate;
  }
  return candidates[0];
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
