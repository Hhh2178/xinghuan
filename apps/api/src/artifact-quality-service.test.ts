import { describe, expect, it, vi } from "vitest";

import { createArtifactQualityService } from "./artifact-quality-service.js";

describe("artifact quality service", () => {
  it("uses the image understanding role and persists a validated weighted evaluation", async () => {
    const recordEvaluation = vi.fn(async () => "evaluation-1");
    const runUnderstandingAgent = vi.fn(async () => ({
      mode: "agent" as const, agentRunId: "agent-run-1", entryId: "entry-1", providerId: "provider-1", modelRecordId: "model-1",
      content: JSON.stringify({ technicalValidity: 95, promptAlignment: 90, composition: 85, visualQuality: 80, defects: [], evidence: ["sharp subject"], confidence: 0.92 }),
    }));
    const service = createArtifactQualityService({
      repository: {
        readOwnedArtifact: async () => ({ id: "image-1", ownerId: "owner-1", kind: "image", fileUrl: "/files/image-1.png", sourceUrl: null, metadata: {} }),
        readPublishedProfile: async () => ({ databaseId: "profile-db-1", id: "image-default", version: 2, mediaKind: "image", minimumOverallScore: 80, minimumConfidence: 0.8, weights: { technicalValidity: 1, promptAlignment: 1, composition: 1, visualQuality: 1 } }),
        readOwnedEvaluations: vi.fn(),
        recordEvaluation,
        recordSelection: vi.fn(),
      },
      runUnderstandingAgent,
    });

    const result = await service.evaluate({ ownerId: "owner-1", artifactId: "image-1", environment: "gray", goal: "product hero", idempotencyKey: "eval-1" });
    expect(result).toMatchObject({ evaluationId: "evaluation-1", evaluation: { mediaKind: "image", overallScore: 87.5, passed: true } });
    expect(runUnderstandingAgent).toHaveBeenCalledWith(expect.objectContaining({ role: "image_understanding", scenario: "artifact-quality" }));
    expect(recordEvaluation).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-1", evaluatorEntryId: "entry-1" }));
  });

  it("requires timestamped frame samples for video understanding", async () => {
    const service = createArtifactQualityService({
      repository: {
        readOwnedArtifact: async () => ({ id: "video-1", ownerId: "owner-1", kind: "video", fileUrl: "/files/video.mp4", sourceUrl: null, metadata: {} }),
        readPublishedProfile: async () => ({ databaseId: "profile-v", id: "video-default", version: 1, mediaKind: "video", minimumOverallScore: 70, minimumConfidence: 0.7, weights: {} }),
        readOwnedEvaluations: vi.fn(),
        recordEvaluation: vi.fn(), recordSelection: vi.fn(),
      },
      runUnderstandingAgent: vi.fn(),
    });
    await expect(service.evaluate({ ownerId: "owner-1", artifactId: "video-1", environment: "gray", goal: "smooth motion", idempotencyKey: "eval-v" })).rejects.toThrow("VIDEO_EVALUATION_SAMPLES_REQUIRED");
  });

  it("records best candidate selection for a single-input downstream binding", async () => {
    const recordSelection = vi.fn(async () => "selection-1");
    const service = createArtifactQualityService({ repository: {
      readOwnedArtifact: vi.fn(), readPublishedProfile: vi.fn(), recordEvaluation: vi.fn(), recordSelection,
      readOwnedEvaluations: async () => [
        { artifactId: "image-a", createdAt: 1, evaluationId: "eval-a", overallScore: 80, confidence: 0.9 },
        { artifactId: "image-b", createdAt: 2, evaluationId: "eval-b", overallScore: 95, confidence: 0.85 },
      ],
    }, runUnderstandingAgent: vi.fn() });
    const result = await service.select({
      ownerId: "owner-1", canvasRunId: "run-1", runStepId: "step-2", bindingKey: "image-input", policy: "best", maximum: 1, evaluatorVersion: "image-default/v2",
      candidates: [
        { evaluationId: "eval-a" },
        { evaluationId: "eval-b" },
      ],
    });
    expect(result.selection.selectedArtifactIds).toEqual(["image-b"]);
    expect(recordSelection).toHaveBeenCalledWith(expect.objectContaining({ sourceArtifactIds: ["image-a", "image-b"], evaluationIds: ["eval-a", "eval-b"] }));
  });
});
