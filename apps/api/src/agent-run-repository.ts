import { randomUUID } from "node:crypto";
import { transitionAgentRunStatus, type AgentRole, type AgentRunStatus } from "@xinghuan/agent-core";
import type { Pool, PoolClient, QueryResultRow } from "pg";

export interface AgentRunRecord {
  id: string;
  ownerId: string;
  canvasRunId: string | null;
  parentAgentRunId: string | null;
  agentDefinitionId: string;
  configurationVersionId: string;
  knowledgeSnapshotId: string;
  role: AgentRole;
  scenario: string;
  status: AgentRunStatus;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot: Record<string, unknown>;
  budgetSnapshot: Record<string, unknown>;
  error: Record<string, unknown>;
}

interface AgentRunRow extends QueryResultRow {
  id: string;
  owner_id: string;
  canvas_run_id: string | null;
  parent_agent_run_id: string | null;
  agent_definition_id: string;
  configuration_version_id: string;
  knowledge_snapshot_id: string;
  role: AgentRole;
  scenario: string;
  status: AgentRunStatus;
  input_snapshot: Record<string, unknown>;
  output_snapshot: Record<string, unknown>;
  budget_snapshot: Record<string, unknown>;
  error: Record<string, unknown>;
}

export function createAgentRunRepository(deps: { getPostgresPool: () => Promise<Pool>; newId?: (prefix: string) => string }) {
  const newId = deps.newId || ((prefix: string) => `${prefix}_${randomUUID()}`);

  async function readRunByIdempotency(input: { ownerId: string; idempotencyKey: string }) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query<AgentRunRow>(
      `select * from xh_agent_runs where owner_id = $1 and idempotency_key = $2 limit 1`,
      [input.ownerId, input.idempotencyKey],
    );
    return result.rows[0] ? mapRun(result.rows[0]) : null;
  }

  async function createRun(input: {
    ownerId: string;
    agentKey: string;
    role: AgentRole;
    scenario: string;
    environment: "gray" | "production";
    idempotencyKey: string;
    canvasRunId?: string;
    parentAgentRunId?: string;
    configurationVersionId: string;
    knowledgeSnapshotId: string;
    inputSnapshot: Record<string, unknown>;
    budgetSnapshot: Record<string, unknown>;
  }): Promise<{ run: AgentRunRecord; created: boolean }> {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const existing = await client.query<AgentRunRow>(
        `select * from xh_agent_runs where owner_id = $1 and idempotency_key = $2 limit 1`,
        [input.ownerId, input.idempotencyKey],
      );
      if (existing.rows[0]) {
        assertReplayCompatible(existing.rows[0], input);
        return { run: mapRun(existing.rows[0]), created: false };
      }
      const definition = await client.query(
        `select d.id as definition_id, cv.id as configuration_version_id
         from xh_agent_definitions d
         join xh_agent_configuration_versions cv on cv.agent_definition_id = d.id and cv.status = 'approved'
         join xh_agent_configuration_publications cp on cp.configuration_version_id = cv.id and cp.environment = $3 and cp.retired_at is null
         where d.agent_key = $1 and d.role = $2 and d.enabled = true and cv.id = $4
         order by cv.version desc limit 1 for share of d`,
        [input.agentKey, input.role, input.environment, input.configurationVersionId],
      );
      if (!definition.rows[0]) throw new Error(`AGENT_CONFIGURATION_UNAVAILABLE:${input.agentKey}:${input.environment}`);
      const inserted = await client.query<AgentRunRow>(
        `insert into xh_agent_runs
          (id, owner_id, canvas_run_id, parent_agent_run_id, agent_definition_id, configuration_version_id,
           knowledge_snapshot_id, role, scenario, status, input_snapshot, budget_snapshot, idempotency_key)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'queued', $10::jsonb, $11::jsonb, $12)
         on conflict (owner_id, idempotency_key) do nothing returning *`,
        [newId("agent_run"), input.ownerId, input.canvasRunId || null, input.parentAgentRunId || null,
          definition.rows[0].definition_id, definition.rows[0].configuration_version_id, input.knowledgeSnapshotId,
          input.role, input.scenario, JSON.stringify(input.inputSnapshot), JSON.stringify(input.budgetSnapshot), input.idempotencyKey],
      );
      if (inserted.rows[0]) return { run: mapRun(inserted.rows[0]), created: true };
      const replay = await client.query<AgentRunRow>(
        `select * from xh_agent_runs where owner_id = $1 and idempotency_key = $2 limit 1`,
        [input.ownerId, input.idempotencyKey],
      );
      if (!replay.rows[0]) throw new Error("AGENT_RUN_IDEMPOTENCY_RACE");
      assertReplayCompatible(replay.rows[0], input);
      return { run: mapRun(replay.rows[0]), created: false };
    });
  }

  async function transitionRun(input: { ownerId: string; runId: string; next: AgentRunStatus; output?: Record<string, unknown>; error?: Record<string, unknown> }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const currentResult = await client.query<{ status: AgentRunStatus }>(
        `select status from xh_agent_runs where id = $1 and owner_id = $2 for update`,
        [input.runId, input.ownerId],
      );
      const current = currentResult.rows[0]?.status;
      if (!current) throw new Error("AGENT_RUN_NOT_FOUND");
      const next = transitionAgentRunStatus(current, input.next);
      const result = await client.query<AgentRunRow>(
        `update xh_agent_runs set status = $3,
          output_snapshot = case when $4::jsonb = '{}'::jsonb then output_snapshot else $4::jsonb end,
          error = case when $5::jsonb = '{}'::jsonb then error else $5::jsonb end,
          started_at = case when $3 = 'running' and started_at is null then now() else started_at end,
          finalized_at = case when $3 in ('succeeded', 'failed', 'cancelled') then now() else null end,
          updated_at = now() where id = $1 and owner_id = $2 returning *`,
        [input.runId, input.ownerId, next, JSON.stringify(input.output || {}), JSON.stringify(input.error || {})],
      );
      return mapRun(result.rows[0]);
    });
  }

  async function appendAction(input: {
    ownerId: string;
    runId: string;
    actionType: string;
    toolName?: string;
    status: "proposed" | "approved" | "running" | "succeeded" | "failed" | "rejected";
    inputSnapshot?: Record<string, unknown>;
    outputSnapshot?: Record<string, unknown>;
    error?: Record<string, unknown>;
  }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const sequence = await client.query<{ action_sequence: number }>(
        `update xh_agent_runs set action_sequence = action_sequence + 1, updated_at = now()
          where id = $1 and owner_id = $2 returning action_sequence`,
        [input.runId, input.ownerId],
      );
      if (!sequence.rows[0]) throw new Error("AGENT_RUN_NOT_FOUND");
      const actionId = newId("agent_action");
      await client.query(
        `insert into xh_agent_actions
          (id, owner_id, agent_run_id, sequence, action_type, tool_name, status, input_snapshot, output_snapshot, error, finalized_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb,
          case when $7 in ('succeeded', 'failed', 'rejected') then now() else null end)`,
        [actionId, input.ownerId, input.runId, Number(sequence.rows[0].action_sequence), input.actionType, input.toolName || null,
          input.status, JSON.stringify(input.inputSnapshot || {}), JSON.stringify(input.outputSnapshot || {}), JSON.stringify(input.error || {})],
      );
      return { id: actionId, sequence: Number(sequence.rows[0].action_sequence) };
    });
  }

  return { appendAction, createRun, readRunByIdempotency, transitionRun };
}

function assertReplayCompatible(row: AgentRunRow, input: { role: AgentRole; scenario: string }) {
  if (row.role !== input.role || row.scenario !== input.scenario) throw new Error("AGENT_RUN_IDEMPOTENCY_CONFLICT");
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

function mapRun(row: AgentRunRow): AgentRunRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    canvasRunId: row.canvas_run_id,
    parentAgentRunId: row.parent_agent_run_id,
    agentDefinitionId: row.agent_definition_id,
    configurationVersionId: row.configuration_version_id,
    knowledgeSnapshotId: row.knowledge_snapshot_id,
    role: row.role,
    scenario: row.scenario,
    status: row.status,
    inputSnapshot: row.input_snapshot || {},
    outputSnapshot: row.output_snapshot || {},
    budgetSnapshot: row.budget_snapshot || {},
    error: row.error || {},
  };
}
