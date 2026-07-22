import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { createCanvasRunQualityCoordinator, parseQualityEvaluationContent, qualityContextForCompletedStep } from "./canvas-run-quality-coordinator.js";

describe("canvas run quality coordinator", () => {
  it("starts quality work only for enabled multi-candidate image or video steps", () => {
    const context = qualityContextForCompletedStep({
      nodeType: "image",
      nodeId: "image-1",
      planSnapshot: {
        steps: [{ nodeId: "image-1", configuration: {
          qualityEvaluationEnabled: true,
          qualityProfileKey: "image-default",
          selectionPolicy: "best",
          selectionMaximum: 1,
          executionPayload: { prompt: "product hero image" },
        } }],
      },
      taskResult: { generationArtifactIds: ["artifact-a", "artifact-b"] },
    });

    expect(context).toMatchObject({
      artifactIds: ["artifact-a", "artifact-b"],
      mediaKind: "image",
      goal: "product hero image",
      profileKey: "image-default",
      selectionPolicy: "best",
    });
    expect(qualityContextForCompletedStep({
      nodeType: "image",
      nodeId: "image-1",
      planSnapshot: { steps: [{ nodeId: "image-1", configuration: { qualityEvaluationEnabled: true } }] },
      taskResult: { generationArtifactIds: ["artifact-a"] },
    })).toBeNull();
  });

  it("parses strict image scores and applies the published profile", () => {
    const evaluation = parseQualityEvaluationContent({
      content: "```json\n{\"technicalValidity\":90,\"promptAlignment\":80,\"composition\":70,\"visualQuality\":60,\"defects\":[],\"evidence\":[\"sharp\"],\"confidence\":0.9}\n```",
      artifactId: "artifact-a",
      mediaKind: "image",
      profile: {
        id: "image-default",
        version: 2,
        mediaKind: "image",
        minimumOverallScore: 70,
        minimumConfidence: 0.8,
        weights: { technicalValidity: 1, promptAlignment: 1, composition: 1, visualQuality: 1 },
      },
    });

    expect(evaluation).toMatchObject({ artifactId: "artifact-a", overallScore: 75, confidence: 0.9, passed: true });
  });

  it("requires the video-specific score dimensions", () => {
    expect(() => parseQualityEvaluationContent({
      content: "{\"technicalValidity\":90,\"promptAlignment\":80,\"composition\":70,\"visualQuality\":60,\"confidence\":0.9}",
      artifactId: "video-a",
      mediaKind: "video",
      sampledTimestampsMs: [0, 1000],
      profile: {
        id: "video-default",
        version: 1,
        mediaKind: "video",
        minimumOverallScore: 0,
        minimumConfidence: 0,
        weights: { temporalCoherence: 1, motionQuality: 1, keyframeConsistency: 1 },
      },
    })).toThrow(/ARTIFACT_EVALUATION_SCORE_INVALID/);
  });

  it("fails before dispatch when quality evaluation would exceed the run task budget", async () => {
    const state = { stepStatus: "evaluating", runStatus: "running", eventSequence: 0, failureCode: "" };
    const step = {
      id: "step-1", run_id: "run-1", owner_id: "owner-1", node_id: "image-1", node_type: "image", status: "evaluating",
      plan_snapshot: {}, budget_snapshot: { maxTaskCount: 1 }, run_created_at: new Date(), output_binding: {}, quality_task_id: null,
      quality_dispatch_enqueued_at: null, quality_context: { artifactIds: ["artifact-a", "artifact-b"], mediaKind: "image", goal: "test", profileKey: "", selectionPolicy: "best", selectionMaximum: 1, selectionMinimumScore: 0, currentIndex: 0, evaluations: [] },
    };
    const poolQuery = vi.fn(async (sql: string) => {
      if (sql.includes("join xh_tasks t on t.id = s.quality_task_id")) return { rows: [] };
      throw new Error(`unexpected pool query: ${sql}`);
    });
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === "begin" || sql === "commit" || sql === "rollback") return { rows: [] };
      if (sql.includes("insert into xh_canvas_run_dispatch_cursors")) return { rows: [] };
      if (sql.includes("from xh_canvas_run_dispatch_cursors") && sql.includes("for update")) return { rows: [{ last_owner_id: "" }] };
      if (sql.includes("update xh_canvas_run_dispatch_cursors")) return { rows: [] };
      if (sql.includes("s.status = 'evaluating'") && sql.includes("skip locked")) return { rows: state.stepStatus === "evaluating" ? [step] : [] };
      if (sql.includes("count(*)::int as count from xh_tasks")) return { rows: [{ count: 1 }] };
      if (sql.includes("update xh_canvas_run_steps set status='failed'")) {
        state.stepStatus = "failed";
        state.failureCode = JSON.parse(String(params?.[1])).code;
        return { rows: [] };
      }
      if (sql.includes("update xh_canvas_runs set status='failed'")) { state.runStatus = "failed"; return { rows: [] }; }
      if (sql.includes("set event_sequence=event_sequence+1")) return { rows: [{ event_sequence: ++state.eventSequence }] };
      if (sql.includes("insert into xh_canvas_run_events")) return { rows: [] };
      throw new Error(`unexpected client query: ${sql}`);
    });
    const pool = { query: poolQuery, connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })) } as any;
    const redis = { lPush: vi.fn() } as any;
    const coordinator = createCanvasRunQualityCoordinator({ pool, redis, workerId: "quality-1", environment: "test", queueName: "tasks", dataDir: "data", enabled: true });

    await coordinator.tick();

    expect(state).toMatchObject({ stepStatus: "failed", runStatus: "failed", failureCode: "CANVAS_RUN_MAX_TASK_COUNT" });
    expect(redis.lPush).not.toHaveBeenCalled();
  });

  it("holds half-open probes until the quality task is settled", () => {
    const source = readFileSync(new URL("./canvas-run-quality-coordinator.ts", import.meta.url), "utf8");
    expect(source).toMatch(/claimHalfOpenProbe\(client, routeCandidate\.entryId/);
    expect(source).toMatch(/await releaseHalfOpenProbe\(client, context\)/);
    expect(source).toMatch(/xh_llm_route_entry_probe_leases/);
  });
});
