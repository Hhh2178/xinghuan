import { randomUUID } from "node:crypto";
import type { GenerationFailureCategory, RecoveryPlan } from "@xinghuan/agent-core";
import type { Pool } from "pg";

export interface RecoveryContextRecord {
  ownerId: string;
  canvasRunId: string;
  runStepId: string;
  nodeId: string;
  planSnapshot: Record<string, unknown>;
  currentProviderId: string;
  currentModelId: string;
  currentModelRecordId: string;
  attempts: number;
  priorActions: string[];
  triedModelRecordIds: string[];
}

export function createRecoveryDecisionRepository(deps: { getPostgresPool: () => Promise<Pool>; newId?: () => string }) {
  const newId = deps.newId || (() => `recovery_decision_${randomUUID()}`);

  async function readContext(ownerId: string, canvasRunId: string, runStepId: string): Promise<RecoveryContextRecord | null> {
    const pool = await deps.getPostgresPool();
    const [stepResult, decisionsResult] = await Promise.all([
      pool.query(
        `select r.owner_id, r.id as canvas_run_id, r.plan_snapshot, s.id as run_step_id, s.node_id,
          coalesce(a.provider_id, '') as provider_id, coalesce(a.model_id, '') as model_id,
          coalesce(a.parameter_snapshot->>'modelRecordId', '') as model_record_id,
          s.attempt_count
         from xh_canvas_runs r join xh_canvas_run_steps s on s.run_id = r.id
         left join lateral (
           select provider_id, model_id, parameter_snapshot from xh_task_attempts where run_step_id = s.id order by attempt_no desc limit 1
         ) a on true
         where r.id = $1 and r.owner_id = $2 and s.id = $3 limit 1`,
        [canvasRunId, ownerId, runStepId],
      ),
      pool.query(
        `select action_type, alternative_generation_model_id_snapshot from xh_recovery_decisions
          where canvas_run_id = $1 and owner_id = $2 and run_step_id = $3 order by created_at asc`,
        [canvasRunId, ownerId, runStepId],
      ),
    ]);
    const row = stepResult.rows[0];
    if (!row) return null;
    return {
      ownerId: String(row.owner_id), canvasRunId: String(row.canvas_run_id), runStepId: String(row.run_step_id), nodeId: String(row.node_id),
      planSnapshot: objectValue(row.plan_snapshot), currentProviderId: String(row.provider_id), currentModelId: String(row.model_id), currentModelRecordId: String(row.model_record_id),
      attempts: Number(row.attempt_count || 0), priorActions: decisionsResult.rows.map((item) => String(item.action_type)),
      triedModelRecordIds: decisionsResult.rows.map((item) => String(item.alternative_generation_model_id_snapshot || "")).filter(Boolean),
    };
  }

  async function recordDecision(input: {
    context: RecoveryContextRecord;
    failureCategory: GenerationFailureCategory;
    plan: RecoveryPlan;
    taskAttemptId?: string;
    agentRunId?: string;
    approvalId?: string;
    budgetSnapshot: Record<string, unknown>;
    idempotencyKey: string;
  }) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `insert into xh_recovery_decisions
        (id, owner_id, canvas_run_id, run_step_id, task_attempt_id, agent_run_id, failure_category, action_type,
         current_generation_provider_id_snapshot, current_generation_model_id_snapshot,
         alternative_generation_provider_id_snapshot, alternative_generation_model_id_snapshot,
         parameter_patch, budget_snapshot, reason, approval_id, status, idempotency_key)
       select $1, r.owner_id, r.id, s.id, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15, $16,
         case when $8 = 'request_approval' then 'proposed' when $8 = 'stop' then 'stopped' else 'approved' end, $17
       from xh_canvas_runs r join xh_canvas_run_steps s on s.run_id = r.id
       where r.id = $3 and r.owner_id = $2 and s.id = $4
       on conflict (owner_id, idempotency_key) do nothing returning id`,
      [newId(), input.context.ownerId, input.context.canvasRunId, input.context.runStepId, input.taskAttemptId || null, input.agentRunId || null,
        input.failureCategory, input.plan.action, input.context.currentProviderId || null, input.context.currentModelId || null,
        input.plan.alternative?.providerId || null, input.plan.alternative?.modelRecordId || null, JSON.stringify(input.plan.parameterPatch || {}),
        JSON.stringify(input.budgetSnapshot), input.plan.reason, input.approvalId || null, input.idempotencyKey],
    );
    if (result.rows[0]) return String(result.rows[0].id);
    const replay = await pool.query(`select id, action_type from xh_recovery_decisions where owner_id = $1 and idempotency_key = $2 limit 1`, [input.context.ownerId, input.idempotencyKey]);
    if (!replay.rows[0] || replay.rows[0].action_type !== input.plan.action) throw new Error("RECOVERY_DECISION_IDEMPOTENCY_CONFLICT");
    return String(replay.rows[0].id);
  }

  return { readContext, recordDecision };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
