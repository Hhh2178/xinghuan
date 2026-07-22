import { randomUUID } from "node:crypto";
import { transitionTaskAttemptStatus, type TaskAttemptStatus } from "@xinghuan/agent-core";
import type { Pool, PoolClient, QueryResultRow } from "pg";

export interface TaskAttemptRecord {
  id: string;
  ownerId: string;
  runStepId: string;
  taskId: string | null;
  attemptNo: number;
  providerId: string | null;
  modelId: string | null;
  status: TaskAttemptStatus;
  reason: string | null;
  errorClass: string | null;
  parameterSnapshot: Record<string, unknown>;
}

interface AttemptRow extends QueryResultRow {
  id: string;
  owner_id: string;
  run_step_id: string;
  task_id: string | null;
  attempt_no: number;
  provider_id: string | null;
  model_id: string | null;
  status: TaskAttemptStatus;
  reason: string | null;
  error_class: string | null;
  parameter_snapshot: Record<string, unknown>;
}

export function createTaskAttemptRepository(deps: { getPostgresPool: () => Promise<Pool>; newId?: () => string }) {
  const newId = deps.newId || (() => `task_attempt_${randomUUID()}`);

  async function createAttempt(input: {
    ownerId: string;
    runStepId: string;
    attemptNo: number;
    idempotencyKey: string;
    taskId?: string;
    providerId?: string;
    modelId?: string;
    reason?: string;
    parameterSnapshot?: Record<string, unknown>;
  }): Promise<{ attempt: TaskAttemptRecord; created: boolean }> {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const owned = await client.query(
        `select s.id from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id
          where s.id = $1 and r.owner_id = $2 for share of s`,
        [input.runStepId, input.ownerId],
      );
      if (!owned.rows[0]) throw new Error("TASK_ATTEMPT_STEP_NOT_FOUND");
      const inserted = await client.query<AttemptRow>(
        `insert into xh_task_attempts
          (id, owner_id, run_step_id, task_id, attempt_no, provider_id, model_id, status, reason, parameter_snapshot, idempotency_key)
         values ($1, $2, $3, $4, $5, $6, $7, 'queued', $8, $9::jsonb, $10)
         on conflict (owner_id, idempotency_key) do nothing
         returning *`,
        [newId(), input.ownerId, input.runStepId, input.taskId || null, input.attemptNo, input.providerId || null, input.modelId || null, input.reason || null, JSON.stringify(input.parameterSnapshot || {}), input.idempotencyKey],
      );
      if (inserted.rows[0]) return { attempt: mapAttempt(inserted.rows[0]), created: true };
      const replay = await client.query<AttemptRow>(
        `select * from xh_task_attempts where owner_id = $1 and idempotency_key = $2 limit 1`,
        [input.ownerId, input.idempotencyKey],
      );
      if (!replay.rows[0]) throw new Error("TASK_ATTEMPT_IDEMPOTENCY_RACE");
      if (replay.rows[0].run_step_id !== input.runStepId || Number(replay.rows[0].attempt_no) !== input.attemptNo) throw new Error("TASK_ATTEMPT_IDEMPOTENCY_CONFLICT");
      return { attempt: mapAttempt(replay.rows[0]), created: false };
    });
  }

  async function transitionAttempt(input: { ownerId: string; attemptId: string; next: TaskAttemptStatus; errorClass?: string }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const currentResult = await client.query<{ status: TaskAttemptStatus }>(
        `select status from xh_task_attempts where id = $1 and owner_id = $2 for update`,
        [input.attemptId, input.ownerId],
      );
      const current = currentResult.rows[0]?.status;
      if (!current) throw new Error("TASK_ATTEMPT_NOT_FOUND");
      const next = transitionTaskAttemptStatus(current, input.next);
      const updated = await client.query<AttemptRow>(
        `update xh_task_attempts set status = $3, error_class = coalesce($4, error_class), updated_at = now(),
          finalized_at = case when $3 in ('succeeded', 'failed', 'cancelled') then now() else null end
          where id = $1 and owner_id = $2 returning *`,
        [input.attemptId, input.ownerId, next, input.errorClass || null],
      );
      return mapAttempt(updated.rows[0]);
    });
  }

  return { createAttempt, transitionAttempt };
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

function mapAttempt(row: AttemptRow): TaskAttemptRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    runStepId: row.run_step_id,
    taskId: row.task_id,
    attemptNo: Number(row.attempt_no),
    providerId: row.provider_id,
    modelId: row.model_id,
    status: row.status,
    reason: row.reason,
    errorClass: row.error_class,
    parameterSnapshot: row.parameter_snapshot || {},
  };
}
