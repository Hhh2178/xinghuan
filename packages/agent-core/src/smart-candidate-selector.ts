export type SmartCandidateUpstreamStatus =
  | "blocked"
  | "ready"
  | "queued"
  | "running"
  | "evaluating"
  | "selecting"
  | "awaiting_approval"
  | "retry_wait"
  | "paused"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "skipped";

export interface SmartCandidateUpstreamStep {
  nodeId: string;
  status: SmartCandidateUpstreamStatus;
  artifactIds: string[];
}

export interface SmartCandidate {
  artifactId: string;
  mediaKind: "image" | "video";
  fileUrl: string;
  sourceNodeId: string;
  prompt: string;
  variableSnapshot: Record<string, unknown>;
  providerId: string;
  modelRecordId: string;
  createdAt: number;
}

export interface SmartCandidateEvaluation {
  artifactId: string;
  technicalValidity: number;
  promptAlignment: number;
  visualQuality: number;
  variableAlignment: number;
  noteAlignment: number;
  overallScore: number;
  confidence: number;
  summary: string;
}

export type SmartCandidateSelectionResult = {
  state: "awaiting_manual" | "evaluating" | "selected" | "stopped";
  candidateArtifactIds: string[];
  selectedArtifactIds: string[];
  rejectedArtifactIds: string[];
  reason: string;
  confidence: number | null;
};

export type SmartCandidateBarrier =
  | {
      state: "waiting_for_candidates";
      terminalCount: number;
      expectedCount: number;
      artifactIds: [];
    }
  | {
      state: "ready";
      terminalCount: number;
      expectedCount: number;
      artifactIds: string[];
    };

const TERMINAL_STATUSES: ReadonlySet<SmartCandidateUpstreamStatus> = new Set([
  "succeeded",
  "failed",
  "cancelled",
  "skipped",
]);

export function resolveSmartCandidateBarrier(input: {
  dependencyNodeIds: string[];
  upstreamSteps: SmartCandidateUpstreamStep[];
}): SmartCandidateBarrier {
  const dependencyNodeIds = [...new Set(input.dependencyNodeIds.map((value) => value.trim()).filter(Boolean))];
  const upstreamByNodeId = new Map(input.upstreamSteps.map((step) => [step.nodeId, step]));
  const declared = dependencyNodeIds.map((nodeId) => upstreamByNodeId.get(nodeId));
  const terminalCount = declared.filter((step) => step && TERMINAL_STATUSES.has(step.status)).length;
  if (terminalCount !== dependencyNodeIds.length) {
    return {
      state: "waiting_for_candidates",
      terminalCount,
      expectedCount: dependencyNodeIds.length,
      artifactIds: [],
    };
  }
  return {
    state: "ready",
    terminalCount,
    expectedCount: dependencyNodeIds.length,
    artifactIds: [...new Set(declared.flatMap((step) => step?.artifactIds || []).filter(Boolean))],
  };
}

export function assertSmartCandidateSet(candidates: SmartCandidate[]) {
  if (candidates.length < 2) throw new Error("SMART_CANDIDATE_COUNT_INSUFFICIENT");
  const mediaKinds = new Set(candidates.map((candidate) => candidate.mediaKind));
  if (mediaKinds.size !== 1) throw new Error("SMART_CANDIDATE_MEDIA_KIND_MISMATCH");
  const artifactIds = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.artifactId || artifactIds.has(candidate.artifactId)) {
      throw new Error("SMART_CANDIDATE_ARTIFACT_INVALID");
    }
    artifactIds.add(candidate.artifactId);
    if (!candidate.fileUrl || !candidate.sourceNodeId || !candidate.prompt
      || !candidate.providerId || !candidate.modelRecordId
      || !candidate.variableSnapshot || typeof candidate.variableSnapshot !== "object"
      || Array.isArray(candidate.variableSnapshot)) {
      throw new Error(`SMART_CANDIDATE_PROVENANCE_INCOMPLETE:${candidate.artifactId}`);
    }
  }
  return candidates;
}

export function resolveSmartCandidateSelection(input: {
  mode: "manual" | "ai";
  maximum: number;
  minimumConfidence: number;
  lowConfidencePolicy: "request_manual" | "stop";
  candidates: SmartCandidate[];
  evaluations: SmartCandidateEvaluation[];
  manualSelectedArtifactIds?: string[];
}): SmartCandidateSelectionResult {
  const candidates = assertSmartCandidateSet(input.candidates);
  const candidateArtifactIds = candidates.map((candidate) => candidate.artifactId);
  if (input.mode === "manual") {
    if (!input.manualSelectedArtifactIds?.length) {
      return {
        state: "awaiting_manual",
        candidateArtifactIds,
        selectedArtifactIds: [],
        rejectedArtifactIds: [],
        reason: "manual selection required",
        confidence: null,
      };
    }
    const maximum = boundedMaximum(input.maximum, candidateArtifactIds.length);
    const selectedArtifactIds = [...new Set(input.manualSelectedArtifactIds)];
    if (selectedArtifactIds.length > maximum
      || selectedArtifactIds.some((artifactId) => !candidateArtifactIds.includes(artifactId))) {
      throw new Error("SMART_CANDIDATE_MANUAL_SELECTION_INVALID");
    }
    return {
      state: "selected",
      candidateArtifactIds,
      selectedArtifactIds,
      rejectedArtifactIds: candidateArtifactIds.filter((artifactId) => !selectedArtifactIds.includes(artifactId)),
      reason: `manual override selected ${selectedArtifactIds.length} of ${candidateArtifactIds.length} candidates`,
      confidence: null,
    };
  }
  const evaluationsByArtifactId = new Map(input.evaluations.map((evaluation) => [evaluation.artifactId, evaluation]));
  if (evaluationsByArtifactId.size !== candidateArtifactIds.length
    || candidateArtifactIds.some((artifactId) => !evaluationsByArtifactId.has(artifactId))) {
    return {
      state: "evaluating",
      candidateArtifactIds,
      selectedArtifactIds: [],
      rejectedArtifactIds: [],
      reason: "candidate evaluations incomplete",
      confidence: null,
    };
  }
  const ranked = candidates.map((candidate) => ({
    candidate,
    evaluation: validateEvaluation(evaluationsByArtifactId.get(candidate.artifactId)!),
  })).sort((left, right) =>
    right.evaluation.overallScore - left.evaluation.overallScore
    || right.evaluation.confidence - left.evaluation.confidence
    || left.candidate.createdAt - right.candidate.createdAt
    || left.candidate.artifactId.localeCompare(right.candidate.artifactId));
  const selected = ranked.slice(0, boundedMaximum(input.maximum, candidates.length));
  const confidence = Math.min(...selected.map((item) => item.evaluation.confidence));
  const minimumConfidence = Math.max(0, Math.min(1, Number(input.minimumConfidence) || 0));
  if (confidence < minimumConfidence) {
    return {
      state: input.lowConfidencePolicy === "stop" ? "stopped" : "awaiting_manual",
      candidateArtifactIds,
      selectedArtifactIds: [],
      rejectedArtifactIds: [],
      reason: `AI confidence ${confidence} is below ${minimumConfidence}`,
      confidence,
    };
  }
  const selectedArtifactIds = selected.map((item) => item.candidate.artifactId);
  return {
    state: "selected",
    candidateArtifactIds,
    selectedArtifactIds,
    rejectedArtifactIds: candidateArtifactIds.filter((artifactId) => !selectedArtifactIds.includes(artifactId)),
    reason: `AI selected ${selectedArtifactIds.length} of ${candidateArtifactIds.length} candidates: ${selected.map((item) => item.evaluation.summary).join(" ")}`.slice(0, 2_000),
    confidence,
  };
}

function boundedMaximum(value: number, candidateCount: number) {
  return Number.isFinite(value) ? Math.max(1, Math.min(candidateCount, Math.floor(value))) : 1;
}

function validateEvaluation(evaluation: SmartCandidateEvaluation) {
  for (const key of [
    "technicalValidity",
    "promptAlignment",
    "visualQuality",
    "variableAlignment",
    "noteAlignment",
    "overallScore",
  ] as const) {
    const value = Number(evaluation[key]);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`SMART_CANDIDATE_SCORE_INVALID:${evaluation.artifactId}:${key}`);
    }
  }
  if (!Number.isFinite(evaluation.confidence) || evaluation.confidence < 0 || evaluation.confidence > 1) {
    throw new Error(`SMART_CANDIDATE_CONFIDENCE_INVALID:${evaluation.artifactId}`);
  }
  if (!evaluation.summary.trim()) throw new Error(`SMART_CANDIDATE_SUMMARY_REQUIRED:${evaluation.artifactId}`);
  return evaluation;
}
