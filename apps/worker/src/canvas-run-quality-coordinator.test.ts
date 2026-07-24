import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  createCanvasRunQualityCoordinator,
  parseQualityEvaluationContent,
  qualityContextForCompletedStep,
} from "./canvas-run-quality-coordinator.js";
import {
  qualityGovernanceUnavailableReason,
  settleWithQualitySavepoint,
  smartCandidateUnavailableDisposition,
} from "./canvas-run-quality-containment.js";
import { normalizeContext } from "./canvas-run-quality-support.js";

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

  it("preserves selector-specific alignment scores and frozen context", () => {
    const evaluation = parseQualityEvaluationContent({
      content: JSON.stringify({
        technicalValidity: 90,
        promptAlignment: 80,
        composition: 70,
        visualQuality: 60,
        variableAlignment: 85,
        noteAlignment: 75,
        summary: "Wide framing keeps the requested building.",
        defects: [],
        evidence: ["complete facade"],
        confidence: 0.88,
      }),
      artifactId: "artifact-a",
      mediaKind: "image",
      smartCandidate: true,
      profile: {
        id: "image-default",
        version: 2,
        mediaKind: "image",
        minimumOverallScore: 70,
        minimumConfidence: 0.8,
        weights: { technicalValidity: 1, promptAlignment: 1, composition: 1, visualQuality: 1 },
      },
    });
    expect(evaluation).toMatchObject({
      variableAlignment: 85,
      noteAlignment: 75,
      summary: "Wide framing keeps the requested building.",
    });
    expect(normalizeContext({
      artifactIds: ["artifact-a", "artifact-b"],
      mediaKind: "image",
      goal: "wide city",
      selectionPolicy: "best",
      selectionMaximum: 1,
      selectionMinimumScore: 0,
      currentIndex: 1,
      evaluations: [{
        evaluationId: "evaluation-a",
        artifactId: "artifact-a",
        fileUrl: "/a.png",
        createdAt: 1,
        overallScore: 80,
        confidence: 0.88,
        variableAlignment: 85,
        noteAlignment: 75,
        summary: "Wide framing keeps the requested building.",
      }],
      smartCandidateSelector: { mode: "ai", minimumConfidence: 0.8, candidates: [{ artifactId: "artifact-a" }] },
    })).toMatchObject({
      evaluations: [{ variableAlignment: 85, noteAlignment: 75, summary: "Wide framing keeps the requested building." }],
      smartCandidateSelector: { mode: "ai", minimumConfidence: 0.8 },
    });
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
    expect(source).toMatch(/releaseHalfOpenProbe\(client, context\)/);
    expect(source).toMatch(/runQualitySettlementStage\("release_failed_probe"/);
    expect(source).toMatch(/xh_llm_route_entry_probe_leases/);
  });

  it("rolls back a failed successful settlement before durable fallback", async () => {
    const calls: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        calls.push(sql);
        return { rows: [] };
      }),
    } as any;
    const settleFailed = vi.fn(async (reason: string) => {
      calls.push(`fallback:${reason}`);
    });

    await settleWithQualitySavepoint({
      client,
      settleSuccessful: async () => {
        calls.push("settle-successful");
        throw new Error("CANVAS_RUN_QUALITY_SETTLEMENT_FAILED:insert_evaluation:column mismatch");
      },
      settleFailed,
    });

    expect(calls).toEqual([
      "savepoint canvas_quality_settlement",
      "settle-successful",
      "rollback to savepoint canvas_quality_settlement",
      "release savepoint canvas_quality_settlement",
      "savepoint canvas_quality_failure_settlement",
      "fallback:CANVAS_RUN_QUALITY_SETTLEMENT_FAILED:insert_evaluation:column mismatch",
      "release savepoint canvas_quality_failure_settlement",
    ]);
  });

  it("rolls back failed failure bookkeeping before terminal containment", async () => {
    const calls: string[] = [];
    const client = { query: vi.fn(async (sql: string) => {
      calls.push(sql);
      return { rows: [] };
    }) } as any;
    const settleContained = vi.fn(async (reason: string, fallbackReason: string) => {
      calls.push(`contained:${reason}:${fallbackReason}`);
    });

    await settleWithQualitySavepoint({
      client,
      settleSuccessful: async () => { throw new Error("primary"); },
      settleFailed: async () => { throw new Error("secondary"); },
      settleContained,
    });

    expect(calls).toEqual([
      "savepoint canvas_quality_settlement",
      "rollback to savepoint canvas_quality_settlement",
      "release savepoint canvas_quality_settlement",
      "savepoint canvas_quality_failure_settlement",
      "rollback to savepoint canvas_quality_failure_settlement",
      "release savepoint canvas_quality_failure_settlement",
      "contained:primary:secondary",
    ]);
  });

  it("contains unavailable quality governance according to the selector policy", () => {
    expect(qualityGovernanceUnavailableReason(new Error("ARTIFACT_QUALITY_PROFILE_NOT_PUBLISHED:image:gray"))).toContain("PROFILE_NOT_PUBLISHED");
    expect(qualityGovernanceUnavailableReason(new Error("LLM_ROUTE_POOL_NOT_PUBLISHED:image_understanding:artifact-quality"))).toContain("ROUTE_POOL_NOT_PUBLISHED");
    expect(qualityGovernanceUnavailableReason(new Error("AGENT_CONFIGURATION_UNAVAILABLE:artifact-image-understanding:gray"))).toContain("AGENT_CONFIGURATION_UNAVAILABLE");
    expect(qualityGovernanceUnavailableReason(new Error("connection reset"))).toBe("");
    expect(smartCandidateUnavailableDisposition({ smartCandidateSelector: { lowConfidencePolicy: "request_manual" } })).toBe("manual");
    expect(smartCandidateUnavailableDisposition({ smartCandidateSelector: { lowConfidencePolicy: "stop" } })).toBe("stop");
    expect(smartCandidateUnavailableDisposition({})).toBe("not_smart");
  });

  it("settles smart selection through confidence and run-scoped candidate ledgers", () => {
    const source = readFileSync(new URL("./canvas-run-quality-coordinator.ts", import.meta.url), "utf8");
    expect(source).toMatch(/resolveSmartCandidateSelection/);
    expect(source).toMatch(/status = 'selecting'.*candidate_context/s);
    expect(source).toMatch(/xh_canvas_run_candidate_artifacts/);
    expect(source).toMatch(/["']not_selected["']/);
    expect(source).toMatch(/skipped_by_selection/);
    expect(source).toMatch(/canvas_run\.candidate_selection_completed/);
    expect(source).toMatch(/runQualitySettlementStage\("insert_evaluation"/);
    expect(source).toMatch(/canvas_run\.quality_governance_unavailable/);
    expect(source).toMatch(/\$4::bigint/);
    expect(source).toMatch(/canvas_run\.quality_settlement_contained/);
  });
});
