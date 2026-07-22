import { evaluateArtifactQuality, selectArtifactCandidates, type ArtifactCandidateSelection, type ArtifactEvaluationInput } from "@xinghuan/agent-core";

import type { AgentRoleRunResult } from "./agent-orchestrator.js";
import type { QualityArtifactRecord } from "./artifact-quality-repository.js";

export function createArtifactQualityService(deps: {
  repository: {
    readOwnedArtifact(ownerId: string, artifactId: string): Promise<QualityArtifactRecord | null>;
    readOwnedEvaluations(ownerId: string, evaluationIds: string[]): Promise<Array<{ evaluationId: string; artifactId: string; overallScore: number; confidence: number; createdAt: number }>>;
    readPublishedProfile(mediaKind: "image" | "video", environment: "gray" | "production"): Promise<any>;
    recordEvaluation(input: any): Promise<string>;
    recordSelection(input: any): Promise<string>;
  };
  runUnderstandingAgent(input: {
    ownerId: string;
    role: "image_understanding" | "video_understanding";
    scenario: "artifact-quality";
    idempotencyKey: string;
    content: unknown;
    inputSnapshot: Record<string, unknown>;
  }): Promise<AgentRoleRunResult>;
}) {
  async function evaluate(input: {
    ownerId: string;
    artifactId: string;
    environment: "gray" | "production";
    goal: string;
    idempotencyKey: string;
    canvasRunId?: string;
    runStepId?: string;
    videoSamples?: Array<{ url: string; timestampMs: number }>;
  }) {
    const artifact = await deps.repository.readOwnedArtifact(input.ownerId, input.artifactId);
    if (!artifact) throw new Error("ARTIFACT_EVALUATION_ARTIFACT_NOT_FOUND");
    const profile = await deps.repository.readPublishedProfile(artifact.kind, input.environment);
    if (!profile) throw new Error(`ARTIFACT_QUALITY_PROFILE_NOT_PUBLISHED:${artifact.kind}:${input.environment}`);
    if (artifact.kind === "video" && (!input.videoSamples || input.videoSamples.length < 2)) throw new Error("VIDEO_EVALUATION_SAMPLES_REQUIRED");
    const samples = artifact.kind === "image"
      ? [{ url: artifact.fileUrl, timestampMs: 0 }]
      : input.videoSamples!.slice(0, 12);
    if (artifact.kind === "video" && samples.some((sample) => !isOwnedSamplePath(sample.url) || !Number.isFinite(sample.timestampMs) || sample.timestampMs < 0)) {
      throw new Error("VIDEO_EVALUATION_SAMPLE_INVALID");
    }
    const role = artifact.kind === "image" ? "image_understanding" : "video_understanding";
    const agent = await deps.runUnderstandingAgent({
      ownerId: input.ownerId,
      role,
      scenario: "artifact-quality",
      idempotencyKey: `${input.idempotencyKey}:agent`,
      content: buildEvaluationContent(artifact, input.goal, samples),
      inputSnapshot: { artifactId: artifact.id, mediaKind: artifact.kind, sampleCount: samples.length, profileId: profile.id, profileVersion: profile.version },
    });
    const parsed = parseEvaluation(agent.content, artifact, samples);
    const evaluation = evaluateArtifactQuality(parsed, profile);
    const evaluationId = await deps.repository.recordEvaluation({
      ownerId: input.ownerId,
      artifact,
      canvasRunId: input.canvasRunId,
      runStepId: input.runStepId,
      agentRunId: agent.agentRunId,
      profileDatabaseId: profile.databaseId,
      evaluation,
      evaluatorEntryId: agent.entryId,
      evaluatorProviderId: agent.providerId,
      evaluatorModelId: agent.modelRecordId,
      sampleSnapshot: { samples: samples.map((sample) => ({ timestampMs: sample.timestampMs })) },
      idempotencyKey: input.idempotencyKey,
    });
    return { evaluationId, evaluation };
  }

  async function select(input: {
    ownerId: string;
    canvasRunId: string;
    runStepId: string;
    bindingKey: string;
    policy: Parameters<typeof selectArtifactCandidates>[0]["policy"];
    maximum?: number;
    minimumScore?: number;
    candidates: Array<{ evaluationId: string; diversityKey?: string }>;
    evaluatorVersion: string;
  }): Promise<{ selectionId: string; selection: ArtifactCandidateSelection }> {
    const evaluations = await deps.repository.readOwnedEvaluations(input.ownerId, input.candidates.map((candidate) => candidate.evaluationId));
    if (evaluations.length !== new Set(input.candidates.map((candidate) => candidate.evaluationId)).size) throw new Error("ARTIFACT_SELECTION_EVALUATION_NOT_OWNED");
    const diversityByEvaluationId = new Map(input.candidates.map((candidate) => [candidate.evaluationId, candidate.diversityKey]));
    const selection = selectArtifactCandidates({
      policy: input.policy,
      maximum: input.maximum,
      minimumScore: input.minimumScore,
      candidates: evaluations.map(({ evaluationId, artifactId, createdAt }) => ({ artifactId, createdAt, diversityKey: diversityByEvaluationId.get(evaluationId) })),
      evaluations: evaluations.map(({ artifactId, overallScore, confidence }) => ({ artifactId, overallScore, confidence })),
    });
    const selectionId = await deps.repository.recordSelection({
      ownerId: input.ownerId,
      canvasRunId: input.canvasRunId,
      runStepId: input.runStepId,
      bindingKey: input.bindingKey,
      sourceArtifactIds: evaluations.map((candidate) => candidate.artifactId),
      evaluationIds: evaluations.map((candidate) => candidate.evaluationId),
      selection,
      evaluatorVersion: input.evaluatorVersion,
    });
    return { selectionId, selection };
  }

  return { evaluate, select };
}

function buildEvaluationContent(artifact: QualityArtifactRecord, goal: string, samples: Array<{ url: string; timestampMs: number }>) {
  const schema = artifact.kind === "image"
    ? { technicalValidity: 0, promptAlignment: 0, composition: 0, visualQuality: 0, defects: [""], evidence: [""], confidence: 0 }
    : { technicalValidity: 0, promptAlignment: 0, composition: 0, visualQuality: 0, temporalCoherence: 0, motionQuality: 0, keyframeConsistency: 0, defects: [""], evidence: [""], confidence: 0 };
  return [
    { type: "text", text: `Evaluate ${artifact.kind} artifact ${artifact.id} against this goal: ${goal}. Scores are 0-100 and confidence is 0-1. Return strict JSON only with this shape: ${JSON.stringify(schema)}` },
    ...samples.map((sample) => ({ type: "image_url", image_url: { url: sample.url }, timestamp_ms: sample.timestampMs })),
  ];
}

function isOwnedSamplePath(value: string) {
  return /^\/files\/(?:input|output)\//.test(value);
}

function parseEvaluation(content: string, artifact: QualityArtifactRecord, samples: Array<{ timestampMs: number }>): ArtifactEvaluationInput {
  const parsed = JSON.parse(extractJsonObject(content));
  const common = {
    artifactId: artifact.id,
    technicalValidity: parsed.technicalValidity,
    promptAlignment: parsed.promptAlignment,
    composition: parsed.composition,
    visualQuality: parsed.visualQuality,
    defects: stringArray(parsed.defects),
    evidence: stringArray(parsed.evidence),
    confidence: parsed.confidence,
  };
  return artifact.kind === "image" ? { mediaKind: "image", ...common } : {
    mediaKind: "video",
    ...common,
    temporalCoherence: parsed.temporalCoherence,
    motionQuality: parsed.motionQuality,
    keyframeConsistency: parsed.keyframeConsistency,
    sampledTimestampsMs: samples.map((sample) => sample.timestampMs),
  };
}

function extractJsonObject(value: string) {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("ARTIFACT_EVALUATION_OUTPUT_INVALID");
  return trimmed.slice(first, last + 1);
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 50) : [];
}
