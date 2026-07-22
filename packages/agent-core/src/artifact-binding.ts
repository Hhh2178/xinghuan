export type ArtifactBindingPolicy =
  | "single" | "many" | "first" | "last" | "best" | "top_k"
  | "threshold" | "diverse" | "merge" | "loop" | "reject";

export interface ArtifactCandidate {
  artifactId: string;
  createdAt: number;
  diversityKey?: string;
}

export interface ArtifactCandidateEvaluation {
  artifactId: string;
  overallScore: number;
  confidence: number;
}

export interface SelectArtifactCandidatesInput {
  policy: ArtifactBindingPolicy;
  maximum?: number;
  minimumScore?: number;
  candidates: ArtifactCandidate[];
  evaluations?: ArtifactCandidateEvaluation[];
}

export interface ArtifactCandidateSelection {
  policy: ArtifactBindingPolicy;
  executionMode: "single" | "batch" | "loop" | "rejected";
  selectedArtifactIds: string[];
  rejectedArtifactIds: string[];
  reason: string;
  confidence: number | null;
}

export function selectArtifactCandidates(input: SelectArtifactCandidatesInput): ArtifactCandidateSelection {
  const candidates = uniqueCandidates(input.candidates);
  const evaluations = new Map((input.evaluations || []).map((item) => [item.artifactId, item]));
  const maximum = Math.max(0, input.maximum ?? defaultMaximum(input.policy, candidates.length));
  const chronological = [...candidates].sort((left, right) => left.createdAt - right.createdAt || left.artifactId.localeCompare(right.artifactId));
  const ranked = [...candidates].sort((left, right) => compareRank(left, right, evaluations));
  let selected: ArtifactCandidate[];

  switch (input.policy) {
    case "reject": selected = []; break;
    case "last": selected = chronological.slice(-maximum); break;
    case "best":
    case "top_k": selected = ranked.slice(0, maximum); break;
    case "threshold": selected = ranked.filter((candidate) => (evaluations.get(candidate.artifactId)?.overallScore ?? -1) >= (input.minimumScore ?? 0)).slice(0, maximum); break;
    case "diverse": selected = selectDiverse(ranked, maximum); break;
    case "single":
      if (candidates.length !== 1) throw new Error(`ARTIFACT_BINDING_CARDINALITY:expected=1:actual=${candidates.length}`);
      selected = candidates;
      break;
    case "first": selected = chronological.slice(0, maximum); break;
    case "many":
    case "merge":
    case "loop": selected = chronological.slice(0, maximum); break;
  }

  const selectedIds = new Set(selected.map((item) => item.artifactId));
  const rejectionOrder = ["best", "top_k", "threshold", "diverse"].includes(input.policy) ? ranked : candidates;
  const selectedEvaluations = selected.map((item) => evaluations.get(item.artifactId)).filter((item): item is ArtifactCandidateEvaluation => Boolean(item));
  const confidence = selectedEvaluations.length > 0
    ? Math.min(...selectedEvaluations.map((item) => item.confidence))
    : null;
  return {
    policy: input.policy,
    executionMode: input.policy === "reject" ? "rejected" : input.policy === "loop" ? "loop" : selected.length <= 1 ? "single" : "batch",
    selectedArtifactIds: selected.map((item) => item.artifactId),
    rejectedArtifactIds: rejectionOrder.filter((item) => !selectedIds.has(item.artifactId)).map((item) => item.artifactId),
    reason: selectionReason(input, selected, evaluations),
    confidence,
  };
}

function uniqueCandidates(candidates: ArtifactCandidate[]) {
  return [...new Map(candidates.map((candidate) => [candidate.artifactId, candidate])).values()];
}

function defaultMaximum(policy: ArtifactBindingPolicy, candidateCount: number) {
  return ["single", "first", "last", "best"].includes(policy) ? 1 : candidateCount;
}

function compareRank(left: ArtifactCandidate, right: ArtifactCandidate, evaluations: Map<string, ArtifactCandidateEvaluation>) {
  const leftEvaluation = evaluations.get(left.artifactId);
  const rightEvaluation = evaluations.get(right.artifactId);
  return (rightEvaluation?.overallScore ?? -1) - (leftEvaluation?.overallScore ?? -1)
    || (rightEvaluation?.confidence ?? -1) - (leftEvaluation?.confidence ?? -1)
    || left.createdAt - right.createdAt
    || left.artifactId.localeCompare(right.artifactId);
}

function selectDiverse(candidates: ArtifactCandidate[], maximum: number) {
  const selected: ArtifactCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.diversityKey || candidate.artifactId;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(candidate);
    if (selected.length >= maximum) break;
  }
  return selected;
}

function selectionReason(
  input: SelectArtifactCandidatesInput,
  selected: ArtifactCandidate[],
  evaluations: Map<string, ArtifactCandidateEvaluation>,
) {
  if (input.policy === "reject") return "binding policy rejected all candidates";
  if (input.policy === "threshold") return `threshold overallScore>=${input.minimumScore ?? 0}`;
  const best = selected[0] ? evaluations.get(selected[0].artifactId) : undefined;
  if ((input.policy === "best" || input.policy === "top_k" || input.policy === "diverse") && best) {
    return `${input.policy} evaluation overallScore=${best.overallScore} confidence=${best.confidence}`;
  }
  return `${input.policy} selected ${selected.length} of ${input.candidates.length} candidates`;
}
