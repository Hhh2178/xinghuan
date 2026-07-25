import { randomUUID } from 'node:crypto';
import { CANVAS_RUN_NATIVE_NODE_TYPES, executeDeterministicNode, NATIVE_DETERMINISTIC_NODE_TYPES } from '@xinghuan/agent-core';
import { projectCanvasRunFailureDiagnostic, taskQueueNameForCapability, type CanvasRunFailureDiagnostic } from '@xinghuan/shared';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { RedisClientType } from 'redis';
import { qualityContextForCompletedStep } from './canvas-run-quality-coordinator.js';
import { appendCompletedExecutionLayerEvents } from './canvas-run-quality-support.js';
import { advanceCanvasRunDispatchCursor, CANVAS_RUN_DISPATCH_SCOPES, lockCanvasRunDispatchCursor } from './canvas-run-dispatch-fairness.js';
import { mergeCanvasRunRecoveryOverrides, planCanvasRunRecovery } from './canvas-run-recovery-runtime.js';
import { initializeSmartCandidateSelector } from './canvas-run-candidate-selector.js';
import { readCanvasRunTaskProgress } from './canvas-run-task-progress.js';
import { resizeOwnedImage } from './worker-native-image-transform.js';
import {
  type CanvasRunRecoveryStepRow,
  findCanvasRunPromptRewriteRoute,
  mergeCanvasRunRecoveryRuntimePatch,
  recordCanvasRunRecoveryDecision,
  scheduleCanvasRunPromptRewriteTask,
  settleCanvasRunPromptRewriteTask,
  settleCanvasRunTaskAttempt,
} from './canvas-run-recovery-store.js';

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
  task_payload?: Record<string, unknown> | null;
  task_provider_id?: string | null;
  task_model_record_id?: string | null;
  plan_snapshot: Record<string, unknown>;
  budget_snapshot: Record<string, unknown>;
  configuration_snapshot: Record<string, unknown>;
  input_binding: Record<string, unknown>;
  recovery_overrides?: Record<string, unknown>;
  recovery_context?: Record<string, unknown>;
  dispatch_enqueued_at?: Date | null;
  execution_layer: number | null;
  run_created_at?: Date;
}

export function createCanvasRunCoordinator(options: {
  pool: Pool;
  redis: RedisClientType;
  workerId: string;
  environment: string;
  queueName: string;
  dataDir?: string;
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
        await recordTaskProgress();
        await settleCompletedTasks();
        await releaseDueRetries();
        await enqueuePendingDispatches();
        await recordExecutionLayerProgress();
        await initializeSmartCandidateSelector({ pool: options.pool, environment: options.environment, appendEvent });
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
      `select s.*, r.owner_id, r.plan_snapshot, r.budget_snapshot, r.configuration_snapshot,
         t.status as task_status, t.result as task_result, t.payload as task_payload,
         t.provider_id as task_provider_id, t.model_id as task_model_record_id
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

  async function recordTaskProgress() {
    const result = await options.pool.query<{ id: string; run_id: string; task_id: string; task_result: Record<string, unknown> }>(
      `select s.id, s.run_id, s.task_id, t.result as task_result
       from xh_canvas_run_steps s
       join xh_canvas_runs r on r.id = s.run_id
       join xh_tasks t on t.id = s.task_id
       where r.status in ('queued', 'running')
         and s.status in ('queued', 'running')
         and t.status = 'running'
       order by s.updated_at asc
       limit 25`,
    );
    for (const step of result.rows) {
      const client = await options.pool.connect();
      try {
        await client.query('begin');
        const locked = await client.query<{ run_id: string; task_id: string; task_result: Record<string, unknown> }>(
          `select s.run_id, s.task_id, t.result as task_result
           from xh_canvas_run_steps s
           join xh_tasks t on t.id = s.task_id
           where s.id = $1 and s.status in ('queued', 'running') and t.status = 'running'
           for update of s`,
          [step.id],
        );
        const current = locked.rows[0];
        const progress = readCanvasRunTaskProgress(current?.task_result);
        if (!current || !progress) {
          await client.query('rollback');
          continue;
        }
        const previous = await client.query<{ payload: Record<string, unknown> }>(
          `select payload from xh_canvas_run_events
           where run_step_id = $1 and event_type = 'canvas_run.step_progress'
           order by sequence desc limit 1`,
          [step.id],
        );
        const last = readCanvasRunTaskProgress(previous.rows[0]?.payload);
        if (
          last?.completed === progress.completed
          && last.total === progress.total
          && last.providerRequestCount === progress.providerRequestCount
          && JSON.stringify(last.taskRuns || []) === JSON.stringify(progress.taskRuns || [])
        ) {
          await client.query('rollback');
          continue;
        }
        await appendEvent(client, current.run_id, step.id, 'canvas_run.step_progress', {
          taskId: current.task_id,
          completed: progress.completed,
          generationCount: progress.total,
          providerRequestCount: progress.providerRequestCount,
          ...(progress.taskRuns ? { taskRuns: progress.taskRuns } : {}),
        });
        await client.query('commit');
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  }

  async function settleStep(step: StepRow) {
    const client = await options.pool.connect();
    try {
      await client.query('begin');
      const locked = await client.query<StepRow>(
        `select s.*, r.owner_id, r.plan_snapshot, r.budget_snapshot, r.configuration_snapshot,
           t.status as task_status, t.result as task_result, t.payload as task_payload,
           t.provider_id as task_provider_id, t.model_id as task_model_record_id
         from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id join xh_tasks t on t.id = s.task_id
         where s.id = $1 for update of s, r`,
        [step.id],
      );
      const current = locked.rows[0];
      if (!current || !['queued', 'running'].includes(current.status)) {
        await client.query('rollback');
        return;
      }
      if (text(object(current.recovery_context).kind) === 'prompt_review_rewrite') {
        await settleCanvasRunPromptRewriteTask(client, current, appendEvent, failCanvasRunStep);
        await client.query('commit');
        return;
      }
      if (current.task_status === 'succeeded') {
        await settleCanvasRunTaskAttempt(client, current.task_id, 'succeeded');
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
        await settleCanvasRunTaskAttempt(client, current.task_id, 'failed');
        await settleFailedStep(client, current);
      } else {
        await settleCanvasRunTaskAttempt(client, current.task_id, 'cancelled');
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

  async function settleFailedStep(client: PoolClient, step: StepRow) {
    const prior = await client.query<{ action_type: string; alternative_generation_model_id_snapshot: string | null }>(
      `select action_type, alternative_generation_model_id_snapshot
       from xh_recovery_decisions where owner_id = $1 and canvas_run_id = $2 and run_step_id = $3
       order by created_at asc`,
      [step.owner_id, step.run_id, step.id],
    );
    const planned = planCanvasRunRecovery({
      attemptCount: Number(step.attempt_count),
      nodeId: step.node_id,
      planSnapshot: object(step.plan_snapshot),
      budgetSnapshot: object(step.budget_snapshot),
      configurationSnapshot: object(step.configuration_snapshot),
      taskResult: object(step.task_result),
      priorDecisions: prior.rows.map((row) => ({
        actionType: row.action_type,
        alternativeModelRecordId: row.alternative_generation_model_id_snapshot || undefined,
      })),
    });
    let recovery = planned.recovery;
    let runtimePatch = planned.runtimePatch;
    if ((recovery.action === 'switch_generation_model' || recovery.action === 'request_approval') && recovery.alternative) {
      const planStep = planSteps(step.plan_snapshot).find((item) => item.nodeId === step.node_id) || {};
      const capability = text(object(planStep.configuration).taskCapability) || (step.node_type === 'llm' ? 'chat' : step.node_type);
      const available = await resolveEnabledModel(client, recovery.alternative.providerId, recovery.alternative.modelRecordId, capability, object(step.task_payload));
      if (!available) {
        recovery = { action: 'stop', failureCategory: planned.failureCategory, reason: 'frozen fallback model is no longer enabled or compatible' };
        runtimePatch = {};
      }
    }

    const originalPrompt = text(object(step.task_payload).prompt);
    const rewriteRoute = recovery.action === 'rewrite_prompt_for_review' && originalPrompt
      ? await findCanvasRunPromptRewriteRoute(
        client,
        options.environment,
        `${step.run_id}:${step.id}:${step.task_id || 'none'}:prompt-review-rewrite`,
      )
      : null;
    if (recovery.action === 'rewrite_prompt_for_review' && (!originalPrompt || !rewriteRoute)) {
      recovery = {
        action: 'stop',
        failureCategory: planned.failureCategory,
        reason: originalPrompt ? 'published prompt-review recovery route is unavailable' : 'failed task has no prompt to rewrite',
      };
      runtimePatch = {};
    }

    let approvalId = '';
    if (recovery.action === 'request_approval' && recovery.alternative) {
      approvalId = `agent_approval_${randomUUID()}`;
      await client.query(
        `insert into xh_agent_approvals
          (id, owner_id, canvas_run_id, run_step_id, action_type, action_snapshot, status, requested_by)
         values ($1, $2, $3, $4, 'switch_generation_model', $5::jsonb, 'pending', 'canvas-run-worker')`,
        [approvalId, step.owner_id, step.run_id, step.id, JSON.stringify(recovery.alternative)],
      );
      runtimePatch = { generationModel: {
        providerId: recovery.alternative.providerId,
        modelId: recovery.alternative.modelId,
        modelRecordId: recovery.alternative.modelRecordId,
      } };
    }
    const decisionId = await recordCanvasRunRecoveryDecision(client, step, recovery, prior.rows.length + 1, approvalId);

    if (recovery.action === 'retry_same_configuration'
      || recovery.action === 'apply_parameter_repair'
      || recovery.action === 'switch_generation_model') {
      const overrides = mergeCanvasRunRecoveryRuntimePatch(step.recovery_overrides, runtimePatch);
      await client.query(
        `update xh_canvas_run_steps
         set status = 'retry_wait', task_id = null, dispatch_enqueued_at = null,
             lease_owner = null, lease_expires_at = null,
             retry_not_before = now() + ($3::bigint * interval '1 millisecond'),
             recovery_overrides = $2::jsonb, recovery_context = '{}'::jsonb,
             error = $4::jsonb, updated_at = now()
         where id = $1`,
        [step.id, JSON.stringify(overrides), planned.retryDelayMs, JSON.stringify({
          previousTaskId: step.task_id,
          decisionId,
          failureCategory: planned.failureCategory,
          action: recovery.action,
        })],
      );
      await appendEvent(client, step.run_id, step.id, 'canvas_run.step_recovery_scheduled', {
        decisionId,
        failureCategory: planned.failureCategory,
        action: recovery.action,
        retryDelayMs: planned.retryDelayMs,
        providerId: recovery.alternative?.providerId,
        modelId: recovery.alternative?.modelId,
        modelRecordId: recovery.alternative?.modelRecordId,
      });
      return;
    }

    if (recovery.action === 'rewrite_prompt_for_review' && rewriteRoute) {
      await scheduleCanvasRunPromptRewriteTask(client, step, decisionId, originalPrompt, rewriteRoute, prior.rows.length + 1, appendEvent);
      return;
    }

    if (recovery.action === 'request_approval') {
      const overrides = mergeCanvasRunRecoveryRuntimePatch(step.recovery_overrides, runtimePatch);
      await client.query(
        `update xh_canvas_run_steps
         set status = 'awaiting_approval', lease_owner = null, lease_expires_at = null,
             recovery_overrides = $2::jsonb,
             error = $3::jsonb, updated_at = now() where id = $1`,
        [step.id, JSON.stringify(overrides), JSON.stringify({ previousTaskId: step.task_id, approvalId, decisionId })],
      );
      await client.query(`update xh_canvas_runs set status = 'awaiting_approval', updated_at = now() where id = $1`, [step.run_id]);
      await appendEvent(client, step.run_id, step.id, 'canvas_run.step_approval_requested', { approvalId, decisionId, actionType: 'switch_generation_model' });
      return;
    }

    await failCanvasRunStep(client, step, {
      taskId: step.task_id,
      decisionId,
      failureCategory: planned.failureCategory,
      reason: recovery.reason,
      result: step.task_result || {},
    });
  }

  async function failCanvasRunStep(client: PoolClient, step: CanvasRunRecoveryStepRow, error: Record<string, unknown>) {
    await client.query(
      `update xh_canvas_run_steps
       set status = 'failed', lease_owner = null, lease_expires_at = null,
           error = $2::jsonb, updated_at = now(), finalized_at = now() where id = $1`,
      [step.id, JSON.stringify(error)],
    );
    await client.query(`update xh_canvas_runs set status = 'failed', updated_at = now(), finalized_at = now() where id = $1`, [step.run_id]);
    const diagnostic = buildCanvasRunTaskFailureDiagnostic({
      runId: step.run_id,
      runStepId: step.id,
      nodeId: step.node_id,
      nodeType: step.node_type,
      taskId: text(error.taskId) || text(step.task_id),
      result: object(error.result),
      fallbackFailureCategory: text(error.failureCategory),
      fallbackReason: text(error.reason),
    });
    await appendEvent(client, step.run_id, step.id, 'canvas_run.step_failed', {
      taskId: step.task_id,
      code: text(error.code),
      decisionId: text(error.decisionId),
      failureCategory: text(error.failureCategory),
      providerDiagnostic: diagnostic.observed,
      upstreamHttpStatus: diagnostic.technical.upstreamHttpStatus,
      requestId: diagnostic.technical.requestId,
      providerName: diagnostic.location.providerName,
      modelName: diagnostic.location.modelName,
      diagnostic,
    });
    await appendEvent(client, step.run_id, null, 'canvas_run.failed', { stepId: step.id, decisionId: text(error.decisionId) });
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
             and s.node_type <> 'smart-candidate-selector'
             and (s.lease_expires_at is null or s.lease_expires_at < now())
             and coalesce(s.execution_layer, 0) = (
               select min(coalesce(layer_step.execution_layer, 0)) from xh_canvas_run_steps layer_step
               where layer_step.run_id = r.id
                 and layer_step.status not in ('succeeded', 'failed', 'cancelled', 'skipped')
             )
             and (
               select count(*) from xh_canvas_run_steps active_steps
               where active_steps.run_id = r.id and active_steps.status in ('queued', 'running', 'evaluating')
             ) < greatest(1, least(64, coalesce(
               nullif(r.configuration_snapshot->>'effectiveConcurrency', '')::int,
               nullif(r.configuration_snapshot->>'stageConcurrency', '')::int,
               1
             )))
           group by r.owner_id
         ), next_owner as (
           select owner_id from ready_owners
           order by case when owner_id > $1 then 0 else 1 end, owner_id
           limit 1
         )
         select s.*, r.owner_id, r.plan_snapshot, r.budget_snapshot, r.configuration_snapshot, r.created_at as run_created_at
         from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id
         join next_owner on next_owner.owner_id = r.owner_id
         where r.status in ('queued', 'running') and s.status = 'ready'
           and s.node_type <> 'smart-candidate-selector'
           and (s.lease_expires_at is null or s.lease_expires_at < now())
           and coalesce(s.execution_layer, 0) = (
             select min(coalesce(layer_step.execution_layer, 0)) from xh_canvas_run_steps layer_step
             where layer_step.run_id = r.id
               and layer_step.status not in ('succeeded', 'failed', 'cancelled', 'skipped')
           )
           and (
             select count(*) from xh_canvas_run_steps active_steps
             where active_steps.run_id = r.id and active_steps.status in ('queued', 'running', 'evaluating')
           ) < greatest(1, least(64, coalesce(
             nullif(r.configuration_snapshot->>'effectiveConcurrency', '')::int,
             nullif(r.configuration_snapshot->>'stageConcurrency', '')::int,
             1
           )))
         order by r.updated_at asc, s.sequence asc
         for update of s, r skip locked limit 1`,
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
      if (NATIVE_DETERMINISTIC_NODE_TYPES.has(step.node_type) || step.node_type === 'resize') {
        try {
          const output = await buildDeterministicOutput(client, step, options.dataDir || 'data');
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
        : await resolveEnabledModel(client, taskInput.providerId, taskInput.modelRecordId, taskInput.capability, taskInput.payload);
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
      const attemptNo = Number(step.attempt_count) + 1;
      await client.query(
        `insert into xh_task_attempts
          (id, owner_id, run_step_id, task_id, attempt_no, provider_id, model_id, status,
           reason, parameter_snapshot, idempotency_key)
         values ($1, $2, $3, $4, $5, $6, $7, 'queued', 'canvas_run_dispatch', $8::jsonb, $9)
         on conflict (run_step_id, attempt_no) do nothing`,
        [`task_attempt_${randomUUID()}`, step.owner_id, step.id, taskId, attemptNo,
          resolvedModel.providerId, resolvedModel.modelRecordId || null,
          JSON.stringify({ ...taskInput.payload, modelRecordId: resolvedModel.modelRecordId || '' }),
          `canvas-run:${step.run_id}:step:${step.id}:attempt:${attemptNo}`],
      );
      await client.query(
        `update xh_canvas_run_steps set status = 'queued', task_id = $2, attempt_count = attempt_count + 1,
           lease_owner = $3, lease_expires_at = now() + ($4::bigint * interval '1 millisecond'),
           dispatch_enqueued_at = null, started_at = coalesce(started_at, now()), updated_at = now() where id = $1`,
        [step.id, taskId, options.workerId, leaseMs],
      );
      await client.query(`update xh_canvas_runs set status = 'running', started_at = coalesce(started_at, now()), updated_at = now() where id = $1 and status = 'queued'`, [step.run_id]);
      await appendEvent(client, step.run_id, step.id, 'canvas_run.step_dispatched', { taskId, attempt: attemptNo, capability: taskInput.capability });
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
          await client.query(`update xh_recovery_decisions set status = 'applied', applied_at = now(), updated_at = now() where approval_id = $1 and status = 'proposed'`, [decision.approval_id]);
        } else {
          await client.query(`update xh_canvas_run_steps set status = 'failed', finalized_at = now(), updated_at = now() where id = $1`, [decision.step_id]);
          await client.query(`update xh_canvas_runs set status = 'failed', finalized_at = now(), updated_at = now() where id = $1`, [decision.run_id]);
          await appendEvent(client, decision.run_id, decision.step_id, 'canvas_run.step_approval_declined', { approvalId: decision.approval_id, status: decision.status });
          await client.query(`update xh_recovery_decisions set status = 'rejected', updated_at = now() where approval_id = $1 and status = 'proposed'`, [decision.approval_id]);
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

  async function recordExecutionLayerProgress() {
    const runs = await options.pool.query<{ id: string }>(
      `select id from xh_canvas_runs where status in ('queued', 'running') order by updated_at asc limit 50`,
    );
    for (const run of runs.rows) {
      const client = await options.pool.connect();
      try {
        await client.query('begin');
        const locked = await client.query<{ id: string }>(
          `select id from xh_canvas_runs where id = $1 and status in ('queued', 'running') for update`,
          [run.id],
        );
        if (!locked.rows[0]) {
          await client.query('rollback');
          continue;
        }
        const steps = await client.query<{ execution_layer: number | null; status: string }>(
          `select execution_layer, status from xh_canvas_run_steps where run_id = $1 order by execution_layer, sequence`,
          [run.id],
        );
        const events = await client.query<{ event_type: string; payload: Record<string, unknown> }>(
          `select event_type, payload from xh_canvas_run_events
           where run_id = $1 and event_type in ('canvas_run.execution_layer_started', 'canvas_run.execution_layer_completed')`,
          [run.id],
        );
        const started = new Set(events.rows.filter((event) => event.event_type.endsWith('_started')).map((event) => Number(object(event.payload).layerIndex)));
        const completed = new Set(events.rows.filter((event) => event.event_type.endsWith('_completed')).map((event) => Number(object(event.payload).layerIndex)));
        const layers = [...new Set(steps.rows.map((step) => step.execution_layer).filter((layer): layer is number => layer !== null))].sort((left, right) => left - right);
        for (const layerIndex of layers) {
          const layerSteps = steps.rows.filter((step) => step.execution_layer === layerIndex);
          if (!completed.has(layerIndex) && layerSteps.every((step) => ['succeeded', 'skipped'].includes(step.status))) {
            await appendEvent(client, run.id, null, 'canvas_run.execution_layer_completed', { layerIndex, stepCount: layerSteps.length });
            completed.add(layerIndex);
          }
        }
        const currentLayer = layers.find((layerIndex) => steps.rows.some((step) => (
          step.execution_layer === layerIndex && !TERMINAL_STEP.has(step.status)
        )));
        if (currentLayer !== undefined && !started.has(currentLayer)) {
          const stepCount = steps.rows.filter((step) => step.execution_layer === currentLayer).length;
          await appendEvent(client, run.id, null, 'canvas_run.execution_layer_started', { layerIndex: currentLayer, stepCount });
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

  async function releaseDueRetries() {
    await options.pool.query(
      `update xh_canvas_run_steps s
       set status = 'ready', retry_not_before = null, updated_at = now()
       from xh_canvas_runs r
       where r.id = s.run_id and r.status in ('queued', 'running')
         and s.status = 'retry_wait'
         and (s.retry_not_before is null or s.retry_not_before <= now())`,
    );
  }

  async function enqueueTask(taskId: string, capability: string, stepId?: string) {
    await options.redis.lPush(taskQueueNameForCapability(options.queueName, capability as never), taskId);
    await options.pool.query(`update xh_canvas_run_steps set dispatch_enqueued_at = now(), updated_at = now() where ${stepId ? 'id = $1' : 'task_id = $1'}`, [stepId || taskId]);
  }

  return { run, stop, tick: async () => {
    await resumeApprovalDecisions();
    await recordTaskProgress();
    await settleCompletedTasks();
    await releaseDueRetries();
    await enqueuePendingDispatches();
    await recordExecutionLayerProgress();
    await initializeSmartCandidateSelector({ pool: options.pool, environment: options.environment, appendEvent });
    await claimReadyStep();
  } };
}

export function buildCanvasRunTaskFailureDiagnostic(input: {
  runId: string;
  runStepId: string;
  nodeId: string;
  nodeType: string;
  taskId: string;
  result: Record<string, unknown>;
  fallbackFailureCategory?: string;
  fallbackReason?: string;
}): CanvasRunFailureDiagnostic {
  const result = object(input.result);
  const failureCategory = text(result.failureCategory) || text(input.fallbackFailureCategory);
  return projectCanvasRunFailureDiagnostic({
    code: text(result.code) || failureCategory || 'CANVAS_RUN_TASK_FAILED',
    message: text(result.error) || text(result.failureReason) || text(input.fallbackReason),
    failureCategory,
    providerDiagnostic: result.providerDiagnostic,
    waitReason: result.waitReason,
    runId: input.runId,
    runStepId: input.runStepId,
    nodeId: input.nodeId,
    nodeType: input.nodeType,
    providerName: result.providerName,
    modelName: result.modelName,
    taskId: input.taskId,
    requestId: result.requestId,
    upstreamHttpStatus: result.upstreamHttpStatus,
  });
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
  const configuration = mergeCanvasRunRecoveryOverrides(planStep.configuration, step.recovery_overrides);
  const selected = {
    providerId: text(configuration.providerId),
    modelRecordId: text(configuration.modelRecordId),
    modelId: text(configuration.modelId),
  };
  const payload = { ...object(configuration.executionPayload), ...object(step.input_binding) };
  const upstream = await client.query<{ output_binding: Record<string, unknown> }>(
    `select d.output_binding from xh_canvas_run_steps d, jsonb_array_elements_text($2::jsonb) dep
     where d.run_id = $1 and d.node_id = dep order by d.sequence`,
    [step.run_id, JSON.stringify(step.depends_on || [])],
  );
  mergeUpstreamPayload(payload, upstream.rows.map((row) => object(row.output_binding)));
  const capability = text(configuration.taskCapability) || (step.node_type === 'llm' ? 'chat' : step.node_type);
  return {
    providerId: selected.providerId,
    modelRecordId: selected.modelRecordId,
    payload: { ...payload, providerModel: selected.modelId, taskCapability: capability, executionMode: 'worker_queue', sourceNodeId: step.node_id, canvasRunId: step.run_id, canvasRunStepId: step.id },
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

export function resolveResizeImageUrl(payload: Record<string, unknown>, upstreamOutputs: Record<string, unknown>[]) {
  return text(payload.imageUrl)
    || firstArrayValue(payload.imageUrls)
    || collectUrls(upstreamOutputs, ['materializedImageUrls', 'imageUrls', 'images'])[0]
    || '';
}

async function buildDeterministicOutput(client: PoolClient, step: StepRow, dataDir: string) {
  const planStep = planSteps(step.plan_snapshot).find((item) => item.id === step.step_key || item.nodeId === step.node_id) || {};
  const upstream = await client.query<{ output_binding: Record<string, unknown> }>(
    `select d.output_binding from xh_canvas_run_steps d, jsonb_array_elements_text($2::jsonb) dep
     where d.run_id = $1 and d.node_id = dep order by d.sequence`,
    [step.run_id, JSON.stringify(step.depends_on || [])],
  );
  const upstreamOutputs = upstream.rows.map((row) => object(row.output_binding));
  if (step.node_type === 'resize') {
    const payload = object(object(planStep.configuration).executionPayload);
    const imageUrl = resolveResizeImageUrl(payload, upstreamOutputs);
    if (!imageUrl) throw new Error('CANVAS_RUN_IMAGE_INPUT_REQUIRED');
    return resizeOwnedImage({
      dataDir,
      ownerId: step.owner_id,
      imageUrl,
      width: payload.width,
      height: payload.height,
      fit: payload.fit,
    });
  }
  return executeDeterministicNode({
    nodeType: step.node_type,
    configuration: object(planStep.configuration),
    upstreamOutputs,
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

async function resolveEnabledModel(client: PoolClient, providerId: string, modelRecordId: string, capability: string, payload: Record<string, unknown> = {}) {
  if (!modelRecordId) return null;
  const result = await client.query<{ model_record_id: string; provider_id: string; input_capabilities: Record<string, unknown> }>(
    `select m.id as model_record_id, p.id as provider_id, m.input_capabilities
     from xh_models m join xh_providers p on p.id = m.provider_id
     where m.id = $1 and m.enabled = true and p.enabled = true and m.capability = $2
       and ($3 = '' or p.id = $3) limit 1`,
    [modelRecordId, capability, providerId],
  );
  const row = result.rows[0];
  if (!row || !modelSupportsTaskInputs(object(row.input_capabilities), payload)) return null;
  return { modelRecordId: row.model_record_id, providerId: row.provider_id };
}

function modelSupportsTaskInputs(capabilities: Record<string, unknown>, payload: Record<string, unknown>) {
  if (hasPayloadMedia(payload, ['image', 'imageUrl', 'imageUrls', 'images'])
    && !['imageReference', 'firstFrame', 'lastFrame'].some((key) => capabilities[key] === true)) return false;
  if (hasPayloadMedia(payload, ['video', 'videoUrl', 'videoUrls', 'videos']) && capabilities.videoReference !== true) return false;
  if (hasPayloadMedia(payload, ['audio', 'audioUrl', 'audioUrls', 'audios']) && capabilities.audioReference !== true) return false;
  if (text(payload.prompt) && capabilities.prompt === false) return false;
  return true;
}

function hasPayloadMedia(payload: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => Array.isArray(payload[key])
    ? (payload[key] as unknown[]).some((item) => Boolean(text(item)))
    : Boolean(text(payload[key])));
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
    await appendCompletedExecutionLayerEvents(client, runId);
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
