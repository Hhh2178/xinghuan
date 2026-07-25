import { describe, expect, it } from "vitest";

import {
  assertSmartCandidateSet,
  resolveSmartCandidateBarrier,
  resolveSmartCandidateSelection,
  type SmartCandidate,
} from "./smart-candidate-selector.js";

const candidates: SmartCandidate[] = [
  {
    artifactId: "artifact-a",
    mediaKind: "image",
    fileUrl: "/files/output/a.png",
    sourceNodeId: "image-a",
    prompt: "wide city",
    variableSnapshot: { city: "Shanghai" },
    providerId: "provider-a",
    modelRecordId: "model-a",
    createdAt: 1,
  },
  {
    artifactId: "artifact-b",
    mediaKind: "image",
    fileUrl: "/files/output/b.png",
    sourceNodeId: "image-b",
    prompt: "close portrait",
    variableSnapshot: { city: "Shanghai" },
    providerId: "provider-b",
    modelRecordId: "model-b",
    createdAt: 2,
  },
];

describe("smart candidate selector", () => {
  it("waits until every declared upstream candidate reaches a terminal state", () => {
    expect(resolveSmartCandidateBarrier({
      dependencyNodeIds: ["image-a", "image-b"],
      upstreamSteps: [
        { nodeId: "image-a", status: "succeeded", artifactIds: ["artifact-a"] },
        { nodeId: "image-b", status: "running", artifactIds: [] },
      ],
    })).toEqual({
      state: "waiting_for_candidates",
      terminalCount: 1,
      expectedCount: 2,
      artifactIds: [],
    });
  });

  it("requires one media kind and complete server-owned provenance", () => {
    expect(() => assertSmartCandidateSet([
      {
        artifactId: "artifact-a",
        mediaKind: "image",
        fileUrl: "/files/output/a.png",
        sourceNodeId: "image-a",
        prompt: "wide city",
        variableSnapshot: { city: "Shanghai" },
        providerId: "provider-a",
        modelRecordId: "model-a",
        createdAt: 1,
      },
      {
        artifactId: "artifact-b",
        mediaKind: "video",
        fileUrl: "/files/output/b.mp4",
        sourceNodeId: "video-b",
        prompt: "wide city",
        variableSnapshot: { city: "Shanghai" },
        providerId: "provider-b",
        modelRecordId: "",
        createdAt: 2,
      },
    ])).toThrow("SMART_CANDIDATE_MEDIA_KIND_MISMATCH");
  });

  it("identifies the exact missing provenance field without weakening candidate count", () => {
    expect(() => assertSmartCandidateSet([
      candidates[0],
      { ...candidates[1], prompt: "" },
    ])).toThrow("SMART_CANDIDATE_PROVENANCE_INCOMPLETE:resolvedPrompt:artifact-b");
    expect(() => assertSmartCandidateSet([candidates[0]]))
      .toThrow("SMART_CANDIDATE_COUNT_INSUFFICIENT");
  });

  it("pauses a manual gate without choosing the first candidate", () => {
    expect(resolveSmartCandidateSelection({
      mode: "manual",
      maximum: 1,
      minimumConfidence: 0.7,
      lowConfidencePolicy: "request_manual",
      candidates,
      evaluations: [],
    })).toEqual({
      state: "awaiting_manual",
      candidateArtifactIds: ["artifact-a", "artifact-b"],
      selectedArtifactIds: [],
      rejectedArtifactIds: [],
      reason: "manual selection required",
      confidence: null,
    });
  });

  it("accepts an explicit manual choice only from the frozen candidate set", () => {
    expect(resolveSmartCandidateSelection({
      mode: "manual",
      maximum: 1,
      minimumConfidence: 0.7,
      lowConfidencePolicy: "request_manual",
      candidates,
      evaluations: [],
      manualSelectedArtifactIds: ["artifact-b"],
    })).toMatchObject({
      state: "selected",
      selectedArtifactIds: ["artifact-b"],
      rejectedArtifactIds: ["artifact-a"],
      reason: "manual override selected 1 of 2 candidates",
      confidence: null,
    });
    expect(() => resolveSmartCandidateSelection({
      mode: "manual",
      maximum: 1,
      minimumConfidence: 0.7,
      lowConfidencePolicy: "request_manual",
      candidates,
      evaluations: [],
      manualSelectedArtifactIds: ["artifact-unknown"],
    })).toThrow("SMART_CANDIDATE_MANUAL_SELECTION_INVALID");
  });

  it("selects Top K by governed scores and transfers low confidence to manual", () => {
    const evaluations = [
      {
        artifactId: "artifact-a",
        technicalValidity: 90,
        promptAlignment: 80,
        visualQuality: 85,
        variableAlignment: 75,
        noteAlignment: 70,
        overallScore: 80,
        confidence: 0.86,
        summary: "Keeps the requested skyline.",
      },
      {
        artifactId: "artifact-b",
        technicalValidity: 95,
        promptAlignment: 92,
        visualQuality: 90,
        variableAlignment: 88,
        noteAlignment: 84,
        overallScore: 90,
        confidence: 0.91,
        summary: "Best prompt and note alignment.",
      },
    ];
    expect(resolveSmartCandidateSelection({
      mode: "ai",
      maximum: 1,
      minimumConfidence: 0.8,
      lowConfidencePolicy: "request_manual",
      candidates,
      evaluations,
    })).toMatchObject({
      state: "selected",
      selectedArtifactIds: ["artifact-b"],
      rejectedArtifactIds: ["artifact-a"],
      confidence: 0.91,
    });
    expect(resolveSmartCandidateSelection({
      mode: "ai",
      maximum: 1,
      minimumConfidence: 0.95,
      lowConfidencePolicy: "request_manual",
      candidates,
      evaluations,
    })).toMatchObject({
      state: "awaiting_manual",
      selectedArtifactIds: [],
      rejectedArtifactIds: [],
      confidence: 0.91,
      reason: "AI confidence 0.91 is below 0.95",
    });
  });
});
