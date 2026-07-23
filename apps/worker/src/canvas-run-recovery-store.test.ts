import { describe, expect, it, vi } from "vitest";

import { settleCanvasRunPromptRewriteTask } from "./canvas-run-recovery-store.js";

describe("Canvas Run recovery store", () => {
  it("applies a successful structured rewrite with before, after and diff evidence", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        return { rows: [] };
      }),
    } as any;
    const appendEvent = vi.fn(async () => undefined);
    const failStep = vi.fn(async () => undefined);

    await settleCanvasRunPromptRewriteTask(client, rewriteStep({
      task_status: "succeeded",
      task_result: {
        content: JSON.stringify({
          rewrittenPrompt: "a safe studio portrait",
          changes: [{ before: "unsafe", after: "safe", reason: "content review" }],
        }),
      },
    }), appendEvent, failStep);

    const decisionUpdate = queries.find((item) => item.sql.includes("input_after_snapshot"));
    expect(decisionUpdate?.params.slice(0, 4)).toEqual([
      "decision-1",
      JSON.stringify({ prompt: "an unsafe studio portrait" }),
      JSON.stringify({ prompt: "a safe studio portrait" }),
      JSON.stringify([{ before: "unsafe", after: "safe", reason: "content review" }]),
    ]);
    const stepUpdate = queries.find((item) => item.sql.includes("recovery_overrides = $2::jsonb"));
    expect(JSON.parse(String(stepUpdate?.params[1]))).toMatchObject({
      executionPayload: { prompt: "a safe studio portrait" },
    });
    expect(failStep).not.toHaveBeenCalled();
    expect(appendEvent).toHaveBeenCalledWith(
      client,
      "run-1",
      "step-1",
      "canvas_run.prompt_rewrite_applied",
      expect.objectContaining({ decisionId: "decision-1", changeCount: 1 }),
    );
  });

  it("fails closed when the rewrite task returns an invalid payload", async () => {
    const client = { query: vi.fn(async () => ({ rows: [] })) } as any;
    const appendEvent = vi.fn(async () => undefined);
    const failStep = vi.fn(async () => undefined);

    await settleCanvasRunPromptRewriteTask(client, rewriteStep({
      task_status: "succeeded",
      task_result: { content: "not-json" },
    }), appendEvent, failStep);

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("set status = 'failed'"),
      ["decision-1", "owner-1"],
    );
    expect(failStep).toHaveBeenCalledWith(client, expect.anything(), {
      code: "CANVAS_RUN_PROMPT_REWRITE_INVALID",
      decisionId: "decision-1",
      rewriteTaskId: "rewrite-task-1",
    });
    expect(appendEvent).not.toHaveBeenCalled();
  });

  it("uses the next frozen published route after a technical rewrite failure", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        return { rows: [] };
      }),
    } as any;
    const appendEvent = vi.fn(async () => undefined);
    const failStep = vi.fn(async () => undefined);
    const step: ReturnType<typeof rewriteStep> & { recovery_context: Record<string, unknown> } = rewriteStep({
      task_status: "failed",
      task_result: { upstreamHttpStatus: 503, failureReason: "provider unavailable" },
    });
    step.recovery_context = {
      ...step.recovery_context,
      originalTaskId: "generation-task-1",
      rewriteAttemptNo: 1,
      routeIndex: 0,
      routePlan: {
        reason: "frozen route order",
        rejected: [],
        orderedRoutes: [
          route("entry-1", "provider-1", "model-1"),
          route("entry-2", "provider-2", "model-2"),
        ],
      },
    };

    await settleCanvasRunPromptRewriteTask(client, step, appendEvent, failStep);

    const taskInsert = queries.find((item) => item.sql.includes("insert into xh_tasks"));
    expect(taskInsert?.params.slice(3, 5)).toEqual(["provider-2", "model-2"]);
    const stepUpdate = queries.find((item) => item.sql.includes("recovery_context = $3::jsonb"));
    expect(JSON.parse(String(stepUpdate?.params[2]))).toMatchObject({
      originalTaskId: "generation-task-1",
      routeIndex: 1,
    });
    expect(failStep).not.toHaveBeenCalled();
    expect(appendEvent).toHaveBeenCalledWith(
      client,
      "run-1",
      "step-1",
      "canvas_run.prompt_rewrite_started",
      expect.objectContaining({ routeAttemptNo: 2, routeEntryId: "entry-2" }),
    );
  });
});

function rewriteStep(overrides: Record<string, unknown>): {
  id: string;
  run_id: string;
  owner_id: string;
  node_id: string;
  task_id: string;
  task_status: string;
  task_result: Record<string, unknown>;
  budget_snapshot: Record<string, unknown>;
  configuration_snapshot: Record<string, unknown>;
  recovery_overrides: Record<string, unknown>;
  recovery_context: Record<string, unknown>;
} {
  return {
    id: "step-1",
    run_id: "run-1",
    owner_id: "owner-1",
    node_id: "image-1",
    task_id: "rewrite-task-1",
    task_status: "succeeded",
    task_result: {},
    budget_snapshot: {},
    configuration_snapshot: {},
    recovery_overrides: {},
    recovery_context: {
      kind: "prompt_review_rewrite",
      decisionId: "decision-1",
      originalPrompt: "an unsafe studio portrait",
    },
    ...overrides,
  };
}

function route(entryId: string, providerId: string, modelRecordId: string) {
  return {
    pool_id: "pool-1",
    pool_version_id: "pool-version-1",
    entry_id: entryId,
    provider_id: providerId,
    model_record_id: modelRecordId,
  };
}
