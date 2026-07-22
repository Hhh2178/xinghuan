import { randomUUID } from "node:crypto";
import { transitionAgentApprovalStatus, type AgentApprovalStatus } from "@xinghuan/agent-core";
import type { Pool, PoolClient, QueryResultRow } from "pg";

export interface AgentApprovalRecord {
  id: string;
  ownerId: string;
  canvasRunId: string;
  runStepId: string | null;
  actionType: string;
  actionSnapshot: Record<string, unknown>;
  status: AgentApprovalStatus;
  requestedBy: string;
  decidedBy: string | null;
  decisionReason: string | null;
}

interface ApprovalRow extends QueryResultRow {
  id: string;
  owner_id: string;
  canvas_run_id: string;
  run_step_id: string | null;
  action_type: string;
  action_snapshot: Record<string, unknown>;
  status: AgentApprovalStatus;
  requested_by: string;
  decided_by: string | null;
  decision_reason: string | null;
}

export function createAgentApprovalRepository(deps: { getPostgresPool: () => Promise<Pool>; newId?: () => string }) {
  const newId = deps.newId || (() => `agent_approval_${randomUUID()}`);

  async function createApproval(input: { ownerId: string; canvasRunId: string; runStepId?: string; actionType: string; actionSnapshot: Record<string, unknown>; requestedBy: string; expiresAt?: Date }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const owned = await client.query(
        `select r.id from xh_canvas_runs r left join xh_canvas_run_steps s on s.run_id = r.id and s.id = $3
          where r.id = $1 and r.owner_id = $2 and ($3::text is null or s.id is not null) for share of r`,
        [input.canvasRunId, input.ownerId, input.runStepId || null],
      );
      if (!owned.rows[0]) throw new Error("AGENT_APPROVAL_RUN_NOT_FOUND");
      const result = await client.query<ApprovalRow>(
        `insert into xh_agent_approvals
          (id, owner_id, canvas_run_id, run_step_id, action_type, action_snapshot, status, requested_by, expires_at)
         values ($1, $2, $3, $4, $5, $6::jsonb, 'pending', $7, $8) returning *`,
        [newId(), input.ownerId, input.canvasRunId, input.runStepId || null, input.actionType, JSON.stringify(input.actionSnapshot), input.requestedBy, input.expiresAt || null],
      );
      return mapApproval(result.rows[0]);
    });
  }

  async function decideApproval(input: { ownerId: string; approvalId: string; canvasRunId?: string; next: Exclude<AgentApprovalStatus, "pending">; decidedBy: string; reason?: string }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const locked = await client.query<{ status: AgentApprovalStatus }>(
        `select status from xh_agent_approvals where id = $1 and ($3::text is null or canvas_run_id = $3) and owner_id = $2 for update`,
        [input.approvalId, input.ownerId, input.canvasRunId || null],
      );
      const current = locked.rows[0]?.status;
      if (!current) throw new Error("AGENT_APPROVAL_NOT_FOUND");
      const next = transitionAgentApprovalStatus(current, input.next);
      const result = await client.query<ApprovalRow>(
        `update xh_agent_approvals set status = $3, decided_by = $4, decision_reason = $5, decided_at = now(), updated_at = now()
          where id = $1 and owner_id = $2 and ($6::text is null or canvas_run_id = $6) returning *`,
        [input.approvalId, input.ownerId, next, input.decidedBy, input.reason || null, input.canvasRunId || null],
      );
      return mapApproval(result.rows[0]);
    });
  }

  return { createApproval, decideApproval };
}

async function withTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function mapApproval(row: ApprovalRow): AgentApprovalRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    canvasRunId: row.canvas_run_id,
    runStepId: row.run_step_id,
    actionType: row.action_type,
    actionSnapshot: row.action_snapshot || {},
    status: row.status,
    requestedBy: row.requested_by,
    decidedBy: row.decided_by,
    decisionReason: row.decision_reason,
  };
}
