import { describe, expect, it, vi } from "vitest";

import { createAgentApprovalRepository } from "./agent-approval-repository.js";
import { createTaskAttemptRepository } from "./task-attempt-repository.js";

function poolWith(handler: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>) {
  const query = vi.fn(handler);
  const release = vi.fn();
  return { pool: { connect: async () => ({ query, release }) } as any, query, release };
}

describe("agent runtime ledgers", () => {
  it("creates owner-scoped immutable task attempts with an idempotency key", async () => {
    const row = {
      id: "attempt-1", owner_id: "owner-1", run_step_id: "step-1", task_id: null, attempt_no: 1,
      provider_id: "provider-1", model_id: "model-1", status: "queued", reason: "initial",
      error_class: null, parameter_snapshot: { prompt: "snapshot" },
    };
    const { pool, query } = poolWith(async (sql) => {
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("join xh_canvas_runs")) return { rows: [{ id: "step-1" }] };
      if (sql.includes("insert into xh_task_attempts")) return { rows: [row] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createTaskAttemptRepository({ getPostgresPool: async () => pool, newId: () => "attempt-1" });

    await expect(repository.createAttempt({
      ownerId: "owner-1", runStepId: "step-1", attemptNo: 1, idempotencyKey: "attempt-key-1",
      providerId: "provider-1", modelId: "model-1", reason: "initial", parameterSnapshot: { prompt: "snapshot" },
    })).resolves.toMatchObject({ created: true, attempt: { id: "attempt-1", ownerId: "owner-1", status: "queued" } });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("r.owner_id = $2 for share"))).toBe(true);
  });

  it("decides a pending approval under an owner lock and never rewrites a terminal decision", async () => {
    const approved = {
      id: "approval-1", owner_id: "owner-1", canvas_run_id: "run-1", run_step_id: "step-1",
      action_type: "switch_model", action_snapshot: { modelId: "backup" }, status: "approved",
      requested_by: "agent", decided_by: "owner-1", decision_reason: "accepted",
    };
    const { pool, query } = poolWith(async (sql) => {
      if (sql === "begin" || sql === "commit") return { rows: [] };
      if (sql.includes("select status from xh_agent_approvals")) return { rows: [{ status: "pending" }] };
      if (sql.includes("update xh_agent_approvals")) return { rows: [approved] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const repository = createAgentApprovalRepository({ getPostgresPool: async () => pool });

    await expect(repository.decideApproval({ ownerId: "owner-1", approvalId: "approval-1", next: "approved", decidedBy: "owner-1", reason: "accepted" })).resolves.toMatchObject({ status: "approved", decidedBy: "owner-1" });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("owner_id = $2 for update"))).toBe(true);
  });
});
