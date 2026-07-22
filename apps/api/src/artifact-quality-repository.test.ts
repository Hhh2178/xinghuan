import { describe, expect, it, vi } from "vitest";

import { createArtifactQualityRepository } from "./artifact-quality-repository.js";

describe("artifact quality repository", () => {
  it("atomically writes an owner-verified selection into the downstream step binding", async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("count(*)::int")) {
        expect(params).toEqual(["owner-1", ["image-a", "image-b"]]);
        return { rows: [{ total: 2 }] };
      }
      if (sql.includes("insert into xh_artifact_selections")) return { rows: [{ id: "selection-1" }] };
      if (sql.includes("jsonb_set")) {
        expect(sql).toContain("r.owner_id = $3");
        expect(params?.[3]).toEqual(["image-input"]);
        expect(JSON.parse(String(params?.[4]))).toMatchObject({ selectionId: "selection-1", selectedArtifactIds: ["image-b"], rejectedArtifactIds: ["image-a"] });
        return { rows: [{ id: "step-2" }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createArtifactQualityRepository({ getPostgresPool: async () => ({ connect: async () => ({ query, release: vi.fn() }) } as any), newId: () => "selection-1" });
    await expect(repository.recordSelection({
      ownerId: "owner-1", canvasRunId: "run-1", runStepId: "step-2", bindingKey: "image-input",
      sourceArtifactIds: ["image-a", "image-b"], evaluationIds: ["eval-a", "eval-b"], evaluatorVersion: "image/v1",
      selection: { policy: "best", executionMode: "single", selectedArtifactIds: ["image-b"], rejectedArtifactIds: ["image-a"], reason: "best", confidence: 0.9 },
    })).resolves.toBe("selection-1");
    expect(query.mock.calls.at(-1)?.[0]).toBe("commit");
  });
});
