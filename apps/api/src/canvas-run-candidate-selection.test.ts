import { describe, expect, it, vi } from "vitest";

import { createCanvasRunCandidateSelectionService, projectPendingSelection } from "./canvas-run-candidate-selection.js";

describe("canvas run candidate selection", () => {
  it("projects only the frozen server candidate context", () => {
    const result = projectPendingSelection({
      id: "step-1",
      run_id: "run-1",
      node_id: "selector-1",
      candidate_context: {
        mediaKind: "video",
        maximum: 2,
        criteria: "match the brief",
        note: "prefer stable motion",
        candidates: [{
          artifactId: "artifact-1",
          mediaKind: "video",
          fileUrl: "/files/1.mp4",
          sourceNodeId: "generate-1",
          prompt: "a calm tracking shot",
          variableSnapshot: { subject: "harbor" },
          providerId: "provider-1",
          modelRecordId: "model-1",
          createdAt: 42,
        }],
      },
    });

    expect(result).toEqual(expect.objectContaining({
      runId: "run-1",
      stepId: "step-1",
      nodeId: "selector-1",
      mediaKind: "video",
      maximum: 2,
      criteria: "match the brief",
      note: "prefer stable motion",
    }));
    expect(result.candidates[0]).toEqual(expect.objectContaining({
      artifactId: "artifact-1",
      providerId: "provider-1",
      modelRecordId: "model-1",
    }));
  });

  it("replays the same completed manual command after locking the run and step", async () => {
    const { pool, query } = replayPool({ selectedArtifactIds: ["artifact-2"], stepStatus: "succeeded" });
    const service = createCanvasRunCandidateSelectionService({ getPostgresPool: async () => pool as any });

    await expect(service.selectManual({
      ownerId: "owner-1",
      runId: "run-1",
      stepId: "step-1",
      selectedArtifactIds: ["artifact-2", "artifact-2"],
      idempotencyKey: "command-1",
    })).resolves.toEqual({
      runId: "run-1",
      stepId: "step-1",
      selectionId: "selection-1",
      selectedArtifactIds: ["artifact-2"],
      notSelectedArtifactIds: ["artifact-1"],
    });

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements.findIndex((sql) => sql.includes("for update of r, s")))
      .toBeLessThan(statements.findIndex((sql) => sql.includes("idempotency_key = $2")));
  });

  it("rejects reusing a manual command key with a different selection", async () => {
    const { pool, query } = replayPool({ selectedArtifactIds: ["artifact-1"], stepStatus: "succeeded" });
    const service = createCanvasRunCandidateSelectionService({ getPostgresPool: async () => pool as any });

    await expect(service.selectManual({
      ownerId: "owner-1",
      runId: "run-1",
      stepId: "step-1",
      selectedArtifactIds: ["artifact-2"],
      idempotencyKey: "command-1",
    })).rejects.toThrow("SMART_CANDIDATE_SELECTION_IDEMPOTENCY_CONFLICT");
    expect(query).toHaveBeenCalledWith("rollback");
  });
});

function replayPool(input: { selectedArtifactIds: string[]; stepStatus: string }) {
  const query = vi.fn(async (sql: string) => {
    if (["begin", "commit", "rollback"].includes(sql)) return { rows: [] };
    if (sql.includes("for update of r, s")) return { rows: [{
      id: "step-1",
      run_id: "run-1",
      step_key: "step:selector-1",
      node_id: "selector-1",
      status: input.stepStatus,
      output_binding: {},
      candidate_context: {},
    }] };
    if (sql.includes("idempotency_key = $2")) return { rows: [{
      id: "selection-1",
      canvas_run_id: "run-1",
      run_step_id: "step-1",
      selected_artifact_ids: input.selectedArtifactIds,
      rejected_artifact_ids: ["artifact-1"],
    }] };
    throw new Error(`unexpected query: ${sql}`);
  });
  const client = { query, release: vi.fn() };
  return { pool: { connect: vi.fn(async () => client) }, query };
}
