import { randomUUID } from "node:crypto";
import {
  classifyGenerationFailure,
  routeLlmCandidates,
  type LlmRouteCandidate,
  type LlmRouteEntryState,
} from "@xinghuan/agent-core";
import type { PoolClient, QueryResultRow } from "pg";

import { parseCanvasRunPromptRewriteResult, planCanvasRunRecovery } from "./canvas-run-recovery-runtime.js";

export interface CanvasRunRecoveryStepRow extends QueryResultRow {
  id: string;
  run_id: string;
  owner_id: string;
  node_id: string;
  task_id: string | null;
  task_status?: string | null;
  task_result?: Record<string, unknown> | null;
  task_provider_id?: string | null;
  task_model_record_id?: string | null;
  budget_snapshot: Record<string, unknown>;
  configuration_snapshot: Record<string, unknown>;
  recovery_overrides?: Record<string, unknown>;
  recovery_context?: Record<string, unknown>;
}

export interface PromptRewriteRouteEntry {
  pool_id: string;
  pool_version_id: string;
  entry_id: string;
  provider_id: string;
  model_record_id: string;
}

export interface PromptRewriteRoutePlan {
  orderedRoutes: PromptRewriteRouteEntry[];
  rejected: Array<{ entryId: string; reason: string }>;
  reason: string;
}

type AppendEvent = (
  client: PoolClient,
  runId: string,
  stepId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
) => Promise<void>;

type FailStep = (
  client: PoolClient,
  step: CanvasRunRecoveryStepRow,
  error: Record<string, unknown>,
) => Promise<void>;

export async function findCanvasRunPromptRewriteRoute(
  client: PoolClient,
  runtimeEnvironment: string,
  decisionKey: string,
): Promise<PromptRewriteRoutePlan | null> {
  const environment = runtimeEnvironment === "production" ? "production" : "gray";
  const result = await client.query<PromptRewriteRouteEntry & {
    pool_version: number;
    model_capability_snapshot: string;
    capability_tags_snapshot: unknown;
    priority: number;
    weight: number;
    estimated_cost: string;
    health_state: string;
    p95_latency_ms: number;
  }>(
    `select p.id as pool_id, pv.id as pool_version_id, pv.version as pool_version,
       e.id as entry_id, e.provider_id, e.model_id as model_record_id,
       e.model_capability_snapshot, e.capability_tags_snapshot, e.priority, e.weight,
       e.estimated_cost::text, coalesce(h.state, 'healthy') as health_state,
       coalesce(h.p95_latency_ms, 0) as p95_latency_ms
     from xh_llm_route_pool_publications pub
     join xh_llm_route_pool_versions pv on pv.id = pub.pool_version_id
     join xh_llm_route_pools p on p.id = pv.pool_id
     join xh_llm_route_entries e on e.pool_version_id = pv.id
     join xh_models m on m.id = e.model_id
     join xh_providers provider on provider.id = e.provider_id
     left join xh_llm_route_entry_health h on h.route_entry_id = e.id
     where pub.environment = $1 and pub.retired_at is null
       and pv.status = 'approved' and p.enabled = true
       and p.role = 'recovery' and p.scenario = 'prompt-review-rewrite'
       and e.enabled = true and m.enabled = true and provider.enabled = true
       and e.model_capability_snapshot = 'chat'
     order by pv.version desc, e.priority asc, e.id asc`,
    [environment],
  );
  const first = result.rows[0];
  if (!first) return null;
  const rows = result.rows.filter((row) => row.pool_id === first.pool_id && row.pool_version_id === first.pool_version_id);
  const candidates: LlmRouteCandidate[] = rows.map((row) => ({
    entryId: row.entry_id,
    providerId: row.provider_id,
    modelId: row.model_record_id,
    capability: row.model_capability_snapshot,
    capabilityTags: strings(row.capability_tags_snapshot),
    priority: Number(row.priority || 0),
    weight: Number(row.weight || 1),
    state: routeState(row.health_state),
    estimatedCost: Number(row.estimated_cost || 0),
    p95LatencyMs: Number(row.p95_latency_ms || 0),
  }));
  try {
    const decision = routeLlmCandidates({
      role: "recovery",
      scenario: "prompt-review-rewrite",
      requiredCapabilityTags: [],
      decisionKey,
      candidates,
    });
    const byId = new Map(rows.map((row) => [row.entry_id, row]));
    return {
      orderedRoutes: decision.orderedEntryIds.map((entryId) => byId.get(entryId)).filter((row): row is typeof first => Boolean(row)),
      rejected: decision.rejected,
      reason: decision.reason,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("LLM_ROUTE_UNAVAILABLE:")) return null;
    throw error;
  }
}

export async function recordCanvasRunRecoveryDecision(
  client: PoolClient,
  step: CanvasRunRecoveryStepRow,
  recovery: ReturnType<typeof planCanvasRunRecovery>["recovery"],
  recoveryAttemptNo: number,
  approvalId = "",
) {
  const id = `recovery_decision_${randomUUID()}`;
  const idempotencyKey = `canvas-run:${step.run_id}:step:${step.id}:task:${step.task_id || "none"}:recovery`;
  const status = recovery.action === "request_approval" ? "proposed"
    : recovery.action === "stop" ? "stopped"
      : recovery.action === "rewrite_prompt_for_review" ? "approved"
        : "applied";
  const result = await client.query<{ id: string }>(
    `insert into xh_recovery_decisions
      (id, owner_id, canvas_run_id, run_step_id, task_attempt_id,
       failure_category, action_type,
       current_generation_provider_id_snapshot, current_generation_model_id_snapshot,
       alternative_generation_provider_id_snapshot, alternative_generation_model_id_snapshot,
       parameter_patch, budget_snapshot, reason, approval_id, status, idempotency_key,
       recovery_attempt_no)
     values ($1, $2, $3, $4,
       (select id from xh_task_attempts where task_id = $5 and run_step_id = $4 limit 1),
       $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16, $17, $18)
     on conflict (owner_id, idempotency_key) do nothing returning id`,
    [
      id,
      step.owner_id,
      step.run_id,
      step.id,
      step.task_id,
      recovery.failureCategory,
      recovery.action,
      step.task_provider_id || null,
      step.task_model_record_id || null,
      recovery.alternative?.providerId || null,
      recovery.alternative?.modelRecordId || null,
      JSON.stringify(recovery.parameterPatch || {}),
      JSON.stringify({ ...object(step.budget_snapshot), ...object(step.configuration_snapshot) }),
      recovery.reason,
      approvalId || null,
      status,
      idempotencyKey,
      recoveryAttemptNo,
    ],
  );
  if (result.rows[0]) return result.rows[0].id;
  const replay = await client.query<{ id: string; action_type: string }>(
    `select id, action_type from xh_recovery_decisions where owner_id = $1 and idempotency_key = $2 limit 1`,
    [step.owner_id, idempotencyKey],
  );
  if (!replay.rows[0] || replay.rows[0].action_type !== recovery.action) {
    throw new Error("RECOVERY_DECISION_IDEMPOTENCY_CONFLICT");
  }
  return replay.rows[0].id;
}

export async function scheduleCanvasRunPromptRewriteTask(
  client: PoolClient,
  step: CanvasRunRecoveryStepRow,
  decisionId: string,
  originalPrompt: string,
  routePlan: PromptRewriteRoutePlan,
  rewriteAttemptNo: number,
  appendEvent: AppendEvent,
  routeIndex = 0,
) {
  const route = routePlan.orderedRoutes[routeIndex];
  if (!route) throw new Error("CANVAS_RUN_PROMPT_REWRITE_ROUTE_EXHAUSTED");
  const taskId = `task-${randomUUID()}`;
  const routeDecisionId = `llm_route_decision_${randomUUID()}`;
  const routeDecisionKey = `${decisionId}:prompt-rewrite-route:${routeIndex + 1}`;
  await client.query(
    `insert into xh_llm_route_decisions
      (id, owner_id, pool_id, pool_version_id, role, scenario, decision_key,
       selected_entry_id, selected_provider_id, selected_model_id,
       candidate_snapshot, rejection_snapshot, reason)
     values ($1, $2, $3, $4, 'recovery', 'prompt-review-rewrite', $5,
       $6, $7, $8, $9::jsonb, $10::jsonb, $11)
     on conflict (owner_id, decision_key) do nothing`,
    [routeDecisionId, step.owner_id, route.pool_id, route.pool_version_id, routeDecisionKey,
      route.entry_id, route.provider_id, route.model_record_id,
      JSON.stringify(routePlan.orderedRoutes.map((item) => ({ entryId: item.entry_id, providerId: item.provider_id, modelRecordId: item.model_record_id }))),
      JSON.stringify(routePlan.rejected), routePlan.reason],
  );
  const evidence = {
    failureCategory: text(object(step.task_result).failureCategory),
    failureReason: text(object(step.task_result).failureReason).slice(0, 500),
    providerDiagnostic: text(object(step.task_result).providerDiagnostic).slice(0, 500),
  };
  const messages = [
    {
      role: "system",
      content: "Rewrite only the unsafe portions of the supplied generation prompt while preserving subject, composition, style, constraints and intended result. Return strict JSON: {\"rewrittenPrompt\":\"...\",\"changes\":[{\"before\":\"...\",\"after\":\"...\",\"reason\":\"...\"}]}. Do not add commentary.",
    },
    { role: "user", content: JSON.stringify({ originalPrompt, moderationEvidence: evidence }) },
  ];
  await client.query(
    `insert into xh_tasks
      (id, owner_id, title, status, provider_id, model_id, payload, result, logs, created_at, updated_at)
     values ($1, $2, $3, 'queued', $4, $5, $6::jsonb, '{}'::jsonb, $7::jsonb, now(), now())`,
    [taskId, step.owner_id, `Canvas Run prompt review rewrite - ${step.node_id}`, route.provider_id, route.model_record_id,
      JSON.stringify({ taskCapability: "chat", executionMode: "worker_queue", messages, temperature: 0.2, maxTokens: 2_000,
        sourceNodeId: step.node_id, canvasRunId: step.run_id, canvasRunStepId: step.id, recoveryDecisionId: decisionId }),
      JSON.stringify(["Canvas Run Recovery created a governed prompt rewrite task"])],
  );
  await client.query(
    `update xh_recovery_decisions
     set input_before_snapshot = $2::jsonb, recovery_attempt_no = $3, updated_at = now()
     where id = $1 and owner_id = $4`,
    [decisionId, JSON.stringify({ prompt: originalPrompt }), rewriteAttemptNo, step.owner_id],
  );
  await client.query(
    `update xh_canvas_run_steps
     set status = 'queued', task_id = $2, dispatch_enqueued_at = null,
         lease_owner = null, lease_expires_at = null,
         recovery_context = $3::jsonb,
         error = $4::jsonb, updated_at = now()
     where id = $1`,
    [step.id, taskId, JSON.stringify({
      kind: "prompt_review_rewrite",
      decisionId,
      originalPrompt,
      originalTaskId: text(object(step.recovery_context).originalTaskId) || step.task_id,
      rewriteAttemptNo,
      routeIndex,
      routePlan,
    }),
      JSON.stringify({ decisionId, action: "rewrite_prompt_for_review" })],
  );
  await appendEvent(client, step.run_id, step.id, "canvas_run.prompt_rewrite_started", {
    decisionId,
    rewriteTaskId: taskId,
    rewriteAttemptNo,
    routeAttemptNo: routeIndex + 1,
    routeEntryId: route.entry_id,
  });
}

export async function settleCanvasRunPromptRewriteTask(
  client: PoolClient,
  step: CanvasRunRecoveryStepRow & { recovery_context?: Record<string, unknown> },
  appendEvent: AppendEvent,
  failStep: FailStep,
) {
  const context = object(step.recovery_context);
  const decisionId = text(context.decisionId);
  if (step.task_status !== "succeeded") {
    const routePlan = promptRewriteRoutePlan(context.routePlan);
    const routeIndex = integer(context.routeIndex, 0);
    if (isTechnicalRewriteFailure(step.task_result) && routePlan.orderedRoutes[routeIndex + 1]) {
      await scheduleCanvasRunPromptRewriteTask(
        client,
        step,
        decisionId,
        text(context.originalPrompt),
        routePlan,
        integer(context.rewriteAttemptNo, 1),
        appendEvent,
        routeIndex + 1,
      );
      return;
    }
    await markRewriteDecisionFailed(client, decisionId, step.owner_id);
    await failStep(client, step, {
      code: "CANVAS_RUN_PROMPT_REWRITE_FAILED",
      decisionId,
      rewriteTaskId: step.task_id,
      result: step.task_result || {},
    });
    return;
  }
  const originalPrompt = text(context.originalPrompt);
  const rewrite = parseCanvasRunPromptRewriteResult(step.task_result, originalPrompt);
  if (!rewrite) {
    await markRewriteDecisionFailed(client, decisionId, step.owner_id);
    await failStep(client, step, { code: "CANVAS_RUN_PROMPT_REWRITE_INVALID", decisionId, rewriteTaskId: step.task_id });
    return;
  }
  const overrides = mergeCanvasRunRecoveryRuntimePatch(step.recovery_overrides, { executionPayload: { prompt: rewrite.prompt } });
  await client.query(
    `update xh_recovery_decisions
     set status = 'applied', input_before_snapshot = $2::jsonb, input_after_snapshot = $3::jsonb,
         diff_snapshot = $4::jsonb, applied_at = now(), updated_at = now()
     where id = $1 and owner_id = $5`,
    [decisionId, JSON.stringify({ prompt: originalPrompt }), JSON.stringify({ prompt: rewrite.prompt }), JSON.stringify(rewrite.changes), step.owner_id],
  );
  await client.query(
    `update xh_canvas_run_steps
     set status = 'retry_wait', task_id = null, dispatch_enqueued_at = null,
         retry_not_before = now(), recovery_overrides = $2::jsonb, recovery_context = '{}'::jsonb,
         lease_owner = null, lease_expires_at = null,
         error = $3::jsonb, updated_at = now() where id = $1`,
    [step.id, JSON.stringify(overrides), JSON.stringify({ decisionId, action: "rewrite_prompt_for_review" })],
  );
  await appendEvent(client, step.run_id, step.id, "canvas_run.prompt_rewrite_applied", {
    decisionId,
    rewriteTaskId: step.task_id,
    beforeLength: originalPrompt.length,
    afterLength: rewrite.prompt.length,
    changeCount: rewrite.changes.length,
  });
}

export async function settleCanvasRunTaskAttempt(
  client: PoolClient,
  taskId: string | null,
  status: "succeeded" | "failed" | "cancelled",
) {
  if (!taskId) return;
  await client.query(
    `update xh_task_attempts
     set status = $2, updated_at = now(), finalized_at = coalesce(finalized_at, now())
     where task_id = $1 and status in ('queued', 'running')`,
    [taskId, status],
  );
}

export function mergeCanvasRunRecoveryRuntimePatch(existingValue: unknown, patchValue: unknown) {
  const existing = object(existingValue);
  const patch = object(patchValue);
  return {
    ...existing,
    ...patch,
    generationModel: { ...object(existing.generationModel), ...object(patch.generationModel) },
    executionPayload: { ...object(existing.executionPayload), ...object(patch.executionPayload) },
  };
}

async function markRewriteDecisionFailed(client: PoolClient, decisionId: string, ownerId: string) {
  await client.query(
    `update xh_recovery_decisions set status = 'failed', updated_at = now() where id = $1 and owner_id = $2`,
    [decisionId, ownerId],
  );
}

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function integer(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function routeState(value: unknown): LlmRouteEntryState {
  const state = text(value) as LlmRouteEntryState;
  return ["healthy", "degraded", "rate_limited", "unavailable", "circuit_open", "half_open", "draining", "disabled"].includes(state)
    ? state
    : "healthy";
}

function promptRewriteRoutePlan(value: unknown): PromptRewriteRoutePlan {
  const plan = object(value);
  return {
    orderedRoutes: Array.isArray(plan.orderedRoutes) ? plan.orderedRoutes.map(object).map((route) => ({
      pool_id: text(route.pool_id),
      pool_version_id: text(route.pool_version_id),
      entry_id: text(route.entry_id),
      provider_id: text(route.provider_id),
      model_record_id: text(route.model_record_id),
    })).filter((route) => route.entry_id && route.provider_id && route.model_record_id) : [],
    rejected: Array.isArray(plan.rejected) ? plan.rejected.map(object).map((item) => ({ entryId: text(item.entryId), reason: text(item.reason) })) : [],
    reason: text(plan.reason),
  };
}

function isTechnicalRewriteFailure(resultValue: unknown) {
  const result = object(resultValue);
  const category = classifyGenerationFailure({
    statusCode: integer(result.upstreamHttpStatus, 0) || undefined,
    code: text(result.code || result.failureCategory),
    message: [result.failureReason, result.providerDiagnostic, result.error].map(text).filter(Boolean).join(" "),
  });
  return ["transient", "provider", "capability", "unknown"].includes(category);
}
