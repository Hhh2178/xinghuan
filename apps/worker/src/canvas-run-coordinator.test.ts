import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createCanvasRunCoordinator, mergeUpstreamPayload, recoveryChoice } from './canvas-run-coordinator.js';

describe('canvas run coordinator', () => {
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

  it('uses finite same-configuration retries then an explicitly preauthorized node alternative', () => {
    const base = {
      budget_snapshot: { maxAttemptsPerStep: 2 },
      node_id: 'image-1',
      plan_snapshot: {
        steps: [{ nodeId: 'image-1', configuration: { generationAlternatives: [{ modelRecordId: 'model-b', requiresApproval: false }] } }],
      },
    };

    expect(recoveryChoice({ ...base, attempt_count: 1 } as any)).toEqual({ retry: true, strategy: 'same_configuration' });
    expect(recoveryChoice({ ...base, attempt_count: 2 } as any)).toMatchObject({ retry: true, strategy: 'node_alternative', alternative: { modelRecordId: 'model-b' } });
    expect(recoveryChoice({ ...base, attempt_count: 3 } as any)).toEqual({ retry: false, strategy: 'exhausted' });
  });

  it('does not auto-switch to alternatives requiring approval', () => {
    expect(recoveryChoice({
      attempt_count: 1,
      budget_snapshot: { maxAttemptsPerStep: 1 },
      node_id: 'video-1',
      plan_snapshot: { steps: [{ nodeId: 'video-1', configuration: { generationAlternatives: [{ modelRecordId: 'model-b', requiresApproval: true }] } }] },
    } as any)).toMatchObject({ retry: false, strategy: 'approval_required', alternative: { modelRecordId: 'model-b' } });
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

function coordinatorHarness(options: { failFirstPush?: boolean; nodeType?: 'image' | 'text' | 'text-split' | 'runninghub'; prompt?: string } = {}) {
  const state = {
    stepStatus: 'ready',
    taskId: '',
    taskInsertions: 0,
    dispatchEnqueued: false,
    leaseOwner: '',
    eventSequence: 0,
    lastOwnerId: '',
    outputBinding: {} as Record<string, unknown>,
    taskPayload: {} as Record<string, unknown>,
  };
  const isRunningHub = options.nodeType === 'runninghub';
  const step = {
    id: 'step-1', run_id: 'run-1', owner_id: 'owner-1', node_id: `${options.nodeType || 'image'}-1`, node_type: options.nodeType || 'image', status: 'ready',
    attempt_count: 0, task_id: null, plan_snapshot: { steps: [{ nodeId: `${options.nodeType || 'image'}-1`, configuration: {
      providerId: 'provider-1', modelRecordId: 'model-1', modelId: 'upstream-model', taskCapability: options.nodeType === 'text' || options.nodeType === 'text-split' ? '' : 'image', executionPayload: options.nodeType === 'text-split'
        ? { sourceText: options.prompt || 'test', splitMode: 'storyboard' }
        : { prompt: options.prompt || 'test' },
      ...(isRunningHub ? {
        runningHub: {
          catalogId: 'provider-1:workflow:workflow-1', targetType: 'workflow', runTargetId: 'workflow-1', pageId: 'workflow-1', workflowId: 'workflow-1',
          fields: [{ nodeId: 'prompt-1', fieldName: 'text', valueType: 'string' }],
          values: { 'prompt-1:text': 'a studio portrait' },
        },
      } : {}),
    } }] }, budget_snapshot: {}, input_binding: {}, depends_on: [], run_created_at: new Date(),
  };
  const topLevelQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('from xh_agent_approvals')) return { rows: [] };
    if (sql.includes("t.status in ('succeeded', 'failed', 'cancelled')")) return { rows: [] };
    if (sql.includes('s.dispatch_enqueued_at is null')) {
      return { rows: state.stepStatus === 'queued' && state.taskId && !state.dispatchEnqueued
        ? [{ step_id: 'step-1', task_id: state.taskId, capability: 'image' }]
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
    if (sql.includes('insert into xh_canvas_run_dispatch_cursors')) return { rows: [] };
    if (sql.includes('from xh_canvas_run_dispatch_cursors') && sql.includes('for update')) return { rows: [{ last_owner_id: state.lastOwnerId }] };
    if (sql.includes('update xh_canvas_run_dispatch_cursors')) {
      state.lastOwnerId = String(params?.[1] || '');
      return { rows: [] };
    }
    if (sql.includes("s.status = 'ready'") && sql.includes('skip locked')) {
      return { rows: state.stepStatus === 'ready' ? [{ ...step, status: state.stepStatus }] : [] };
    }
    if (sql.includes("count(*)::int as count from xh_tasks")) return { rows: [{ count: state.taskInsertions }] };
    if (sql.includes('jsonb_array_elements_text')) return { rows: [] };
    if (sql.includes("set status = 'succeeded', output_binding")) {
      state.stepStatus = 'succeeded';
      state.outputBinding = JSON.parse(String(params?.[1] || '{}'));
      return { rows: [] };
    }
    if (sql.includes("select status from xh_canvas_run_steps")) return { rows: [{ status: state.stepStatus }] };
    if (sql.includes("update xh_canvas_runs set status = 'succeeded'")) return { rows: [] };
    if (sql.includes('from xh_providers where id =')) return { rows: [{
      id: 'provider-1', enabled: true, protocol: 'runninghub', rh_workflows: [{
        id: 'workflow-1', enabled: true, title: 'Portrait workflow', runTargetId: 'workflow-1', taskCapability: 'image',
        fields: [{ nodeId: 'prompt-1', fieldName: 'text', fieldType: 'string', required: true }],
      }], rh_apps: [],
    }] };
    if (sql.includes('from xh_models m join xh_providers')) return { rows: [{ model_record_id: 'model-1', provider_id: 'provider-1' }] };
    if (sql.includes('insert into xh_tasks')) {
      state.taskInsertions += 1;
      state.taskId = String(params?.[0] || '');
      state.taskPayload = JSON.parse(String(params?.[5] || '{}'));
      return { rows: [] };
    }
    if (sql.includes("set status = 'queued', task_id")) {
      state.stepStatus = 'queued';
      state.leaseOwner = String(params?.[2] || '');
      state.dispatchEnqueued = false;
      return { rows: [] };
    }
    if (sql.includes("update xh_canvas_runs set status = 'running'")) return { rows: [] };
    if (sql.includes('set event_sequence = event_sequence + 1')) return { rows: [{ event_sequence: ++state.eventSequence }] };
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
