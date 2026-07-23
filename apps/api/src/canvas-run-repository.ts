import { randomUUID } from "node:crypto";
import {
  transitionCanvasRunStatus,
  transitionCanvasRunStepStatus,
  type CanvasRunPlan,
  type CanvasRunStatus,
  type CanvasRunStepStatus,
} from "@xinghuan/agent-core";
import type { Pool, PoolClient, QueryResultRow } from "pg";

export type CanvasRunCommand = "start" | "pause" | "resume" | "cancel" | "retry";

export interface CanvasRunRecord {
  id: string;
  ownerId: string;
  canvasId: string;
  canvasRevision: number;
  runScope: "canvas" | "group" | "downstream" | "workflow";
  workflowId: string | null;
  workflowRevision: number | null;
  workflowSubgraphHash: string | null;
  status: CanvasRunStatus;
  planSnapshot: CanvasRunPlan;
  inputSnapshot: Record<string, unknown>;
  configurationSnapshot: Record<string, unknown>;
  budgetSnapshot: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface CanvasSnapshotRecord {
  id: string;
  ownerId: string;
  revision: number;
  data: Record<string, unknown>;
}

export interface CanvasRunEventRecord {
  id: string;
  runId: string;
  runStepId: string | null;
  runStepKey: string | null;
  nodeId: string | null;
  sequence: number;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

interface CanvasRunRow extends QueryResultRow {
  id: string;
  owner_id: string;
  canvas_id: string;
  canvas_revision: string | number;
  workflow_id: string | null;
  workflow_revision: string | number | null;
  workflow_subgraph_hash: string | null;
  run_scope: CanvasRunRecord["runScope"];
  status: CanvasRunStatus;
  plan_snapshot: CanvasRunPlan;
  input_snapshot: Record<string, unknown>;
  configuration_snapshot: Record<string, unknown>;
  budget_snapshot: Record<string, unknown>;
  created_at_ms: string | number;
  updated_at_ms: string | number;
}

export function createCanvasRunRepository(deps: {
  getPostgresPool: () => Promise<Pool>;
  newId?: (prefix: string) => string;
}) {
  const newId = deps.newId || ((prefix: string) => `${prefix}_${randomUUID()}`);

  async function readOwnedCanvasSnapshot(ownerId: string, canvasId: string): Promise<CanvasSnapshotRecord | null> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select id, owner_id, revision, data from xh_canvases where id = $1 and owner_id = $2 limit 1`,
      [canvasId, ownerId],
    );
    const row = result.rows[0];
    return row ? { id: String(row.id), ownerId: String(row.owner_id), revision: Number(row.revision), data: jsonObject(row.data) } : null;
  }

  async function readOwnedWorkflowInputAssets(ownerId: string, assetIds: string[]) {
    if (assetIds.length === 0) return [];
    const pool = await deps.getPostgresPool();
    const result = await pool.query<{ id: string; kind: string; url: string | null }>(
      `select id, kind, url from xh_assets where owner_id = $1 and id = any($2::text[]) and url is not null`,
      [ownerId, assetIds],
    );
    return result.rows.map((row) => ({ id: String(row.id), kind: String(row.kind), url: String(row.url || "") })).filter((asset) => asset.url);
  }

  async function readOwnedWorkflowSupervisionSettings(ownerId: string, canvasId: string, workflowId: string) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select s.settings, s.revision, extract(epoch from s.updated_at) * 1000 as updated_at_ms
       from xh_workflow_supervision_settings s
       join xh_canvases c on c.id = s.canvas_id
       where c.owner_id = $1 and s.owner_id = $1 and s.canvas_id = $2 and s.workflow_id = $3
       limit 1`,
      [ownerId, canvasId, workflowId],
    );
    return result.rows[0] ? mapWorkflowSupervisionSettings(result.rows[0]) : null;
  }

  async function writeOwnedWorkflowSupervisionSettings(input: {
    ownerId: string;
    canvasId: string;
    workflowId: string;
    settings: Record<string, unknown>;
  }) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `insert into xh_workflow_supervision_settings
        (id, owner_id, canvas_id, workflow_id, settings)
       select $1, $2, $3, $4, $5::jsonb
       from xh_canvases c where c.id = $3 and c.owner_id = $2
       on conflict (owner_id, canvas_id, workflow_id) do update
         set settings = excluded.settings,
             revision = xh_workflow_supervision_settings.revision + 1,
             updated_at = now()
       returning settings, revision, extract(epoch from updated_at) * 1000 as updated_at_ms`,
      [newId("workflow_supervision_settings"), input.ownerId, input.canvasId, input.workflowId, json(input.settings)],
    );
    if (!result.rows[0]) throw new Error("CANVAS_RUN_CANVAS_NOT_FOUND");
    return mapWorkflowSupervisionSettings(result.rows[0]);
  }

  async function deleteOwnedWorkflowSupervisionSettings(ownerId: string, canvasId: string, workflowId: string) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `delete from xh_workflow_supervision_settings s
       using xh_canvases c
       where s.canvas_id = c.id and c.owner_id = $1 and s.owner_id = $1
         and s.canvas_id = $2 and s.workflow_id = $3
       returning s.id`,
      [ownerId, canvasId, workflowId],
    );
    return Boolean(result.rows[0]);
  }

  async function createCanvasRun(input: {
    ownerId: string;
    idempotencyKey: string;
    plan: CanvasRunPlan;
    runScope?: CanvasRunRecord["runScope"];
    configurationSnapshot?: Record<string, unknown>;
    budgetSnapshot?: Record<string, unknown>;
    inputSnapshot?: Record<string, unknown>;
  }): Promise<{ run: CanvasRunRecord; created: boolean }> {
    const isWorkflowRun = Boolean(input.plan.workflowId);
    const runScope = input.runScope || (isWorkflowRun ? "workflow" : "canvas");
    if (isWorkflowRun !== (runScope === "workflow")) throw new Error("CANVAS_RUN_WORKFLOW_IDENTITY_INVALID");
    if (isWorkflowRun && (!input.plan.workflowRevision || !input.plan.workflowSubgraphHash)) {
      throw new Error("CANVAS_RUN_WORKFLOW_IDENTITY_INVALID");
    }
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const canvas = await client.query(
        `select revision from xh_canvases where id = $1 and owner_id = $2 for share`,
        [input.plan.canvasId, input.ownerId],
      );
      if (!canvas.rows[0]) throw new Error("CANVAS_RUN_CANVAS_NOT_FOUND");
      if (Number(canvas.rows[0].revision) !== input.plan.canvasRevision) throw new Error("CANVAS_RUN_REVISION_CONFLICT");

      const runId = newId("canvas_run");
      const inserted = await client.query<CanvasRunRow>(
        `with inserted as (
           insert into xh_canvas_runs
             (id, owner_id, canvas_id, canvas_revision, workflow_id, workflow_revision, workflow_subgraph_hash,
              run_scope, status, plan_snapshot, input_snapshot, configuration_snapshot, budget_snapshot, idempotency_key)
           values ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13)
           on conflict (owner_id, idempotency_key) do nothing
           returning *
         ) ${RUN_SELECT} from inserted r`,
        [
          runId,
          input.ownerId,
          input.plan.canvasId,
          input.plan.canvasRevision,
          input.plan.workflowId || null,
          input.plan.workflowRevision || null,
          input.plan.workflowSubgraphHash || null,
          runScope,
          json(input.plan),
          json(input.inputSnapshot),
          json(input.configurationSnapshot),
          json(input.budgetSnapshot),
          input.idempotencyKey,
        ],
      );
      if (inserted.rows[0]) {
        await insertRunSteps(client, runId, input.plan, newId);
        await appendEventLocked(client, runId, "canvas_run.created", {
          canvasRevision: input.plan.canvasRevision,
          workflowId: input.plan.workflowId || null,
          workflowRevision: input.plan.workflowRevision || null,
          workflowSubgraphHash: input.plan.workflowSubgraphHash || null,
        }, newId);
        const created = await selectOwnedRun(client, input.ownerId, runId);
        if (!created) throw new Error("CANVAS_RUN_CREATE_FAILED");
        return { run: created, created: true };
      }

      const existingResult = await client.query<CanvasRunRow>(
        `${RUN_SELECT} from xh_canvas_runs r where r.owner_id = $1 and r.idempotency_key = $2 limit 1`,
        [input.ownerId, input.idempotencyKey],
      );
      const existing = existingResult.rows[0] ? mapRun(existingResult.rows[0]) : null;
      if (!existing) throw new Error("CANVAS_RUN_IDEMPOTENCY_RACE");
      if (
        existing.canvasId !== input.plan.canvasId
        || existing.canvasRevision !== input.plan.canvasRevision
        || existing.workflowId !== (input.plan.workflowId || null)
        || existing.workflowRevision !== (input.plan.workflowRevision || null)
        || existing.workflowSubgraphHash !== (input.plan.workflowSubgraphHash || null)
      ) throw new Error("CANVAS_RUN_IDEMPOTENCY_CONFLICT");
      return { run: existing, created: false };
    });
  }

  async function readOwnedRun(ownerId: string, runId: string) {
    const pool = await deps.getPostgresPool();
    return selectOwnedRun(pool, ownerId, runId);
  }

  async function readOwnedWorkflowRunOverview(ownerId: string, canvasId: string, limit = 50) {
    const pool = await deps.getPostgresPool();
    const distinctSelect = RUN_SELECT.replace("select r.id", "select distinct on (r.workflow_id) r.id");
    const result = await pool.query<CanvasRunRow>(
      `${distinctSelect} from xh_canvas_runs r
       where r.owner_id = $1 and r.canvas_id = $2 and r.workflow_id is not null
       order by r.workflow_id, r.updated_at desc, r.id desc limit $3`,
      [ownerId, canvasId, Math.max(1, Math.min(100, Math.floor(limit)))],
    );
    return result.rows.map(mapRun);
  }

  async function readOwnedRunEvents(ownerId: string, runId: string, afterSequence = 0, limit = 200): Promise<CanvasRunEventRecord[]> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select e.id, e.run_id, e.run_step_id, s.step_key, s.node_id, e.sequence, e.event_type, e.payload,
        extract(epoch from e.created_at) * 1000 as created_at_ms
       from xh_canvas_run_events e join xh_canvas_runs r on r.id = e.run_id
       left join xh_canvas_run_steps s on s.id = e.run_step_id
       where e.run_id = $1 and r.owner_id = $2 and e.sequence > $3
       order by e.sequence asc limit $4`,
      [runId, ownerId, Math.max(0, Math.floor(afterSequence)), Math.max(1, Math.min(500, Math.floor(limit)))],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      runStepId: row.run_step_id ? String(row.run_step_id) : null,
      runStepKey: row.step_key ? String(row.step_key) : null,
      nodeId: row.node_id ? String(row.node_id) : null,
      sequence: Number(row.sequence),
      eventType: String(row.event_type),
      payload: jsonObject(row.payload),
      createdAt: Number(row.created_at_ms),
    }));
  }

  async function applyCommand(input: {
    ownerId: string;
    runId: string;
    command: CanvasRunCommand;
    idempotencyKey: string;
    requestSnapshot?: Record<string, unknown>;
  }): Promise<CanvasRunRecord> {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const replay = await client.query(
        `select run_id, command_type from xh_canvas_run_commands where owner_id = $1 and idempotency_key = $2 limit 1`,
        [input.ownerId, input.idempotencyKey],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].run_id !== input.runId || replay.rows[0].command_type !== input.command) throw new Error("CANVAS_RUN_COMMAND_IDEMPOTENCY_CONFLICT");
        const replayed = await selectOwnedRun(client, input.ownerId, input.runId);
        if (!replayed) throw new Error("CANVAS_RUN_NOT_FOUND");
        return replayed;
      }

      const locked = await client.query<{ status: CanvasRunStatus }>(
        `select status from xh_canvas_runs where id = $1 and owner_id = $2 for update`,
        [input.runId, input.ownerId],
      );
      const current = locked.rows[0]?.status;
      if (!current) throw new Error("CANVAS_RUN_NOT_FOUND");
      const next = resolveCommandStatus(current, input.command);
      await client.query(
        `update xh_canvas_runs set status = $3, updated_at = now(),
          started_at = case when $3 = 'running' and started_at is null then now() else started_at end,
          finalized_at = case when $3 in ('succeeded', 'failed', 'cancelled') then now() else null end
          where id = $1 and owner_id = $2`,
        [input.runId, input.ownerId, next],
      );
      if (input.command === "cancel") {
        await client.query(
          `update xh_tasks set status = 'cancelled', updated_at = now(), finalized_at = now(),
             logs = coalesce(logs, '[]'::jsonb) || '["Canvas Run 已取消"]'::jsonb
           where id in (
             select task_id from xh_canvas_run_steps where run_id = $1 and task_id is not null
             union
             select quality_task_id from xh_canvas_run_steps where run_id = $1 and quality_task_id is not null
           )
             and status in ('queued', 'running')`,
          [input.runId],
        );
        await client.query(
          `update xh_canvas_run_steps set status = 'cancelled', updated_at = now(), finalized_at = now()
           where run_id = $1 and status not in ('succeeded', 'failed', 'cancelled', 'skipped')`,
          [input.runId],
        );
        await client.query(
          `update xh_agent_runs set status = 'cancelled', updated_at = now(), finalized_at = now()
           where canvas_run_id = $1 and status in ('queued', 'running', 'awaiting_approval')`,
          [input.runId],
        );
      }
      if (input.command === "retry") {
        await client.query(
          `update xh_canvas_run_steps s set status = case
             when not exists (
               select 1 from jsonb_array_elements_text(s.depends_on) dep
               left join xh_canvas_run_steps d on d.run_id = s.run_id and d.node_id = dep
               where d.id is null or d.status not in ('succeeded', 'skipped')
             ) then 'ready' else 'blocked' end,
             task_id = null, dispatch_enqueued_at = null, quality_task_id = null,
             quality_dispatch_enqueued_at = null, quality_context = '{}'::jsonb, error = '{}'::jsonb,
             updated_at = now(), finalized_at = null
           where s.run_id = $1 and s.status = 'failed'`,
          [input.runId],
        );
      }
      await appendEventLocked(client, input.runId, `canvas_run.${input.command}`, { previousStatus: current, status: next }, newId);
      await client.query(
        `insert into xh_canvas_run_commands
          (id, owner_id, run_id, command_type, idempotency_key, request_snapshot, response_snapshot)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
        [newId("canvas_run_command"), input.ownerId, input.runId, input.command, input.idempotencyKey, json(input.requestSnapshot), json({ runId: input.runId, status: next })],
      );
      const updated = await selectOwnedRun(client, input.ownerId, input.runId);
      if (!updated) throw new Error("CANVAS_RUN_NOT_FOUND");
      return updated;
    });
  }

  async function transitionStep(input: { ownerId: string; runId: string; stepId: string; next: CanvasRunStepStatus }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const result = await client.query<{ status: CanvasRunStepStatus }>(
        `select s.status from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id
          where s.id = $1 and s.run_id = $2 and r.owner_id = $3 for update of s`,
        [input.stepId, input.runId, input.ownerId],
      );
      const current = result.rows[0]?.status;
      if (!current) throw new Error("CANVAS_RUN_STEP_NOT_FOUND");
      const next = transitionCanvasRunStepStatus(current, input.next);
      await client.query(
        `update xh_canvas_run_steps set status = $2, updated_at = now(),
          started_at = case when $2 = 'running' and started_at is null then now() else started_at end,
          finalized_at = case when $2 in ('succeeded', 'failed', 'cancelled', 'skipped') then now() else null end
          where id = $1`,
        [input.stepId, next],
      );
      await appendEventLocked(client, input.runId, "canvas_run.step_status_changed", { stepId: input.stepId, previousStatus: current, status: next }, newId, input.stepId);
      return next;
    });
  }

  return {
    applyCommand,
    createCanvasRun,
    deleteOwnedWorkflowSupervisionSettings,
    readOwnedCanvasSnapshot,
    readOwnedRun,
    readOwnedRunEvents,
    readOwnedWorkflowRunOverview,
    readOwnedWorkflowInputAssets,
    readOwnedWorkflowSupervisionSettings,
    transitionStep,
    writeOwnedWorkflowSupervisionSettings,
  };
}

const RUN_SELECT = `select r.id, r.owner_id, r.canvas_id, r.canvas_revision,
  r.workflow_id, r.workflow_revision, r.workflow_subgraph_hash, r.run_scope, r.status,
  r.plan_snapshot, r.input_snapshot, r.configuration_snapshot, r.budget_snapshot,
  extract(epoch from r.created_at) * 1000 as created_at_ms,
  extract(epoch from r.updated_at) * 1000 as updated_at_ms`;

async function selectOwnedRun(queryable: Pick<Pool, "query"> | Pick<PoolClient, "query">, ownerId: string, runId: string) {
  const result = await queryable.query<CanvasRunRow>(`${RUN_SELECT} from xh_canvas_runs r where r.id = $1 and r.owner_id = $2 limit 1`, [runId, ownerId]);
  return result.rows[0] ? mapRun(result.rows[0]) : null;
}

async function insertRunSteps(client: PoolClient, runId: string, plan: CanvasRunPlan, newId: (prefix: string) => string) {
  for (const [sequence, step] of plan.steps.entries()) {
    await client.query(
      `insert into xh_canvas_run_steps
        (id, run_id, step_key, node_id, node_type, group_id, sequence, status, depends_on)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [newId("canvas_run_step"), runId, step.id, step.nodeId, step.nodeType, step.groupId, sequence, step.skipped ? "skipped" : step.dependsOn.length > 0 ? "blocked" : "ready", json(step.dependsOn)],
    );
  }
}

async function appendEventLocked(client: PoolClient, runId: string, eventType: string, payload: Record<string, unknown>, newId: (prefix: string) => string, stepId?: string) {
  const sequence = await client.query<{ event_sequence: string | number }>(
    `update xh_canvas_runs set event_sequence = event_sequence + 1, updated_at = now() where id = $1 returning event_sequence`,
    [runId],
  );
  if (!sequence.rows[0]) throw new Error("CANVAS_RUN_NOT_FOUND");
  await client.query(
    `insert into xh_canvas_run_events (id, run_id, run_step_id, sequence, event_type, payload)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [newId("canvas_run_event"), runId, stepId || null, Number(sequence.rows[0].event_sequence), eventType, json(payload)],
  );
}

function resolveCommandStatus(current: CanvasRunStatus, command: CanvasRunCommand): CanvasRunStatus {
  if (command === "start") {
    if (current === "draft") return transitionCanvasRunStatus(transitionCanvasRunStatus(current, "planning"), "queued");
    if (current === "planning" || current === "awaiting_approval") return transitionCanvasRunStatus(current, "queued");
    throw new Error(`CANVAS_RUN_COMMAND_INVALID:start:${current}`);
  }
  if (command === "pause") return transitionCanvasRunStatus(current, "paused");
  if (command === "resume") return transitionCanvasRunStatus(current, "running");
  if (command === "cancel") return transitionCanvasRunStatus(current, "cancelled");
  if (current !== "failed") throw new Error(`CANVAS_RUN_COMMAND_INVALID:retry:${current}`);
  return transitionCanvasRunStatus(current, "queued");
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
    throw mapWorkflowRunConstraintError(error);
  } finally {
    client.release();
  }
}

function mapRun(row: CanvasRunRow): CanvasRunRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    canvasId: row.canvas_id,
    canvasRevision: Number(row.canvas_revision),
    workflowId: row.workflow_id || null,
    workflowRevision: row.workflow_revision === null || row.workflow_revision === undefined ? null : Number(row.workflow_revision),
    workflowSubgraphHash: row.workflow_subgraph_hash || null,
    runScope: row.run_scope,
    status: row.status,
    planSnapshot: row.plan_snapshot,
    inputSnapshot: jsonObject(row.input_snapshot),
    configurationSnapshot: jsonObject(row.configuration_snapshot),
    budgetSnapshot: jsonObject(row.budget_snapshot),
    createdAt: Number(row.created_at_ms),
    updatedAt: Number(row.updated_at_ms),
  };
}

function mapWorkflowRunConstraintError(error: unknown) {
  const postgres = error as { code?: unknown; constraint?: unknown };
  if (postgres.code === "23505" && postgres.constraint === "uq_xh_canvas_runs_active_workflow") {
    return new Error("WORKFLOW_RUN_ACTIVE_CONFLICT");
  }
  return error;
}

function mapWorkflowSupervisionSettings(row: Record<string, unknown>) {
  return {
    settings: jsonObject(row.settings),
    revision: Number(row.revision),
    updatedAt: Number(row.updated_at_ms),
  };
}

function json(value: unknown) {
  return JSON.stringify(value || {});
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
