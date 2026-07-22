import { randomUUID } from "node:crypto";
import { nextLlmRouteState, routeStateAfterCooldown, type AgentRole, type LlmRouteCandidate, type LlmRouteEntryState, type LlmRoutingDecision } from "@xinghuan/agent-core";
import type { Pool, PoolClient } from "pg";

export interface PublishedLlmRoutePool {
  poolId: string;
  poolVersionId: string;
  policy: Record<string, unknown>;
  candidates: LlmRouteCandidate[];
}

export function createLlmRoutingRepository(deps: { getPostgresPool: () => Promise<Pool>; newId?: (prefix: string) => string }) {
  const newId = deps.newId || ((prefix: string) => `${prefix}_${randomUUID()}`);

  async function readPublishedPool(input: { role: AgentRole; scenario: string; environment: "gray" | "production" }): Promise<PublishedLlmRoutePool | null> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select p.id as pool_id, pv.id as pool_version_id, pv.policy_snapshot,
        e.id as entry_id, e.provider_id, e.model_id, e.model_capability_snapshot, e.capability_tags_snapshot,
        e.model_input_capabilities_snapshot, e.media_input_transports_snapshot,
        e.priority, e.weight, e.estimated_cost::text,
        coalesce(h.state, 'healthy') as health_state, h.circuit_opened_at,
        coalesce(h.p95_latency_ms, 0) as p95_latency_ms
       from xh_llm_route_pools p
       join xh_llm_route_pool_versions pv on pv.pool_id = p.id and pv.status = 'approved'
       join xh_llm_route_pool_publications pub on pub.pool_version_id = pv.id and pub.environment = $3 and pub.retired_at is null
       join xh_llm_route_entries e on e.pool_version_id = pv.id and e.enabled = true
       join xh_models m on m.id = e.model_id and m.enabled = true and m.capability = 'chat'
       join xh_providers pr on pr.id = e.provider_id and pr.enabled = true
       left join xh_llm_route_entry_health h on h.route_entry_id = e.id
       where p.role = $1 and p.scenario = $2 and p.enabled = true
       order by pv.version desc, e.priority asc, e.id asc`,
      [input.role, input.scenario, input.environment],
    );
    const first = result.rows[0];
    if (!first) return null;
    const versionId = String(first.pool_version_id);
    const policy = objectValue(first.policy_snapshot);
    return {
      poolId: String(first.pool_id),
      poolVersionId: versionId,
      policy,
      candidates: result.rows.filter((row) => String(row.pool_version_id) === versionId).map((row) => ({
        entryId: String(row.entry_id),
        providerId: String(row.provider_id),
        modelId: String(row.model_id),
        capability: String(row.model_capability_snapshot),
        capabilityTags: stringArray(row.capability_tags_snapshot),
        inputCapabilities: objectValue(row.model_input_capabilities_snapshot),
        mediaInputTransports: stringArray(row.media_input_transports_snapshot),
        priority: Number(row.priority),
        weight: Number(row.weight),
        state: effectiveRouteState(row, policy),
        estimatedCost: Number(row.estimated_cost || 0),
        p95LatencyMs: Number(row.p95_latency_ms || 0),
      })),
    };
  }

  async function recordDecision(input: {
    ownerId: string;
    agentRunId?: string;
    pool: PublishedLlmRoutePool;
    decisionKey: string;
    decision: LlmRoutingDecision;
  }) {
    const selected = input.pool.candidates.find((candidate) => candidate.entryId === input.decision.selectedEntryId);
    if (!selected) throw new Error("LLM_ROUTE_SELECTED_ENTRY_MISSING");
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `insert into xh_llm_route_decisions
        (id, owner_id, agent_run_id, pool_id, pool_version_id, role, scenario, decision_key,
         selected_entry_id, selected_provider_id, selected_model_id, candidate_snapshot, rejection_snapshot, reason)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14)
       on conflict (owner_id, decision_key) do nothing returning id`,
      [newId("llm_route_decision"), input.ownerId, input.agentRunId || null, input.pool.poolId, input.pool.poolVersionId,
        input.decision.role, input.decision.scenario, input.decisionKey, selected.entryId, selected.providerId, selected.modelId,
        JSON.stringify(input.pool.candidates), JSON.stringify(input.decision.rejected), input.decision.reason],
    );
    if (result.rows[0]) return String(result.rows[0].id);
    const replay = await pool.query(
      `select id, selected_entry_id from xh_llm_route_decisions where owner_id = $1 and decision_key = $2 limit 1`,
      [input.ownerId, input.decisionKey],
    );
    if (!replay.rows[0] || replay.rows[0].selected_entry_id !== selected.entryId) throw new Error("LLM_ROUTE_DECISION_IDEMPOTENCY_CONFLICT");
    return String(replay.rows[0].id);
  }

  async function recordOutcome(input: {
    entryId: string;
    outcome: "success" | "technical_failure" | "rate_limited" | "quality_failure";
    latencyMs: number;
    failureThreshold: number;
  }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const currentResult = await client.query(
        `select state, consecutive_technical_failures from xh_llm_route_entry_health where route_entry_id = $1 for update`,
        [input.entryId],
      );
      const current = (currentResult.rows[0]?.state || "healthy") as LlmRouteEntryState;
      const failures = Number(currentResult.rows[0]?.consecutive_technical_failures || 0);
      const state = nextLlmRouteState({ current, outcome: input.outcome, consecutiveTechnicalFailures: failures, failureThreshold: input.failureThreshold });
      const technicalIncrement = input.outcome === "technical_failure" || input.outcome === "rate_limited" ? 1 : 0;
      const qualityIncrement = input.outcome === "quality_failure" ? 1 : 0;
      await client.query(
        `insert into xh_llm_route_entry_health
          (route_entry_id, state, consecutive_technical_failures, success_count, technical_failure_count, quality_failure_count,
           p95_latency_ms, circuit_opened_at, last_success_at, last_failure_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, case when $2 = 'circuit_open' then now() else null end,
           case when $4 = 1 then now() else null end, case when $5 = 1 then now() else null end, now())
         on conflict (route_entry_id) do update set
           state = excluded.state,
           consecutive_technical_failures = case when $4 = 1 then 0 when $5 = 1 then xh_llm_route_entry_health.consecutive_technical_failures + 1 else xh_llm_route_entry_health.consecutive_technical_failures end,
           success_count = xh_llm_route_entry_health.success_count + $4,
           technical_failure_count = xh_llm_route_entry_health.technical_failure_count + $5,
           quality_failure_count = xh_llm_route_entry_health.quality_failure_count + $6,
           p95_latency_ms = $7,
           circuit_opened_at = case when excluded.state = 'circuit_open' then coalesce(xh_llm_route_entry_health.circuit_opened_at, now()) else null end,
           last_success_at = case when $4 = 1 then now() else xh_llm_route_entry_health.last_success_at end,
           last_failure_at = case when $5 = 1 then now() else xh_llm_route_entry_health.last_failure_at end,
           updated_at = now()`,
        [input.entryId, state, input.outcome === "success" ? 0 : failures + technicalIncrement, input.outcome === "success" ? 1 : 0, technicalIncrement, qualityIncrement, Math.max(0, Math.floor(input.latencyMs))],
      );
      return state;
    });
  }

  async function claimHalfOpenProbe(input: { entryId: string; leaseOwner: string; leaseMs: number }) {
    const pool = await deps.getPostgresPool();
    const leaseMs = Math.max(5_000, Math.min(1_800_000, Math.floor(input.leaseMs)));
    const result = await pool.query(
      `insert into xh_llm_route_entry_probe_leases (route_entry_id, lease_owner, lease_expires_at, updated_at)
       values ($1, $2, now() + ($3::bigint * interval '1 millisecond'), now())
       on conflict (route_entry_id) do update set lease_owner = excluded.lease_owner,
         lease_expires_at = excluded.lease_expires_at, updated_at = now()
       where xh_llm_route_entry_probe_leases.lease_expires_at < now()
          or xh_llm_route_entry_probe_leases.lease_owner = excluded.lease_owner
       returning route_entry_id`,
      [input.entryId, input.leaseOwner, leaseMs],
    );
    return Boolean(result.rows[0]);
  }

  async function releaseHalfOpenProbe(input: { entryId: string; leaseOwner: string }) {
    const pool = await deps.getPostgresPool();
    await pool.query(
      "delete from xh_llm_route_entry_probe_leases where route_entry_id = $1 and lease_owner = $2",
      [input.entryId, input.leaseOwner],
    );
  }

  return { readPublishedPool, recordDecision, recordOutcome, claimHalfOpenProbe, releaseHalfOpenProbe };
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

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function effectiveRouteState(row: Record<string, unknown>, policy: Record<string, unknown>): LlmRouteEntryState {
  const current = String(row.health_state || "healthy") as LlmRouteEntryState;
  const openedAt = row.circuit_opened_at ? new Date(String(row.circuit_opened_at)).getTime() : Number.NaN;
  const configuredCooldown = Number(policy.cooldownMs);
  const cooldownMs = Number.isFinite(configuredCooldown) ? Math.max(1_000, Math.min(86_400_000, configuredCooldown)) : 60_000;
  return Number.isFinite(openedAt) ? routeStateAfterCooldown({ current, openedAt, now: Date.now(), cooldownMs }) : current;
}
