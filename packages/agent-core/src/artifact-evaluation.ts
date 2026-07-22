export type ArtifactMediaKind = "image" | "video";

export interface ArtifactQualityProfile {
  id: string;
  version: number;
  mediaKind: ArtifactMediaKind;
  minimumOverallScore: number;
  minimumConfidence: number;
  weights: Record<string, number>;
}

export interface ImageArtifactEvaluation {
  mediaKind: "image";
  artifactId: string;
  technicalValidity: number;
  promptAlignment: number;
  composition: number;
  visualQuality: number;
  defects: string[];
  evidence: string[];
  confidence: number;
}

export interface VideoArtifactEvaluation {
  mediaKind: "video";
  artifactId: string;
  technicalValidity: number;
  promptAlignment: number;
  composition: number;
  visualQuality: number;
  temporalCoherence: number;
  motionQuality: number;
  keyframeConsistency: number;
  defects: string[];
  evidence: string[];
  sampledTimestampsMs: number[];
  confidence: number;
}

export type ArtifactEvaluationInput = ImageArtifactEvaluation | VideoArtifactEvaluation;

export type ArtifactEvaluationResult = ArtifactEvaluationInput & {
  overallScore: number;
  passed: boolean;
  profileId: string;
  profileVersion: number;
};

const IMAGE_DIMENSIONS = ["technicalValidity", "promptAlignment", "composition", "visualQuality"] as const;
const VIDEO_DIMENSIONS = [...IMAGE_DIMENSIONS, "temporalCoherence", "motionQuality", "keyframeConsistency"] as const;

export function evaluateArtifactQuality(input: ArtifactEvaluationInput, profile: ArtifactQualityProfile): ArtifactEvaluationResult {
  if (profile.mediaKind !== input.mediaKind) throw new Error(`ARTIFACT_EVALUATION_PROFILE_KIND_MISMATCH:${profile.mediaKind}->${input.mediaKind}`);
  const dimensions = input.mediaKind === "video" ? VIDEO_DIMENSIONS : IMAGE_DIMENSIONS;
  const scores = input as unknown as Record<string, number>;
  let weightedScore = 0;
  let totalWeight = 0;
  for (const dimension of dimensions) {
    const score = boundedScore(scores[dimension]);
    const weight = Math.max(0, Number(profile.weights[dimension] ?? 1));
    weightedScore += score * weight;
    totalWeight += weight;
  }
  if (totalWeight <= 0) throw new Error("ARTIFACT_EVALUATION_PROFILE_WEIGHTS_EMPTY");
  const overallScore = Math.round((weightedScore / totalWeight) * 100) / 100;
  const confidence = boundedConfidence(input.confidence);
  return {
    ...input,
    confidence,
    overallScore,
    passed: overallScore >= profile.minimumOverallScore && confidence >= profile.minimumConfidence,
    profileId: profile.id,
    profileVersion: profile.version,
  };
}

function boundedScore(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw new Error(`ARTIFACT_EVALUATION_SCORE_INVALID:${value}`);
  return parsed;
}

function boundedConfidence(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error(`ARTIFACT_EVALUATION_CONFIDENCE_INVALID:${value}`);
  return parsed;
}
