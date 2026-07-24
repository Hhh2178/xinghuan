import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { buildCanvasRunTaskFailureDiagnostic, createCanvasRunCoordinator, mergeUpstreamPayload, resolveResizeImageUrl } from './canvas-run-coordinator.js';

describe('canvas run coordinator', () => {
  it('uses an owner-scoped materialized image before remote provider URLs for resize', () => {
    expect(resolveResizeImageUrl({}, [{
      imageUrls: ['https://provider.example/image.jpg'],
      materializedImageUrls: ['/files/output/current-owner.png'],
    }])).toBe('/files/output/current-owner.png');
  });

  it('binds upstream media and text without overwriting explicit inputs', () => {
    const payload = { images: ['explicit.png'] } as Record<string, unknown>;
    mergeUpstreamPayload(payload, [
      { imageUrls: ['generated-a.png'], videoUrls: ['generated.mp4'], reply: '下一步提示词' },
      { audioUrls: ['voice.wav'], imageUrls: ['generated-a.png', 'generated-b.png'] },
    ]);

    expect(payload.images).toEqual(['explicit.png']);
    expect(payload.videos).toEqual(['generated.mp4']);
    expect(payload.audios).toEqual(['voice.wav']);
    expect(payload.prompt).toBe('下一步提示词');
  });

  it('projects a failed Provider task into a safe assistant-ready diagnostic', () => {
    const diagnostic = buildCanvasRunTaskFailureDiagnostic({
      runId: 'run-1',
      runStepId: 'step-1',
      nodeId: 'image-1',
      nodeType: 'image',
      taskId: 'task-1',
      result: {
        failureCategory: 'upstream_business_failed',
        providerDiagnostic: 'Bearer private-key rejected https://private.example/file.png?token=secret',
        upstreamHttpStatus: 400,
        requestId: 'request-1',
        providerName: 'RunningHub',
        modelName: 'RH Image',
      },
    });

    expect(diagnostic).toMatchObject({
      category: 'provider',
      title: '渠道拒绝了本次请求',
      location: { runId: 'run-1', runStepId: 'step-1', nodeId: 'image-1', nodeType: 'image', providerName: 'RunningHub', modelName: 'RH Image' },
      technical: { code: 'upstream_business_failed', taskId: 'task-1', requestId: 'request-1', upstreamHttpStatus: 400 },
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(/private-key|private\.example|token=secret/);
  });

  it('records normalized transient recovery and waits for bounded backoff', async () => {
    const harness = coordinatorHarness({ failedTaskResult: { failureCategory: 'upstream_poll_timeout', failureReason: 'provider timeout', upstreamHttpStatus: 504 } });
    const coordinator = createCanvasRunCoordinator({ pool: harness.pool, redis: harness.redis, workerId: 'worker-a', environment: 'test', queueName: 'tasks', enabled: true });

    await coordinator.tick();

    expect(harness.state.recoveryDecisionInsertions).toBe(1);
    expect(harness.state.recoveryAction).toBe('retry_same_configuration');
    expect(harness.state.stepStatus).toBe('retry_wait');
    expect(harness.state.retryDelayMs).toBe(2_000);
    expect(harness.redis.lPush).not.toHaveBeenCalled();
  });

  it('queues content-review rewriting through the published recovery chat route', async () => {
    const harness = coordinatorHarness({ failedTaskResult: { failureCategory: 'unknown', failureReason: 'content policy moderation blocked' }, promptRewrite: true });
    const coordinator = createCanvasRunCoordinator({ pool: harness.pool, redis: harness.redis, workerId: 'worker-a', environment: 'gray', queueName: 'tasks', enabled: true });

    await coordinator.tick();

    expect(harness.state.recoveryAction).toBe('rewrite_prompt_for_review');
    expect(harness.state.stepStatus).toBe('queued');
    expect(harness.state.taskPayload).toMatchObject({ taskCapability: 'chat', recoveryDecisionId: 'decision-1' });
    expect(harness.state.recoveryContext).toMatchObject({ kind: 'prompt_review_rewrite', decisionId: 'decision-1', originalPrompt: 'test' });
    expect(harness.redis.lPush).toHaveBeenCalledWith('tasks:chat', expect.any(String));
  });

  it('dispatches the frozen fallback model only after its approval is applied', async () => {
    const harness = coordinatorHarness({
      failedTaskResult: { failureCategory: 'upstream_poll_gateway_failed', failureReason: 'provider unavailable' },
      maxAttemptsPerStep: 0,
      retryExhaustionPolicy: 'compatible_fallback',
      generationAlternative: {
        providerId: 'provider-2',
        modelId: 'backup-upstream-model',
        modelRecordId: 'model-2',
        requiresApproval: true,
      },
      approvalStatus: 'approved',
    });
    const coordinator = createCanvasRunCoordinator({ pool: harness.pool, redis: harness.redis, workerId: 'worker-a', environment: 'test', queueName: 'tasks', enabled: true });

    await coordinator.tick();
    expect(harness.state.stepStatus).toBe('awaiting_approval');
    expect(harness.state.recoveryOverrides).toMatchObject({ generationModel: { modelRecordId: 'model-2' } });

    await coordinator.tick();

    expect(harness.state.stepStatus).toBe('queued');
    expect(harness.state.dispatchedProviderId).toBe('provider-2');
    expect(harness.state.dispatchedModelRecordId).toBe('model-2');
    expect(harness.state.taskPayload).toMatchObject({ providerModel: 'backup-upstream-model' });
  });

  it('allows two coordinators to compete without creating a duplicate task', async () => {
    const harness = coordinatorHarness();
    const first = createCanvasRunCoordinator({ pool: harness.pool, redis: harness.redis, workerId: 'worker-a', environment: 'test', queueName: 'tasks', enabled: true });
    const second = createCanvasRunCoordinator({ pool: harness.pool, redis: harness.redis, workerId: 'worker-b', environment: 'test', queueName: 'tasks', enabled: true });

    await first.tick();
    await second.tick();

    expect(harness.state.taskInsertions).toBe(1);
    expect(harness.state.stepStatus).toBe('queued');
    expect(harness.state.leaseOwner).toBe('worker-a');
    expect(harness.redis.lPush).toHaveBeenCalledTimes(1);
  });

  it('recovers a committed task after the first Redis delivery loses acknowledgement', async () => {
    const harness = coordinatorHarness({ failFirstPush: true });
    const first = createCanvasRunCoordinator({ pool: harness.pool, redis: harness.redis, workerId: 'worker-a', environment: 'test', queueName: 'tasks', enabled: true });
    const takeover = createCanvasRunCoordinator({ pool: harness.pool, redis: harness.redis, workerId: 'worker-b', environment: 'test', queueName: 'tasks', enabled: true });

    await expect(first.tick()).rejects.toThrow('REDIS_DELIVERY_LOST');
    expect(harness.state.taskInsertions).toBe(1);
    expect(harness.state.dispatchEnqueued).toBe(false);
    await takeover.tick();

    expect(harness.state.taskInsertions).toBe(1);
    expect(harness.state.dispatchEnqueued).toBe(true);
    expect(harness.redis.lPush).toHaveBeenCalledTimes(2);
  });

  it('uses a durable owner round-robin cursor when claiming ready work', () => {
    const source = readFileSync(new URL('./canvas-run-coordinator.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/with ready_owners as/i);
    expect(source).toMatch(/order by case when owner_id > \$1 then 0 else 1 end, owner_id/i);
    expect(source).toMatch(/lockCanvasRunDispatchCursor/);
    expect(source).toMatch(/advanceCanvasRunDispatchCursor/);
  });

  it('enforces the immutable per-run stage concurrency before claiming work', () => {
    const source = readFileSync(new URL('./canvas-run-coordinator.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/configuration_snapshot->>'stageConcurrency'/);
    expect(source).toMatch(/active_steps\.run_id = r\.id/);
    expect(source).toMatch(/for update of s, r skip locked/i);
  });

  it('claims only the current deterministic execution layer and records layer progress', () => {
    const source = readFileSync(new URL('./canvas-run-coordinator.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/s\.execution_layer/);
    expect(source).toMatch(/coalesce\(s\.execution_layer, 0\)/);
    expect(source).toMatch(/min\(coalesce\(layer_step\.execution_layer, 0\)\)/);
    expect(source).toMatch(/configuration_snapshot->>'effectiveConcurrency'/);
    expect(source).toMatch(/canvas_run\.execution_layer_started/);
    expect(source).toMatch(/canvas_run\.execution_layer_completed/);
  });

  it('records execution-layer progress in the real continuous run loop', () => {
    const source = readFileSync(new URL('./canvas-run-coordinator.ts', import.meta.url), 'utf8');
    const runLoop = source.match(/async function run\(\) \{[\s\S]*?await wait\(pollIntervalMs\);[\s\S]*?\n  \}/)?.[0] || '';
    expect(runLoop).toMatch(/await recordExecutionLayerProgress\(\)/);
    expect(runLoop.indexOf('recordExecutionLayerProgress')).toBeLessThan(runLoop.indexOf('initializeSmartCandidateSelector'));
    expect(runLoop.indexOf('initializeSmartCandidateSelector')).toBeLessThan(runLoop.indexOf('claimReadyStep'));
  });

  it('routes the explicit smart selector before the generation claim', () => {
    const source = readFileSync(new URL('./canvas-run-coordinator.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/initializeSmartCandidateSelector\(\{ pool: options\.pool, environment: options\.environment, appendEvent \}\)/);
    expect(source).toMatch(/s\.node_type <> 'smart-candidate-selector'/);
  });

  it('settles a native deterministic text step without creating a Provider task', async () => {
    const harness = coordinatorHarness({ nodeType: 'text', prompt: 'server-owned prompt' });
    const coordinator = createCanvasRunCoordinator({ pool: harness.pool, redis: harness.redis, workerId: 'worker-a', environment: 'test', queueName: 'tasks', enabled: true });

    await coordinator.tick();

    expect(harness.state.taskInsertions).toBe(0);
    expect(harness.redis.lPush).not.toHaveBeenCalled();
    expect(harness.state.stepStatus).toBe('succeeded');
    expect(harness.state.outputBinding).toMatchObject({ prompt: 'server-owned prompt', text: 'server-owned prompt' });
  });

  it('settles a text split step server-side and exposes ordered segments downstream', async () => {
    const harness = coordinatorHarness({ nodeType: 'text-split', prompt: '镜头 1：雨夜\n\n镜头 2：咖啡店' });
    const coordinator = createCanvasRunCoordinator({ pool: harness.pool, redis: harness.redis, workerId: 'worker-a', environment: 'test', queueName: 'tasks', enabled: true });

    await coordinator.tick();

    expect(harness.state.taskInsertions).toBe(0);
    expect(harness.redis.lPush).not.toHaveBeenCalled();
    expect(harness.state.stepStatus).toBe('succeeded');
    expect(harness.state.outputBinding).toMatchObject({ textSegments: ['镜头 1：雨夜', '镜头 2：咖啡店'] });
  });

  it('creates a governed RunningHub task only from the live enabled catalog contract', async () => {
    const harness = coordinatorHarness({ nodeType: 'runninghub' });
    const coordinator = createCanvasRunCoordinator({ pool: harness.pool, redis: harness.redis, workerId: 'worker-a', environment: 'test', queueName: 'tasks', enabled: true });

    await coordinator.tick();

    expect(harness.state.taskInsertions).toBe(1);
    expect(harness.state.taskPayload).toMatchObject({
      taskCapability: 'image',
      targetType: 'workflow',
      rhCatalogId: 'provider-1:workflow:workflow-1',
      runTargetId: 'workflow-1',
      nodeInfoList: [{ nodeId: 'prompt-1', fieldName: 'text', fieldValue: 'a studio portrait' }],
    });
    expect(harness.state.taskPayload).not.toHaveProperty('appInfo');
    expect(harness.redis.lPush).toHaveBeenCalledWith('tasks:image', expect.any(String));
  });
});

function coordinatorHarness(options: {
  failFirstPush?: boolean;
  nodeType?: 'image' | 'text' | 'text-split' | 'runninghub';
  prompt?: string;
  failedTaskResult?: Record<string, unknown>;
  promptRewrite?: boolean;
  maxAttemptsPerStep?: number;
  retryExhaustionPolicy?: 'stop' | 'compatible_fallback';
  generationAlternative?: Record<string, unknown>;
  approvalStatus?: 'approved' | 'rejected';
} = {}) {
  const state = {
    stepStatus: options.failedTaskResult ? 'queued' : 'ready',
    taskId: options.failedTaskResult ? 'task-failed' : '',
    taskInsertions: 0,
    dispatchEnqueued: false,
    leaseOwner: '',
    eventSequence: 0,
    lastOwnerId: '',
    outputBinding: {} as Record<string, unknown>,
    taskPayload: {} as Record<string, unknown>,
    recoveryDecisionInsertions: 0,
    recoveryAction: '',
    retryDelayMs: 0,
    recoveryContext: {} as Record<string, unknown>,
    recoveryOverrides: {} as Record<string, unknown>,
    approvalId: '',
    dispatchedProviderId: '',
    dispatchedModelRecordId: '',
  };
  const isRunningHub = options.nodeType === 'runninghub';
  const step = {
    id: 'step-1', run_id: 'run-1', owner_id: 'owner-1', node_id: `${options.nodeType || 'image'}-1`, node_type: options.nodeType || 'image', status: 'ready',
    attempt_count: options.failedTaskResult ? 1 : 0, task_id: options.failedTaskResult ? 'task-failed' : null, plan_snapshot: { steps: [{ nodeId: `${options.nodeType || 'image'}-1`, configuration: {
      providerId: 'provider-1', modelRecordId: 'model-1', modelId: 'upstream-model', taskCapability: options.nodeType === 'text' || options.nodeType === 'text-split' ? '' : 'image', executionPayload: options.nodeType === 'text-split'
        ? { sourceText: options.prompt || 'test', splitMode: 'storyboard' }
        : { prompt: options.prompt || 'test' },
      ...(options.generationAlternative ? { generationAlternatives: [options.generationAlternative] } : {}),
      ...(isRunningHub ? {
        runningHub: {
          catalogId: 'provider-1:workflow:workflow-1', targetType: 'workflow', runTargetId: 'workflow-1', pageId: 'workflow-1', workflowId: 'workflow-1',
          fields: [{ nodeId: 'prompt-1', fieldName: 'text', valueType: 'string' }],
          values: { 'prompt-1:text': 'a studio portrait' },
        },
      } : {}),
    } }] }, budget_snapshot: { maxAttemptsPerStep: options.maxAttemptsPerStep ?? 2 },
    configuration_snapshot: { retryExhaustionPolicy: options.retryExhaustionPolicy || 'stop', maxFallbackCount: 1, promptReviewRewriteEnabled: options.promptRewrite === true, promptReviewMaxRetries: options.promptRewrite ? 1 : 0 },
    input_binding: {}, recovery_overrides: {}, recovery_context: {}, depends_on: [], run_created_at: new Date(),
  };
  const topLevelQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes("select id from xh_canvas_runs where status in ('queued', 'running')")) return { rows: [] };
    if (sql.includes("t.status = 'running'")) return { rows: [] };
    if (sql.includes('from xh_agent_approvals')) return { rows: state.stepStatus === 'awaiting_approval' && state.approvalId
      ? [{ approval_id: state.approvalId, run_id: 'run-1', step_id: 'step-1', status: options.approvalStatus || 'approved' }]
      : [] };
    if (sql.includes("t.status in ('succeeded', 'failed', 'cancelled')")) return { rows: options.failedTaskResult && state.stepStatus === 'queued'
      ? [{ ...step, recovery_overrides: state.recoveryOverrides, status: state.stepStatus, task_status: 'failed', task_result: options.failedTaskResult, task_payload: { prompt: options.prompt || 'test' }, task_provider_id: 'provider-1', task_model_record_id: 'model-1' }]
      : [] };
    if (sql.includes("s.status = 'retry_wait'")) return { rows: [] };
    if (sql.includes('s.dispatch_enqueued_at is null')) {
      return { rows: state.stepStatus === 'queued' && state.taskId && !state.dispatchEnqueued
        ? [{ step_id: 'step-1', task_id: state.taskId, capability: String(state.taskPayload.taskCapability || 'image') }]
        : [] };
    }
    if (sql.includes('set dispatch_enqueued_at = now()')) {
      state.dispatchEnqueued = true;
      return { rows: [] };
    }
    throw new Error(`unexpected pool query: ${sql} ${JSON.stringify(params || [])}`);
  });
  const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return { rows: [] };
    if (sql.includes("s.node_type = 'smart-candidate-selector'") && sql.includes('for update')) return { rows: [] };
    if (sql.includes('insert into xh_canvas_run_dispatch_cursors')) return { rows: [] };
    if (sql.includes('from xh_canvas_run_dispatch_cursors') && sql.includes('for update')) return { rows: [{ last_owner_id: state.lastOwnerId }] };
    if (sql.includes('update xh_canvas_run_dispatch_cursors')) {
      state.lastOwnerId = String(params?.[1] || '');
      return { rows: [] };
    }
    if (sql.includes('where s.id = $1 for update of s, r')) {
      return { rows: [{ ...step, recovery_overrides: state.recoveryOverrides, status: state.stepStatus, task_status: 'failed', task_result: options.failedTaskResult || {}, task_payload: { prompt: options.prompt || 'test' }, task_provider_id: 'provider-1', task_model_record_id: 'model-1' }] };
    }
    if (sql.includes('from xh_recovery_decisions') && sql.includes('order by created_at asc')) return { rows: [] };
    if (sql.includes('from xh_llm_route_pool_publications')) return { rows: options.promptRewrite ? [{
      pool_id: 'pool-1', pool_version_id: 'pool-version-1', pool_version: 1,
      entry_id: 'entry-1', provider_id: 'provider-1', model_record_id: 'chat-model-1',
      model_capability_snapshot: 'chat', capability_tags_snapshot: [], priority: 0, weight: 1,
      estimated_cost: '0', health_state: 'healthy', p95_latency_ms: 0,
    }] : [] };
    if (sql.includes('insert into xh_recovery_decisions')) {
      state.recoveryDecisionInsertions += 1;
      state.recoveryAction = String(params?.[6] || '');
      return { rows: [{ id: 'decision-1' }] };
    }
    if (sql.includes('insert into xh_agent_approvals')) {
      state.approvalId = String(params?.[0] || '');
      return { rows: [] };
    }
    if (sql.includes('insert into xh_llm_route_decisions')) return { rows: [] };
    if (sql.includes('update xh_recovery_decisions')) return { rows: [] };
    if (sql.includes('update xh_task_attempts')) return { rows: [] };
    if (sql.includes("set status = 'retry_wait'")) {
      state.stepStatus = 'retry_wait';
      state.retryDelayMs = Number(params?.[2] || 0);
      return { rows: [] };
    }
    if (sql.includes('update xh_canvas_run_steps') && sql.includes("set status = 'awaiting_approval'")) {
      state.stepStatus = 'awaiting_approval';
      state.recoveryOverrides = JSON.parse(String(params?.[1] || '{}'));
      return { rows: [] };
    }
    if (sql.includes('update xh_canvas_runs') && sql.includes("set status = 'awaiting_approval'")) return { rows: [] };
    if (sql.includes("set status = 'ready', task_id = null")) {
      state.stepStatus = 'ready';
      return { rows: [] };
    }
    if (sql.includes("s.status = 'ready'") && sql.includes('skip locked')) {
      return { rows: state.stepStatus === 'ready' ? [{ ...step, recovery_overrides: state.recoveryOverrides, status: state.stepStatus }] : [] };
    }
    if (sql.includes("count(*)::int as count from xh_tasks")) return { rows: [{ count: state.taskInsertions }] };
    if (sql.includes('jsonb_array_elements_text')) return { rows: [] };
    if (sql.includes("set status = 'succeeded', output_binding")) {
      state.stepStatus = 'succeeded';
      state.outputBinding = JSON.parse(String(params?.[1] || '{}'));
      return { rows: [] };
    }
    if (sql.includes("select status from xh_canvas_run_steps")) return { rows: [{ status: state.stepStatus }] };
    if (sql.includes('select execution_layer from xh_canvas_run_steps')) return { rows: [{ execution_layer: 0 }] };
    if (sql.includes("event_type='canvas_run.execution_layer_completed'")) return { rows: [] };
    if (sql.includes('select count(*)::text as count from xh_canvas_run_steps')) return { rows: [{ count: '1' }] };
    if (sql.includes("update xh_canvas_runs set status = 'succeeded'")) return { rows: [] };
    if (sql.includes('from xh_providers where id =')) return { rows: [{
      id: 'provider-1', enabled: true, protocol: 'runninghub', rh_workflows: [{
        id: 'workflow-1', enabled: true, title: 'Portrait workflow', runTargetId: 'workflow-1', taskCapability: 'image',
        fields: [{ nodeId: 'prompt-1', fieldName: 'text', fieldType: 'string', required: true }],
      }], rh_apps: [],
    }] };
    if (sql.includes('from xh_models m join xh_providers')) return { rows: [{ model_record_id: String(params?.[0] || 'model-1'), provider_id: String(params?.[2] || 'provider-1'), input_capabilities: {} }] };
    if (sql.includes('insert into xh_tasks')) {
      state.taskInsertions += 1;
      state.taskId = String(params?.[0] || '');
      state.taskPayload = JSON.parse(String(params?.[5] || '{}'));
      state.dispatchedProviderId = String(params?.[3] || '');
      state.dispatchedModelRecordId = String(params?.[4] || '');
      return { rows: [] };
    }
    if (sql.includes('insert into xh_task_attempts')) return { rows: [] };
    if (sql.includes("set status = 'queued', task_id = $2") && sql.includes('recovery_context')) {
      state.stepStatus = 'queued';
      state.taskId = String(params?.[1] || '');
      state.recoveryContext = JSON.parse(String(params?.[2] || '{}'));
      state.dispatchEnqueued = false;
      return { rows: [] };
    }
    if (sql.includes("set status = 'queued', task_id")) {
      state.stepStatus = 'queued';
      state.leaseOwner = String(params?.[2] || '');
      state.dispatchEnqueued = false;
      return { rows: [] };
    }
    if (sql.includes("update xh_canvas_runs set status = 'running'")) return { rows: [] };
    if (sql.includes('set event_sequence = event_sequence + 1') || sql.includes('set event_sequence=event_sequence+1')) return { rows: [{ event_sequence: ++state.eventSequence }] };
    if (sql.includes('insert into xh_canvas_run_events')) return { rows: [] };
    throw new Error(`unexpected client query: ${sql} ${JSON.stringify(params || [])}`);
  });
  let pushCount = 0;
  const redis = { lPush: vi.fn(async () => {
    pushCount += 1;
    if (options.failFirstPush && pushCount === 1) throw new Error('REDIS_DELIVERY_LOST');
    return 1;
  }) } as any;
  const pool = {
    query: topLevelQuery,
    connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })),
  } as any;
  return { state, pool, redis };
}
