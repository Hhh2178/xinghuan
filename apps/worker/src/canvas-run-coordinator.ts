import { randomUUID } from 'node:crypto';
import { CANVAS_RUN_NATIVE_NODE_TYPES, executeDeterministicNode, NATIVE_DETERMINISTIC_NODE_TYPES } from '@xinghuan/agent-core';
import { taskQueueNameForCapability } from '@xinghuan/shared';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { RedisClientType } from 'redis';
import { qualityContextForCompletedStep } from './canvas-run-quality-coordinator.js';
import { advanceCanvasRunDispatchCursor, CANVAS_RUN_DISPATCH_SCOPES, lockCanvasRunDispatchCursor } from './canvas-run-dispatch-fairness.js';

const TERMINAL_STEP = new Set(['succeeded', 'failed', 'cancelled', 'skipped']);

interface StepRow extends QueryResultRow {
  id: string;
  run_id: string;
  owner_id: string;
  node_id: string;
  node_type: string;
  status: string;
  attempt_count: number;
  task_id: string | null;
  task_status?: string | null;
  task_result?: Record<string, unknown> | null;
  plan_snapshot: Record<string, unknown>;
  budget_snapshot: Record<string, unknown>;
  input_binding: Record<string, unknown>;
  dispatch_enqueued_at?: Date | null;
  run_created_at?: Date;
}

export function createCanvasRunCoordinator(options: {
  pool: Pool;
  redis: RedisClientType;
  workerId: string;
  environment: string;
  queueName: string;
  enabled: boolean;
  pollIntervalMs?: number;
  leaseMs?: number;
}) {
  const pollIntervalMs = Math.max(250, options.pollIntervalMs || 1_000);
  const leaseMs = Math.max(5_000, options.leaseMs || 30_000);
  let stopping = false;

  async function run() {
    if (!options.enabled) return;
    while (!stopping) {
      const enabled = await runtimeEnabled(options.pool, options.environment);
      if (enabled) {
        await resumeApprovalDecisions();
        await settleCompletedTasks();
        await enqueuePendingDispatches();
        await claimReadyStep();
      }
      await wait(pollIntervalMs);
    }
  }

  function stop() {
    stopping = true;
  }

  async function settleCompletedTasks() {
    const result = await options.pool.query<StepRow>(
      `select s.*, r.owner_id, r.plan_snapshot, r.budget_snapshot, t.status as task_status, t.result as task_result
       from xh_canvas_run_steps s
       join xh_canvas_runs r on r.id = s.run_id
       join xh_tasks t on t.id = s.task_id
       where r.status in ('queued', 'running')
         and s.status in ('queued', 'running')
         and t.status in ('succeeded', 'failed', 'cancelled')
       order by s.updated_at asc
       limit 25`,
    );
    for (const step of result.rows) await settleStep(step);
  }

  async function settleStep(step: StepRow) {
    const client = await options.pool.connect();
    try {
      await client.query('begin');
      const locked = await client.query<StepRow>(
        `select s.*, r.owner_id, r.plan_snapshot, r.budget_snapshot, t.status as task_status, t.result as task_result
         from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id join xh_tasks t on t.id = s.task_id
         where s.id = $1 for update of s, r`,
        [step.id],
      );
      const current = locked.rows[0];
      if (!current || !['queued', 'running'].includes(current.status)) {
        await client.query('rollback');
        return;
      }
      if (current.task_status === 'succeeded') {
        const qualityContext = await qualityEvaluationRuntimeEnabled(client, options.environment)
          ? qualityContextForCompletedStep({
            nodeType: current.node_type,
            nodeId: current.node_id,
            planSnapshot: current.plan_snapshot,
            taskResult: current.task_result || {},
          })
          : null;
        if (qualityContext) {
          await client.query(
            `update xh_canvas_run_steps set status = 'evaluating', output_binding = $2::jsonb,
               quality_context = $3::jsonb, quality_task_id = null, quality_dispatch_enqueued_at = null,
               lease_owner = null, lease_expires_at = null, updated_at = now() where id = $1`,
            [current.id, JSON.stringify(current.task_result || {}), JSON.stringify(qualityContext)],
          );
          await appendEvent(client, current.run_id, current.id, 'canvas_run.quality_evaluation_started', {
            taskId: current.task_id,
            artifactCount: qualityContext.artifactIds.length,
            mediaKind: qualityContext.mediaKind,
          });
        } else {
          await client.query(
            `update xh_canvas_run_steps set status = 'succeeded', output_binding = $2::jsonb,
               lease_owner = null, lease_expires_at = null, updated_at = now(), finalized_at = now() where id = $1`,
            [current.id, JSON.stringify(current.task_result || {})],
          );
          await appendEvent(client, current.run_id, current.id, 'canvas_run.step_succeeded', { taskId: current.task_id });
          await unlockDependents(client, current.run_id);
          await finalizeRunIfComplete(client, current.run_id);
        }
      } else if (current.task_status === 'failed') {
        const retry = recoveryChoice(current);
        if (retry.retry) {
          await client.query(
            `update xh_canvas_run_steps set status = 'ready', task_id = null, dispatch_enqueued_at = null,
               lease_owner = null, lease_expires_at = null, error = $2::jsonb, updated_at = now() where id = $1`,
            [current.id, JSON.stringify({ previousTaskId: current.task_id, strategy: retry.strategy })],
          );
          await appendEvent(client, current.run_id, current.id, 'canvas_run.step_retry_scheduled', retry);
        } else if (retry.strategy === 'approval_required') {
          const approvalId = `agent_approval_${randomUUID()}`;
          await client.query(
            `insert into xh_agent_approvals
              (id, owner_id, canvas_run_id, run_step_id, action_type, action_snapshot, status, requested_by)
             values ($1, $2, $3, $4, 'switch_generation_model', $5::jsonb, 'pending', 'canvas-run-worker')`,
            [approvalId, current.owner_id, current.run_id, current.id, JSON.stringify(retry.alternative || {})],
          );
          await client.query(
            `update xh_canvas_run_steps set status = 'awaiting_approval', lease_owner = null, lease_expires_at = null,
               error = $2::jsonb, updated_at = now() where id = $1`,
            [current.id, JSON.stringify({ previousTaskId: current.task_id, approvalId })],
          );
          await client.query(`update xh_canvas_runs set status = 'awaiting_approval', updated_at = now() where id = $1`, [current.run_id]);
          await appendEvent(client, current.run_id, current.id, 'canvas_run.step_approval_requested', { approvalId, actionType: 'switch_generation_model' });
        } else {
          await client.query(
            `update xh_canvas_run_steps set status = 'failed', lease_owner = null, lease_expires_at = null,
               error = $2::jsonb, updated_at = now(), finalized_at = now() where id = $1`,
            [current.id, JSON.stringify({ taskId: current.task_id, result: current.task_result || {} })],
          );
          await client.query(`update xh_canvas_runs set status = 'failed', updated_at = now(), finalized_at = now() where id = $1`, [current.run_id]);
          await appendEvent(client, current.run_id, current.id, 'canvas_run.step_failed', { taskId: current.task_id });
          await appendEvent(client, current.run_id, null, 'canvas_run.failed', { stepId: current.id });
        }
      } else {
        await client.query(
          `update xh_canvas_run_steps set status = 'cancelled', lease_owner = null, lease_expires_at = null,
             updated_at = now(), finalized_at = now() where id = $1`,
          [current.id],
        );
        await appendEvent(client, current.run_id, current.id, 'canvas_run.step_cancelled', { taskId: current.task_id });
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async function claimReadyStep() {
    const client = await options.pool.connect();
    let dispatch: { taskId: string; capability: string } | null = null;
    try {
      await client.query('begin');
      const lastOwnerId = await lockCanvasRunDispatchCursor(client, CANVAS_RUN_DISPATCH_SCOPES.generation);
      const result = await client.query<StepRow>(
        `with ready_owners as (
           select r.owner_id
           from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id
           where r.status in ('queued', 'running') and s.status = 'ready'
             and (s.lease_expires_at is null or s.lease_expires_at < now())
           group by r.owner_id
         ), next_owner as (
           select owner_id from ready_owners
           order by case when owner_id > $1 then 0 else 1 end, owner_id
           limit 1
         )
         select s.*, r.owner_id, r.plan_snapshot, r.budget_snapshot, r.created_at as run_created_at
         from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id
         join next_owner on next_owner.owner_id = r.owner_id
         where r.status in ('queued', 'running') and s.status = 'ready'
           and (s.lease_expires_at is null or s.lease_expires_at < now())
         order by r.updated_at asc, s.sequence asc
         for update of s skip locked limit 1`,
        [lastOwnerId],
      );
      const step = result.rows[0];
      if (!step) {
        await client.query('rollback');
        return;
      }
      await advanceCanvasRunDispatchCursor(client, CANVAS_RUN_DISPATCH_SCOPES.generation, step.owner_id);
      if (!CANVAS_RUN_NATIVE_NODE_TYPES.has(step.node_type)) {
        await client.query(`update xh_canvas_run_steps set status = 'failed', error = $2::jsonb, finalized_at = now(), updated_at = now() where id = $1`, [step.id, JSON.stringify({ code: 'CANVAS_RUN_NODE_NOT_NATIVE', nodeType: step.node_type })]);
        await client.query(`update xh_canvas_runs set status = 'failed', finalized_at = now(), updated_at = now() where id = $1`, [step.run_id]);
        await appendEvent(client, step.run_id, step.id, 'canvas_run.step_unsupported', { nodeType: step.node_type });
        await client.query('commit');
        return;
      }
      const budgetError = await readBudgetError(client, step);
      if (budgetError) {
        await client.query(`update xh_canvas_run_steps set status = 'failed', error = $2::jsonb, finalized_at = now(), updated_at = now() where id = $1`, [step.id, JSON.stringify({ code: budgetError })]);
        await client.query(`update xh_canvas_runs set status = 'failed', finalized_at = now(), updated_at = now() where id = $1`, [step.run_id]);
        await appendEvent(client, step.run_id, step.id, 'canvas_run.budget_exceeded', { code: budgetError });
        await client.query('commit');
        return;
      }
      if (NATIVE_DETERMINISTIC_NODE_TYPES.has(step.node_type)) {
        try {
          const output = await buildDeterministicOutput(client, step);
          await client.query(
            `update xh_canvas_run_steps set status = 'succeeded', output_binding = $2::jsonb,
               lease_owner = null, lease_expires_at = null, updated_at = now(), finalized_at = now() where id = $1`,
            [step.id, JSON.stringify(output)],
          );
          await client.query(`update xh_canvas_runs set status = 'running', started_at = coalesce(started_at, now()), updated_at = now() where id = $1 and status = 'queued'`, [step.run_id]);
          await appendEvent(client, step.run_id, step.id, 'canvas_run.step_succeeded', { nodeType: step.node_type, deterministic: true });
          await unlockDependents(client, step.run_id);
          await finalizeRunIfComplete(client, step.run_id);
        } catch (error) {
          const code = error instanceof Error ? error.message : 'CANVAS_RUN_DETERMINISTIC_NODE_FAILED';
          await client.query(`update xh_canvas_run_steps set status = 'failed', error = $2::jsonb, finalized_at = now(), updated_at = now() where id = $1`, [step.id, JSON.stringify({ code, nodeType: step.node_type })]);
          await client.query(`update xh_canvas_runs set status = 'failed', finalized_at = now(), updated_at = now() where id = $1`, [step.run_id]);
          await appendEvent(client, step.run_id, step.id, 'canvas_run.step_failed', { code, nodeType: step.node_type, deterministic: true });
          await appendEvent(client, step.run_id, null, 'canvas_run.failed', { stepId: step.id, code });
        }
        await client.query('commit');
        return;
      }
      const taskInput = step.node_type === 'runninghub'
        ? await buildRunningHubTaskInput(client, step)
        : await buildTaskInput(client, step);
      const isRunningHubTask = 'runningHub' in taskInput && taskInput.runningHub === true;
      const resolvedModel = isRunningHubTask
        ? { modelRecordId: '', providerId: taskInput.providerId }
        : await resolveEnabledModel(client, taskInput.providerId, taskInput.modelRecordId, taskInput.capability);
      if (!resolvedModel) {
        await client.query(`update xh_canvas_run_steps set status = 'failed', error = $2::jsonb, finalized_at = now(), updated_at = now() where id = $1`, [step.id, JSON.stringify({ code: 'CANVAS_RUN_MODEL_UNAVAILABLE', modelRecordId: taskInput.modelRecordId })]);
        await client.query(`update xh_canvas_runs set status = 'failed', finalized_at = now(), updated_at = now() where id = $1`, [step.run_id]);
        await appendEvent(client, step.run_id, step.id, 'canvas_run.step_model_unavailable', { modelRecordId: taskInput.modelRecordId, capability: taskInput.capability });
        await client.query('commit');
        return;
      }
      const taskId = `task-${randomUUID()}`;
      await client.query(
        `insert into xh_tasks (id, owner_id, title, status, provider_id, model_id, payload, result, logs, created_at, updated_at)
         values ($1, $2, $3, 'queued', $4, $5, $6::jsonb, '{}'::jsonb, $7::jsonb, now(), now())`,
        [taskId, step.owner_id, `Canvas Run · ${step.node_type} · ${step.node_id}`, resolvedModel.providerId, resolvedModel.modelRecordId || null, JSON.stringify(taskInput.payload), JSON.stringify(['Canvas Run Worker 已创建任务'])],
      );
      await client.query(
        `update xh_canvas_run_steps set status = 'queued', task_id = $2, attempt_count = attempt_count + 1,
           lease_owner = $3, lease_expires_at = now() + ($4::bigint * interval '1 millisecond'),
           dispatch_enqueued_at = null, started_at = coalesce(started_at, now()), updated_at = now() where id = $1`,
        [step.id, taskId, options.workerId, leaseMs],
      );
      await client.query(`update xh_canvas_runs set status = 'running', started_at = coalesce(started_at, now()), updated_at = now() where id = $1 and status = 'queued'`, [step.run_id]);
      await appendEvent(client, step.run_id, step.id, 'canvas_run.step_dispatched', { taskId, attempt: Number(step.attempt_count) + 1, capability: taskInput.capability });
      await client.query('commit');
      dispatch = { taskId, capability: taskInput.capability };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    if (dispatch) await enqueueTask(dispatch.taskId, dispatch.capability);
  }

  async function resumeApprovalDecisions() {
    const result = await options.pool.query<{ approval_id: string; run_id: string; step_id: string; status: string }>(
      `select a.id as approval_id, a.canvas_run_id as run_id, a.run_step_id as step_id, a.status
       from xh_agent_approvals a join xh_canvas_run_steps s on s.id = a.run_step_id
       where s.status = 'awaiting_approval' and a.status in ('approved', 'rejected', 'expired', 'cancelled')
       order by a.updated_at asc limit 25`,
    );
    for (const decision of result.rows) {
      const client = await options.pool.connect();
      try {
        await client.query('begin');
        const locked = await client.query<{ status: string }>(`select status from xh_canvas_run_steps where id = $1 for update`, [decision.step_id]);
        if (locked.rows[0]?.status !== 'awaiting_approval') {
          await client.query('rollback');
          continue;
        }
        if (decision.status === 'approved') {
          await client.query(`update xh_canvas_run_steps set status = 'ready', task_id = null, dispatch_enqueued_at = null, error = '{}'::jsonb, updated_at = now() where id = $1`, [decision.step_id]);
          await client.query(`update xh_canvas_runs set status = 'running', updated_at = now() where id = $1 and status = 'awaiting_approval'`, [decision.run_id]);
          await appendEvent(client, decision.run_id, decision.step_id, 'canvas_run.step_approval_applied', { approvalId: decision.approval_id });
        } else {
          await client.query(`update xh_canvas_run_steps set status = 'failed', finalized_at = now(), updated_at = now() where id = $1`, [decision.step_id]);
          await client.query(`update xh_canvas_runs set status = 'failed', finalized_at = now(), updated_at = now() where id = $1`, [decision.run_id]);
          await appendEvent(client, decision.run_id, decision.step_id, 'canvas_run.step_approval_declined', { approvalId: decision.approval_id, status: decision.status });
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  }

  async function enqueuePendingDispatches() {
    const result = await options.pool.query<{ step_id: string; task_id: string; capability: string }>(
      `select s.id as step_id, t.id as task_id,
         coalesce(t.payload->>'taskCapability', case when s.node_type = 'llm' then 'chat' else s.node_type end) as capability
       from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id join xh_tasks t on t.id = s.task_id
       where r.status in ('queued', 'running') and s.status = 'queued' and t.status = 'queued'
         and s.dispatch_enqueued_at is null
       order by s.updated_at asc limit 50`,
    );
    for (const row of result.rows) await enqueueTask(row.task_id, row.capability, row.step_id);
  }

  async function enqueueTask(taskId: string, capability: string, stepId?: string) {
    await options.redis.lPush(taskQueueNameForCapability(options.queueName, capability as never), taskId);
    await options.pool.query(`update xh_canvas_run_steps set dispatch_enqueued_at = now(), updated_at = now() where ${stepId ? 'id = $1' : 'task_id = $1'}`, [stepId || taskId]);
  }

  return { run, stop, tick: async () => { await resumeApprovalDecisions(); await settleCompletedTasks(); await enqueuePendingDispatches(); await claimReadyStep(); } };
}

async function runtimeEnabled(pool: Pool, environment: string) {
  if (environment === 'local' || environment === 'test') return true;
  const result = await pool.query(`select canvas_runs_enabled from xh_agent_runtime_controls where environment = $1 limit 1`, [environment]);
  return result.rows[0]?.canvas_runs_enabled === true;
}

async function qualityEvaluationRuntimeEnabled(client: PoolClient, environment: string) {
  if (environment === 'local' || environment === 'test') return true;
  const result = await client.query(`select quality_evaluation_enabled from xh_agent_runtime_controls where environment = $1 limit 1`, [environment]);
  return result.rows[0]?.quality_evaluation_enabled === true;
}

async function buildTaskInput(client: PoolClient, step: StepRow) {
  const planStep = planSteps(step.plan_snapshot).find((item) => item.id === step.step_key || item.nodeId === step.node_id) || {};
  const configuration = object(planStep.configuration);
  const primary = {
    providerId: text(configuration.providerId),
    modelRecordId: text(configuration.modelRecordId),
    modelId: text(configuration.modelId),
  };
  const budget = object(step.budget_snapshot);
  const retries = integer(budget.maxAttemptsPerStep, 3);
  const alternatives = Array.isArray(configuration.generationAlternatives) ? configuration.generationAlternatives.map(object) : [];
  const alternativeIndex = Math.max(0, Number(step.attempt_count) - retries);
  const selected = Number(step.attempt_count) >= retries ? alternatives[alternativeIndex] || primary : primary;
  const payload = { ...object(configuration.executionPayload), ...object(step.input_binding) };
  const upstream = await client.query<{ output_binding: Record<string, unknown> }>(
    `select d.output_binding from xh_canvas_run_steps d, jsonb_array_elements_text($2::jsonb) dep
     where d.run_id = $1 and d.node_id = dep order by d.sequence`,
    [step.run_id, JSON.stringify(step.depends_on || [])],
  );
  mergeUpstreamPayload(payload, upstream.rows.map((row) => object(row.output_binding)));
  const capability = text(configuration.taskCapability) || (step.node_type === 'llm' ? 'chat' : step.node_type);
  return {
    providerId: text(selected.providerId) || primary.providerId,
    modelRecordId: text(selected.modelRecordId) || primary.modelRecordId,
    payload: { ...payload, providerModel: text(selected.modelId) || primary.modelId, taskCapability: capability, executionMode: 'worker_queue', sourceNodeId: step.node_id, canvasRunId: step.run_id, canvasRunStepId: step.id },
    capability,
  };
}

/**
 * Reconstructs a RunningHub task from the immutable plan and the live admin
 * catalog. Browser state and arbitrary URLs are never execution authority.
 */
export async function buildRunningHubTaskInput(client: PoolClient, step: StepRow) {
  const planStep = planSteps(step.plan_snapshot).find((item) => item.id === step.step_key || item.nodeId === step.node_id) || {};
  const runningHub = object(object(planStep.configuration).runningHub);
  const catalogRef = parseRunningHubCatalogId(text(runningHub.catalogId));
  if (!catalogRef) throw new Error('CANVAS_RUN_RUNNINGHUB_CATALOG_INVALID');
  const targetType = runningHub.targetType === 'app' ? 'app' : 'workflow';
  if (catalogRef.kind !== targetType) throw new Error('CANVAS_RUN_RUNNINGHUB_TARGET_TYPE_MISMATCH');
  const providerResult = await client.query<Record<string, unknown>>(
    `select id, name, base_url, enabled, protocol, rh_apps, rh_workflows
     from xh_providers where id = $1 and enabled = true and lower(protocol) = 'runninghub' limit 1`,
    [catalogRef.providerId],
  );
  const provider = providerResult.rows[0];
  if (!provider) throw new Error('CANVAS_RUN_RUNNINGHUB_PROVIDER_UNAVAILABLE');
  const catalogEntries = Array.isArray(provider[targetType === 'app' ? 'rh_apps' : 'rh_workflows'])
    ? provider[targetType === 'app' ? 'rh_apps' : 'rh_workflows'] as unknown[]
    : [];
  const catalog = catalogEntries.map(object).find((entry) => text(entry.id) === catalogRef.itemId && entry.enabled !== false);
  if (!catalog) throw new Error('CANVAS_RUN_RUNNINGHUB_CATALOG_UNAVAILABLE');
  const expectedTarget = text(catalog.runTargetId || (targetType === 'app' ? catalog.appId : catalog.workflowId) || catalog.id);
  if (!expectedTarget || expectedTarget !== text(runningHub.runTargetId)) throw new Error('CANVAS_RUN_RUNNINGHUB_TARGET_MISMATCH');
  const catalogFields = Array.isArray(catalog.fields) ? catalog.fields.map(object) : [];
  const snapshotFields = Array.isArray(runningHub.fields) ? runningHub.fields.map(object) : [];
  const declared = new Map<string, Record<string, unknown>>();
  for (const field of catalogFields) {
    const key = runningHubFieldKey(field);
    if (key) declared.set(key, field);
  }
  for (const field of snapshotFields) {
    const key = runningHubFieldKey(field);
    const live = declared.get(key);
    if (!key || !live || text(live.valueType || live.fieldType) !== text(field.valueType)) {
      throw new Error('CANVAS_RUN_RUNNINGHUB_FIELD_CONTRACT_MISMATCH');
    }
  }
  const upstream = await client.query<{ output_binding: Record<string, unknown> }>(
    `select d.output_binding from xh_canvas_run_steps d, jsonb_array_elements_text($2::jsonb) dep
     where d.run_id = $1 and d.node_id = dep order by d.sequence`,
    [step.run_id, JSON.stringify(step.depends_on || [])],
  );
  const upstreamPayload: Record<string, unknown> = {};
  mergeUpstreamPayload(upstreamPayload, upstream.rows.map((row) => object(row.output_binding)));
  const values = object(runningHub.values);
  const nodeInfoList = catalogFields.map((field) => {
    const key = runningHubFieldKey(field);
    const fieldType = text(field.valueType || field.fieldType).toLowerCase();
    const mediaValue = fieldType.includes('image') ? firstArrayValue(upstreamPayload.images)
      : fieldType.includes('video') ? firstArrayValue(upstreamPayload.videos)
        : fieldType.includes('audio') ? firstArrayValue(upstreamPayload.audios)
          : '';
    const raw = mediaValue || runningHubScalar(values[key]) || runningHubScalar(field.fieldValue) || runningHubScalar(field.defaultValue);
    if (field.required === true && (raw === '' || raw === undefined)) throw new Error('CANVAS_RUN_RUNNINGHUB_REQUIRED_INPUT_MISSING');
    const options = Array.isArray(field.options) ? field.options : [];
    if (options.length > 0 && raw !== '' && raw !== undefined && !options.some((option) => String(option) === String(raw))) {
      throw new Error('CANVAS_RUN_RUNNINGHUB_FIELD_VALUE_INVALID');
    }
    return { nodeId: text(field.nodeId), fieldName: text(field.fieldName), fieldValue: raw ?? '' };
  });
  const taskCapability = ['image', 'video', 'audio', 'chat'].includes(text(catalog.taskCapability)) ? text(catalog.taskCapability) : 'video';
  return {
    providerId: text(provider.id),
    modelRecordId: '',
    capability: taskCapability,
    runningHub: true,
    payload: {
      taskCapability,
      executionMode: 'worker_queue',
      targetType,
      rhCatalogId: text(runningHub.catalogId),
      rhCatalogTitle: text(catalog.title),
      rhCatalogKind: targetType,
      pageId: text(runningHub.pageId || catalog.pageId || expectedTarget),
      webappId: targetType === 'app' ? text(runningHub.webappId || catalog.appId || expectedTarget) : '',
      workflowId: targetType === 'workflow' ? text(runningHub.workflowId || catalog.workflowId || expectedTarget) : '',
      runTargetId: expectedTarget,
      nodeInfoList,
      executionRules: object(catalog.executionRules),
      ...(text(runningHub.instanceType) ? { instanceType: text(runningHub.instanceType) } : {}),
      sourceNodeId: step.node_id,
      canvasRunId: step.run_id,
      canvasRunStepId: step.id,
    },
  };
}

function parseRunningHubCatalogId(value: string) {
  const parts = value.split(':');
  if (parts.length !== 3 || !parts.every(Boolean) || !['app', 'workflow'].includes(parts[1])) return null;
  return { providerId: parts[0], kind: parts[1] as 'app' | 'workflow', itemId: parts[2] };
}
function runningHubFieldKey(field: Record<string, unknown>) { return `${text(field.nodeId)}:${text(field.fieldName)}`; }
function runningHubScalar(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return typeof value === 'string' ? value.slice(0, 2_000_000) : undefined;
}
function firstArrayValue(value: unknown) { return Array.isArray(value) ? text(value[0]) : ''; }

async function buildDeterministicOutput(client: PoolClient, step: StepRow) {
  const planStep = planSteps(step.plan_snapshot).find((item) => item.id === step.step_key || item.nodeId === step.node_id) || {};
  const upstream = await client.query<{ output_binding: Record<string, unknown> }>(
    `select d.output_binding from xh_canvas_run_steps d, jsonb_array_elements_text($2::jsonb) dep
     where d.run_id = $1 and d.node_id = dep order by d.sequence`,
    [step.run_id, JSON.stringify(step.depends_on || [])],
  );
  return executeDeterministicNode({
    nodeType: step.node_type,
    configuration: object(planStep.configuration),
    upstreamOutputs: upstream.rows.map((row) => object(row.output_binding)),
  });
}

export function mergeUpstreamPayload(payload: Record<string, unknown>, outputs: Record<string, unknown>[]) {
  const images = collectUrls(outputs, ['imageUrls', 'images']);
  const videos = collectUrls(outputs, ['videoUrls', 'videos']);
  const audios = collectUrls(outputs, ['audioUrls', 'audios']);
  const texts = outputs.flatMap((output) => [text(output.content), text(output.reply), text(output.text), text(output.prompt)]).filter(Boolean);
  if (!Array.isArray(payload.images) && images.length) payload.images = images;
  if (!Array.isArray(payload.videos) && videos.length) payload.videos = videos;
  if (!Array.isArray(payload.audios) && audios.length) payload.audios = audios;
  if (!text(payload.prompt) && texts.length) payload.prompt = texts.join('\n\n').slice(0, 100_000);
  return payload;
}

async function resolveEnabledModel(client: PoolClient, providerId: string, modelRecordId: string, capability: string) {
  if (!modelRecordId) return null;
  const result = await client.query<{ model_record_id: string; provider_id: string }>(
    `select m.id as model_record_id, p.id as provider_id
     from xh_models m join xh_providers p on p.id = m.provider_id
     where m.id = $1 and m.enabled = true and p.enabled = true and m.capability = $2
       and ($3 = '' or p.id = $3) limit 1`,
    [modelRecordId, capability, providerId],
  );
  return result.rows[0] ? { modelRecordId: result.rows[0].model_record_id, providerId: result.rows[0].provider_id } : null;
}

async function readBudgetError(client: PoolClient, step: StepRow) {
  const budget = object(step.budget_snapshot);
  const maxTaskCount = integer(budget.maxTaskCount, 100);
  const attempts = await client.query<{ count: number }>(
    `select count(*)::int as count from xh_tasks where payload->>'canvasRunId' = $1`,
    [step.run_id],
  );
  if (Number(attempts.rows[0]?.count || 0) >= maxTaskCount) return 'CANVAS_RUN_MAX_TASK_COUNT';
  const maxDurationSeconds = integer(budget.maxDurationSeconds, 3_600);
  const started = step.run_created_at ? new Date(step.run_created_at).getTime() : Date.now();
  if (Date.now() - started >= maxDurationSeconds * 1_000) return 'CANVAS_RUN_MAX_DURATION';
  const maxCost = Number(budget.maxCost || 0);
  if (Number.isFinite(maxCost) && maxCost > 0) {
    const currency = /^[A-Z]{3}$/.test(text(budget.currency)) ? text(budget.currency) : 'CNY';
    const cost = await client.query<{ amount: string }>(
      `select coalesce(sum(c.amount), 0)::text as amount
       from xh_task_cost_items c join xh_tasks t on t.id = c.task_id
       where t.payload->>'canvasRunId' = $1 and c.currency = $2 and c.status = 'charged'`,
      [step.run_id, currency],
    );
    if (Number(cost.rows[0]?.amount || 0) >= maxCost) return 'CANVAS_RUN_MAX_COST';
  }
  return '';
}

export function recoveryChoice(step: Pick<StepRow, 'attempt_count' | 'budget_snapshot' | 'plan_snapshot' | 'node_id'>) {
  const retries = integer(object(step.budget_snapshot).maxAttemptsPerStep, 3);
  if (Number(step.attempt_count) < retries) return { retry: true, strategy: 'same_configuration' };
  const planStep = planSteps(step.plan_snapshot).find((item) => item.nodeId === step.node_id) || {};
  const alternatives = Array.isArray(object(planStep.configuration).generationAlternatives) ? object(planStep.configuration).generationAlternatives as unknown[] : [];
  const alternative = object(alternatives[Math.max(0, Number(step.attempt_count) - retries)]);
  if (text(alternative.modelRecordId) && alternative.requiresApproval === false) return { retry: true, strategy: 'node_alternative', alternative };
  if (text(alternative.modelRecordId)) return { retry: false, strategy: 'approval_required', alternative };
  return { retry: false, strategy: 'exhausted' };
}

async function unlockDependents(client: PoolClient, runId: string) {
  await client.query(
    `update xh_canvas_run_steps s set status = 'ready', updated_at = now()
     where s.run_id = $1 and s.status = 'blocked' and not exists (
       select 1 from jsonb_array_elements_text(s.depends_on) dep
       left join xh_canvas_run_steps d on d.run_id = s.run_id and d.node_id = dep
       where d.id is null or d.status not in ('succeeded', 'skipped')
     )`,
    [runId],
  );
}

async function finalizeRunIfComplete(client: PoolClient, runId: string) {
  const result = await client.query<{ status: string }>(`select status from xh_canvas_run_steps where run_id = $1`, [runId]);
  if (result.rows.length > 0 && result.rows.every((row) => TERMINAL_STEP.has(row.status)) && result.rows.every((row) => ['succeeded', 'skipped'].includes(row.status))) {
    await client.query(`update xh_canvas_runs set status = 'succeeded', updated_at = now(), finalized_at = now() where id = $1`, [runId]);
    await appendEvent(client, runId, null, 'canvas_run.succeeded', {});
  }
}

async function appendEvent(client: PoolClient, runId: string, stepId: string | null, eventType: string, payload: Record<string, unknown>) {
  const sequence = await client.query<{ event_sequence: number }>(`update xh_canvas_runs set event_sequence = event_sequence + 1, updated_at = now() where id = $1 returning event_sequence`, [runId]);
  await client.query(`insert into xh_canvas_run_events (id, run_id, run_step_id, sequence, event_type, payload) values ($1,$2,$3,$4,$5,$6::jsonb)`, [`canvas_run_event_${randomUUID()}`, runId, stepId, Number(sequence.rows[0]?.event_sequence), eventType, JSON.stringify(payload)]);
}

function planSteps(value: unknown): Array<Record<string, unknown>> { return Array.isArray(object(value).steps) ? object(value).steps as Array<Record<string, unknown>> : []; }
function object(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }
function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function integer(value: unknown, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback; }
function collectUrls(outputs: Record<string, unknown>[], keys: string[]) { return [...new Set(outputs.flatMap((output) => keys.flatMap((key) => Array.isArray(output[key]) ? output[key] as unknown[] : [])).map(text).filter(Boolean))]; }
function wait(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
